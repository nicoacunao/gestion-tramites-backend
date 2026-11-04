import type {
  EntityMapper,
  EntityRepository,
  TabularDataSource,
  TabularEntity,
} from '../../../shared/persistence/tabular-repository';

export class ExcelGraphEntityRepository<
  TEntity extends TabularEntity,
> implements EntityRepository<TEntity> {
  constructor(
    private readonly tableName: string,
    private readonly dataSource: TabularDataSource,
    private readonly mapper: EntityMapper<TEntity>,
  ) {}

  async list(): Promise<readonly TEntity[]> {
    const rows = await this.dataSource.readTable(this.tableName);
    return rows.map((row) => this.mapper.fromRow(row));
  }

  async findById(id: string): Promise<TEntity | null> {
    const row = await this.dataSource.findRow(this.tableName, id);
    return row ? this.mapper.fromRow(row) : null;
  }

  async save(entity: TEntity, expectedVersion?: number): Promise<void> {
    await this.dataSource.upsertRow(this.tableName, this.mapper.toRow(entity), expectedVersion);
  }
}
