import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import type { AntecedentesRepository } from '../application/ports';
import type { BackgroundCatalogItem, BackgroundCategory } from '../domain/model';

type Row = Omit<BackgroundCatalogItem, 'version'> & { version: string };
export class PostgresAntecedentesRepository implements AntecedentesRepository {
  constructor(private readonly database: SqlExecutor) {}
  async listBackgrounds(category?: BackgroundCategory): Promise<readonly BackgroundCatalogItem[]> {
    const result = await this.database.query<Row>(
      `SELECT id_antecedente::text AS id, nombre AS name, xmin::text AS version
      FROM antecedente
      WHERE ($1::varchar IS NULL OR categoria = $1)
      ORDER BY nombre, id_antecedente`,
      [category ?? null],
    );
    return result.rows.map((row) => ({ ...row, version: Number(row.version) }));
  }
}
