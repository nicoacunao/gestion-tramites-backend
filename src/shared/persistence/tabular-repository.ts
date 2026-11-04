export type TabularRow = Readonly<Record<string, string | number | boolean | null>>;

export interface TabularEntity {
  id: string;
  version: number;
}

export interface TabularDataSource {
  readTable(tableName: string): Promise<readonly TabularRow[]>;
  findRow(tableName: string, id: string): Promise<TabularRow | null>;
  upsertRow(tableName: string, row: TabularRow, expectedVersion?: number): Promise<void>;
}

export interface EntityMapper<TEntity extends TabularEntity> {
  fromRow(row: TabularRow): TEntity;
  toRow(entity: TEntity): TabularRow;
}

export interface EntityRepository<TEntity extends TabularEntity> {
  list(): Promise<readonly TEntity[]>;
  findById(id: string): Promise<TEntity | null>;
  save(entity: TEntity, expectedVersion?: number): Promise<void>;
}
