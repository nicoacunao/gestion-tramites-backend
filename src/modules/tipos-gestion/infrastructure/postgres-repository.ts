import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import type { TiposGestionRepository } from '../application/ports';
import type { ManagementType } from '../domain/model';

type Row = ManagementType;
export class PostgresTiposGestionRepository implements TiposGestionRepository {
  constructor(private readonly database: SqlExecutor) {}
  async listManagementTypes(): Promise<readonly ManagementType[]> {
    const result = await this.database.query<Row>(
      `SELECT id_tipo_gestion::text AS id,
        id_gestion_padre::text AS "parentId",
        id_ambito_gestion::text AS "scopeId",
        nombre AS name, nivel AS level, flag_requerida AS required
      FROM tipo_gestion ORDER BY nivel, nombre, id_tipo_gestion`,
      [],
    );
    return result.rows;
  }
}
