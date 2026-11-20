import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import type { AmbitosRepository } from '../application/ports';
import type { ManagementScope } from '../domain/model';

type Row = ManagementScope;
export class PostgresAmbitosRepository implements AmbitosRepository {
  constructor(private readonly database: SqlExecutor) {}
  async listScopes(): Promise<readonly ManagementScope[]> {
    const result = await this.database.query<Row>(
      `SELECT id_ambito_gestion::text AS id, codigo AS code, nombre AS name
      FROM ambito_gestion ORDER BY codigo`,
      [],
    );
    return result.rows;
  }
}
