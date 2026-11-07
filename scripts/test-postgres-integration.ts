/** Real SQL integration test against an isolated, disposable PostgreSQL cluster.
 * Run: node --import tsx scripts/test-postgres-integration.ts
 * Requires initdb and pg_ctl on PATH (or POSTGRES_BIN_DIR); never uses DATABASE_URL.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Pool } from 'pg';
import { createDatabasePool } from '../src/infrastructure/persistence/postgres/connection';
import { PostgresStationRepository } from '../src/modules/estaciones/infrastructure/postgres-station-repository';
import type { Station } from '../src/modules/estaciones/domain/station';
import { PostgresAmbitosRepository } from '../src/modules/ambitos/infrastructure/postgres-repository';
import { PostgresTiposGestionRepository } from '../src/modules/tipos-gestion/infrastructure/postgres-repository';
import { PostgresAntecedentesRepository } from '../src/modules/antecedentes/infrastructure/postgres-repository';
import { PostgresEtapasRepository } from '../src/modules/etapas/infrastructure/postgres-repository';

const execute = promisify(execFile);
const binary = (name: string) =>
  process.env.POSTGRES_BIN_DIR ? join(process.env.POSTGRES_BIN_DIR, name) : name;

async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address && typeof address === 'object');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function seed(database: Pool) {
  const largeId = '9007199254740993';
  for (const [table, column] of [
    ['usuario', 'id_usuario'],
    ['antecedente', 'id_antecedente'],
    ['gestion', 'id_gestion'],
    ['entrada_bitacora', 'id_entrada_bitacora'],
  ]) {
    await database.query('SELECT setval(pg_get_serial_sequence($1, $2), $3::bigint, false)', [
      table,
      column,
      largeId,
    ]);
  }
  const user = await database.query<{ id: string }>(
    `INSERT INTO usuario (rut, contrasena_hash, nombres, primer_apellido, correo, rol)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_usuario::text AS id`,
    [
      '12.345.678-9',
      'hash-for-integration-only',
      'Ana',
      'Pérez',
      'ana@example.invalid',
      'gestiones',
    ],
  );
  await database.query('INSERT INTO ambito_gestion (codigo_ambito, nombre) VALUES ($1, $2)', [
    'M',
    'Municipal',
  ]);
  await database.query('INSERT INTO tipo_gestion (id_tipo_gestion, nombre) VALUES ($1, $2)', [
    'patente',
    'Patente',
  ]);
  const background = await database.query<{ id: string }>(
    'INSERT INTO antecedente (nombre) VALUES ($1) RETURNING id_antecedente::text AS id',
    ['Certificado'],
  );
  await database.query('INSERT INTO etapa (nombre, porcentaje, orden) VALUES ($1, $2, $3)', [
    'Final',
    100,
    2,
  ]);
  await database.query('INSERT INTO etapa (nombre, porcentaje, orden) VALUES ($1, $2, $3)', [
    'Inicio',
    0,
    1,
  ]);
  assert.equal(user.rows[0]?.id, largeId);
  assert.equal(background.rows[0]?.id, largeId);
  return { userId: largeId, backgroundId: largeId };
}

async function verifyStations(database: Pool) {
  const repository = new PostgresStationRepository(database);
  const injection = "x'; DROP TABLE usuario; --";
  const station: Station = {
    id: '60001',
    name: null,
    address: injection,
    commune: 'Santiago',
    legalName: 'Empresa de prueba',
    zoneManager: '',
    commercialManager: '',
    companyRut: '',
    legalRepresentative: '',
    legalRepresentativeRut: null,
    status: 'active',
    version: 0,
  };
  const inserted = await repository.saveStation(station);
  assert(inserted.version > 0);
  assert.equal(inserted.address, injection);
  assert.deepEqual(await repository.findStationById(inserted.id), inserted);
  assert.equal(await repository.findStationById("' OR true --"), null);
  assert.equal((await repository.listStations()).length, 1);
  const raw = await database.query(
    'SELECT jefe_zona, nombre_representante_legal FROM estacion WHERE id_estacion = $1',
    [station.id],
  );
  assert.equal(raw.rows[0]?.jefe_zona, null);
  assert.equal(raw.rows[0]?.nombre_representante_legal, null);
  const updated = await repository.saveStation(
    { ...inserted, address: 'Nueva dirección' },
    inserted.version,
  );
  assert.notEqual(updated.version, inserted.version);
  await assert.rejects(
    () => repository.saveStation({ ...inserted, address: 'Cambio obsoleto' }, inserted.version),
    { code: 'VERSION_CONFLICT' },
  );
  assert.equal((await repository.findStationById(station.id))?.address, 'Nueva dirección');
  await assert.rejects(() => repository.saveStation(station), { code: '23505' });
  assert.equal(
    (await database.query('SELECT count(*)::integer AS count FROM usuario', [])).rows[0]?.count,
    1,
  );
  return inserted.id;
}

async function verifyCatalogs(database: Pool, largeId: string) {
  assert.deepEqual(
    (await new PostgresAmbitosRepository(database).listScopes()).map(({ code }) => code),
    ['M'],
  );
  assert.deepEqual(
    (await new PostgresTiposGestionRepository(database).listManagementTypes()).map(({ id }) => id),
    ['patente'],
  );
  assert.equal(
    (await new PostgresAntecedentesRepository(database).listBackgrounds())[0]?.id,
    largeId,
  );
  assert.deepEqual(
    (await new PostgresEtapasRepository(database).listStages()).map(({ order }) => order),
    [1, 2],
  );
  const defaults = await database.query(
    'SELECT etiqueta_segundo_nivel, requiere_seleccion_segundo_nivel_principal FROM tipo_gestion WHERE id_tipo_gestion = $1',
    ['patente'],
  );
  assert.equal(defaults.rows[0]?.etiqueta_segundo_nivel, 'Gestión específica');
  assert.equal(defaults.rows[0]?.requiere_seleccion_segundo_nivel_principal, false);
}

const directory = await mkdtemp('/tmp/gestion-tramites-pg-');
const dataDirectory = join(directory, 'data');
let started = false;
let database: Pool | undefined;
try {
  const port = await unusedPort();
  await execute(binary('initdb'), [
    '-D',
    dataDirectory,
    '-A',
    'trust',
    '-U',
    'postgres',
    '--no-locale',
    '-E',
    'UTF8',
  ]);
  await execute(binary('pg_ctl'), [
    '-D',
    dataDirectory,
    '-l',
    join(directory, 'postgres.log'),
    '-o',
    `-h 127.0.0.1 -p ${port} -k ${directory}`,
    '-w',
    '-t',
    '15',
    'start',
  ]);
  started = true;
  database = createDatabasePool({
    DATABASE_URL: `postgresql://postgres@127.0.0.1:${port}/postgres`,
    DATABASE_SSL_MODE: 'disable',
    DATABASE_POOL_MAX: '2',
    APP_ENV: 'development',
  });
  await database.query(await readFile(new URL('../docs/data/schema.sql', import.meta.url), 'utf8'));
  const fixtures = await seed(database);
  await verifyStations(database);
  await verifyCatalogs(database, fixtures.backgroundId);
  console.info(
    'PostgreSQL real: estaciones, catálogos, BIGINT, parámetros SQL, NULL, defaults y conflicto xmin verificados.',
  );
} finally {
  try {
    if (database) await database.end();
  } finally {
    // Only the cluster created by this invocation is stopped and removed.
    if (started)
      await execute(binary('pg_ctl'), [
        '-D',
        dataDirectory,
        '-m',
        'fast',
        '-w',
        '-t',
        '15',
        'stop',
      ]);
    await rm(directory, { recursive: true, force: true });
  }
}
