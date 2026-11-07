import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import type { AmbitosRepository } from '../application/ports';
import type { ManagementScope } from '../domain/model';

type Row = Omit<ManagementScope, 'version'> & { version: string };
export class PostgresAmbitosRepository implements AmbitosRepository {
  constructor(private readonly database: SqlExecutor) {}
  async listScopes(): Promise<readonly ManagementScope[]> {
    const result = await this.database.query<Row>(
      `SELECT codigo_ambito AS code, nombre AS name, xmin::text AS version
      FROM ambito_gestion ORDER BY codigo_ambito`,
      [],
    );
    return result.rows.map((row) => ({ ...row, version: Number(row.version) }));
  }
}
