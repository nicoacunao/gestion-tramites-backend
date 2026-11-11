import type { PoolClient } from 'pg';
import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import { AppError } from '../../../shared/errors/app-error';
import type { StationImportSummary, StationPage, StationRepository } from '../application/ports';
import type { Station } from '../domain/station';

interface StationRow {
  id_estacion: string;
  direccion: string;
  comuna: string;
  razon_social: string;
  jefe_zona: string | null;
  jefe_comercial: string | null;
  rut_sociedad: string | null;
  nombre_representante_legal: string | null;
  rut_representante_legal: string | null;
  status: string;
  version: string;
}
function fromRow(row: StationRow): Station {
  return {
    id: row.id_estacion,
    name: null,
    address: row.direccion,
    commune: row.comuna,
    legalName: row.razon_social,
    zoneManager: row.jefe_zona ?? '',
    commercialManager: row.jefe_comercial ?? '',
    companyRut: row.rut_sociedad ?? '',
    legalRepresentative: row.nombre_representante_legal ?? '',
    legalRepresentativeRut: row.rut_representante_legal,
    status: row.status ?? 'active',
    version: Number(row.version),
  };
}

export class PostgresStationRepository implements StationRepository {
  constructor(private readonly database: SqlExecutor) {}
  async listStations(): Promise<readonly Station[]> {
    const result = await this.database.query<StationRow>(
      `
      SELECT id_estacion, direccion, comuna, razon_social, jefe_zona, jefe_comercial,
             rut_sociedad, nombre_representante_legal, rut_representante_legal, status, xmin::text AS version
      FROM estacion ORDER BY id_estacion`,
      [],
    );
    return result.rows.map(fromRow);
  }
  async listStationsPage(page: number, pageSize: number): Promise<StationPage> {
    const offset = (page - 1) * pageSize;
    const [countResult, rowsResult] = await Promise.all([
      this.database.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM estacion', []),
      this.database.query<StationRow>(
        `
        SELECT id_estacion, direccion, comuna, razon_social, jefe_zona, jefe_comercial,
               rut_sociedad, nombre_representante_legal, rut_representante_legal, status,
               xmin::text AS version
        FROM estacion ORDER BY id_estacion LIMIT $1 OFFSET $2`,
        [pageSize, offset],
      ),
    ]);
    const total = Number(countResult.rows[0]?.total ?? 0);
    return {
      stations: rowsResult.rows.map(fromRow),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }
  async findStationById(id: string): Promise<Station | null> {
    const result = await this.database.query<StationRow>(
      `
      SELECT id_estacion, direccion, comuna, razon_social, jefe_zona, jefe_comercial,
             rut_sociedad, nombre_representante_legal, rut_representante_legal, status, xmin::text AS version
      FROM estacion WHERE id_estacion = $1`,
      [id],
    );
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }
  async saveStation(station: Station, expectedVersion?: number): Promise<Station> {
    if (station.name !== null || station.status !== 'active')
      throw new AppError(
        'UNSUPPORTED_STATION_FIELDS',
        'El esquema admite name=null y status=active; no existe almacenamiento para otros valores.',
        422,
      );
    const values = [
      station.id,
      station.address,
      station.commune,
      station.legalName,
      station.zoneManager || null,
      station.commercialManager || null,
      station.companyRut || null,
      station.legalRepresentative || null,
      station.legalRepresentativeRut,
    ];
    const result =
      expectedVersion === undefined
        ? await this.database.query<StationRow>(
            `
          INSERT INTO estacion (id_estacion, direccion, comuna, razon_social, jefe_zona,
            jefe_comercial, rut_sociedad, nombre_representante_legal, rut_representante_legal)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id_estacion, direccion, comuna, razon_social, jefe_zona, jefe_comercial,
            rut_sociedad, nombre_representante_legal, rut_representante_legal, status, xmin::text AS version`,
            values,
          )
        : await this.database.query<StationRow>(
            `
          UPDATE estacion SET direccion = $2, comuna = $3, razon_social = $4, jefe_zona = $5,
            jefe_comercial = $6, rut_sociedad = $7, nombre_representante_legal = $8,
            rut_representante_legal = $9
          WHERE id_estacion = $1 AND xmin::text = $10
          RETURNING id_estacion, direccion, comuna, razon_social, jefe_zona, jefe_comercial,
            rut_sociedad, nombre_representante_legal, rut_representante_legal, status, xmin::text AS version`,
            [...values, String(expectedVersion)],
          );
    const row = result.rows[0];
    if (!row)
      throw new AppError('VERSION_CONFLICT', 'La estación fue modificada por otro usuario.', 409);
    return fromRow(row);
  }

  async importStations(stations: readonly Station[]): Promise<StationImportSummary> {
    return this.inTransaction(async (client) => {
      let created = 0;
      let updated = 0;
      for (const station of stations) {
        const existing = await client.query<{ exists: boolean }>(
          'SELECT EXISTS (SELECT 1 FROM estacion WHERE id_estacion = $1) AS exists',
          [station.id],
        );
        const wasExisting = existing.rows[0]?.exists === true;
        const result = await client.query<StationRow>(
          `INSERT INTO estacion (id_estacion, direccion, comuna, razon_social, jefe_zona,
             jefe_comercial, rut_sociedad, nombre_representante_legal, rut_representante_legal, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id_estacion) DO UPDATE SET direccion = EXCLUDED.direccion,
             comuna = EXCLUDED.comuna, razon_social = EXCLUDED.razon_social,
             jefe_zona = EXCLUDED.jefe_zona, jefe_comercial = EXCLUDED.jefe_comercial,
             rut_sociedad = EXCLUDED.rut_sociedad,
             nombre_representante_legal = EXCLUDED.nombre_representante_legal,
             rut_representante_legal = EXCLUDED.rut_representante_legal,
             status = EXCLUDED.status
           RETURNING id_estacion, direccion, comuna, razon_social, jefe_zona, jefe_comercial,
             rut_sociedad, nombre_representante_legal, rut_representante_legal, status,
             xmin::text AS version`,
          [
            station.id,
            station.address,
            station.commune,
            station.legalName,
            station.zoneManager || null,
            station.commercialManager || null,
            station.companyRut || null,
            station.legalRepresentative || null,
            station.legalRepresentativeRut,
            station.status,
          ],
        );
        if (wasExisting) updated += 1;
        else created += 1;
        if (!result.rows[0]) throw new Error('La estación no fue persistida.');
      }
      const listed = await client.query<StationRow>(
        `SELECT id_estacion, direccion, comuna, razon_social, jefe_zona, jefe_comercial,
           rut_sociedad, nombre_representante_legal, rut_representante_legal, status,
           xmin::text AS version FROM estacion ORDER BY id_estacion`,
        [],
      );
      return { created, updated, rejected: 0, stations: listed.rows.map(fromRow) };
    });
  }

  private async inTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!('connect' in this.database) || typeof this.database.connect !== 'function')
      throw new AppError('DATABASE_NOT_CONFIGURED', 'La conexión no admite transacciones.', 503);
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
