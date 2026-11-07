import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import { AppError } from '../../../shared/errors/app-error';
import type { StationRepository } from '../application/ports';
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
    status: 'active',
    version: Number(row.version),
  };
}

export class PostgresStationRepository implements StationRepository {
  constructor(private readonly database: SqlExecutor) {}
  async listStations(): Promise<readonly Station[]> {
    const result = await this.database.query<StationRow>(
      `
      SELECT id_estacion, direccion, comuna, razon_social, jefe_zona, jefe_comercial,
             rut_sociedad, nombre_representante_legal, rut_representante_legal, xmin::text AS version
      FROM estacion ORDER BY id_estacion`,
      [],
    );
    return result.rows.map(fromRow);
  }
  async findStationById(id: string): Promise<Station | null> {
    const result = await this.database.query<StationRow>(
      `
      SELECT id_estacion, direccion, comuna, razon_social, jefe_zona, jefe_comercial,
             rut_sociedad, nombre_representante_legal, rut_representante_legal, xmin::text AS version
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
            rut_sociedad, nombre_representante_legal, rut_representante_legal, xmin::text AS version`,
            values,
          )
        : await this.database.query<StationRow>(
            `
          UPDATE estacion SET direccion = $2, comuna = $3, razon_social = $4, jefe_zona = $5,
            jefe_comercial = $6, rut_sociedad = $7, nombre_representante_legal = $8,
            rut_representante_legal = $9
          WHERE id_estacion = $1 AND xmin::text = $10
          RETURNING id_estacion, direccion, comuna, razon_social, jefe_zona, jefe_comercial,
            rut_sociedad, nombre_representante_legal, rut_representante_legal, xmin::text AS version`,
            [...values, String(expectedVersion)],
          );
    const row = result.rows[0];
    if (!row)
      throw new AppError('VERSION_CONFLICT', 'La estación fue modificada por otro usuario.', 409);
    return fromRow(row);
  }
}
