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
  const scope = await database.query<{ id: string }>(
    'INSERT INTO ambito_gestion (codigo, nombre) VALUES ($1, $2) RETURNING id_ambito_gestion::text AS id',
    ['M', 'Municipal'],
  );
  await database.query(
    'INSERT INTO tipo_gestion (id_ambito_gestion, nombre, nivel) VALUES ($1::bigint, $2, $3)',
    [scope.rows[0]?.id, 'Patente', 1],
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
  return { userId: largeId };
}

async function verifyStations(database: Pool) {
  const repository = new PostgresStationRepository(database);
  const injection = "x'; DROP TABLE usuario; --";
  const station: Station = {
    id: '60001',
    address: injection,
    commune: 'Santiago',
    legalName: 'Empresa de prueba',
    zoneManager: null,
    commercialManager: null,
    companyRut: null,
    legalRepresentative: null,
    legalRepresentativeRut: null,
    estado: 'No',
  };
  const inserted = await repository.saveStation(station);
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
  const updated = await repository.saveStation({ ...inserted, address: 'Nueva dirección' });
  assert.equal(updated.address, 'Nueva dirección');
  assert.equal((await repository.findStationById(station.id))?.address, 'Nueva dirección');
  await assert.rejects(() => repository.saveStation(station), { code: '23505' });
  assert.equal(
    (await database.query('SELECT count(*)::integer AS count FROM usuario', [])).rows[0]?.count,
    1,
  );
  return inserted.id;
}

async function verifyCatalogs(database: Pool) {
  assert.deepEqual(
    (await new PostgresAmbitosRepository(database).listScopes()).map(({ code }) => code),
    ['M'],
  );
  assert.equal(
    (await new PostgresTiposGestionRepository(database).listManagementTypes()).length,
    1,
  );
  assert.deepEqual(
    (await new PostgresEtapasRepository(database).listStages()).map(({ order }) => order),
    [1, 2],
  );
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
  await seed(database);
  await verifyStations(database);
  await verifyCatalogs(database);
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
