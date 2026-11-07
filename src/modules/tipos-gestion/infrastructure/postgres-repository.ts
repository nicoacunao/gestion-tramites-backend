import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import type { TiposGestionRepository } from '../application/ports';
import type { ManagementType } from '../domain/model';

type Row = Omit<ManagementType, 'version'> & { version: string };
export class PostgresTiposGestionRepository implements TiposGestionRepository {
  constructor(private readonly database: SqlExecutor) {}
  async listManagementTypes(): Promise<readonly ManagementType[]> {
    const result = await this.database.query<Row>(
      `SELECT id_tipo_gestion AS id, nombre AS name, xmin::text AS version
      FROM tipo_gestion ORDER BY nombre, id_tipo_gestion`,
      [],
    );
    return result.rows.map((row) => ({ ...row, version: Number(row.version) }));
  }
}
