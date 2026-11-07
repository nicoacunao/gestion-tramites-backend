import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import type { EtapasRepository } from '../application/ports';
import type { StageCatalogItem } from '../domain/model';

type Row = Omit<StageCatalogItem, 'version'> & { version: string };
export class PostgresEtapasRepository implements EtapasRepository {
  constructor(private readonly database: SqlExecutor) {}
  async listStages(): Promise<readonly StageCatalogItem[]> {
    const result = await this.database.query<Row>(
      `SELECT id_etapa::text AS id, nombre AS name, porcentaje AS percentage, orden AS "order", xmin::text AS version
      FROM etapa ORDER BY orden`,
      [],
    );
    return result.rows.map((row) => ({ ...row, version: Number(row.version) }));
  }
}
