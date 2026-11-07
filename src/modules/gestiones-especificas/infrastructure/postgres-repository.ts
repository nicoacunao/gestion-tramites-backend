import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import type { GestionesEspecificasRepository } from '../application/ports';
import type { SpecificManagement } from '../domain/model';
export class PostgresGestionesEspecificasRepository implements GestionesEspecificasRepository {
  constructor(private readonly database: SqlExecutor) {}
  async list(managementTypeId?: string): Promise<readonly SpecificManagement[]> {
    const result = await this.database.query<SpecificManagement>(
      `SELECT id_gestion_especifica::text AS id, id_tipo_gestion AS "managementTypeId",
        codigo AS code, nombre AS name, activo AS active
      FROM gestion_especifica
      WHERE ($1::varchar IS NULL OR id_tipo_gestion = $1)
      ORDER BY nombre, id_gestion_especifica`,
      [managementTypeId ?? null],
    );
    return result.rows;
  }
}
