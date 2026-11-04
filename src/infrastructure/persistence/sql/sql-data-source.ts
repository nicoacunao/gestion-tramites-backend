import { NotImplementedAppError } from '../../../shared/errors/app-error';
import type { TabularDataSource, TabularRow } from '../../../shared/persistence/tabular-repository';

/** Espacio de reemplazo para una futura implementación SQL. */
export class SqlDataSource implements TabularDataSource {
  readTable(_tableName: string): Promise<readonly TabularRow[]> {
    throw new NotImplementedAppError('sql.readTable');
  }

  findRow(_tableName: string, _id: string): Promise<TabularRow | null> {
    throw new NotImplementedAppError('sql.findRow');
  }

  upsertRow(_tableName: string, _row: TabularRow, _expectedVersion?: number): Promise<void> {
    throw new NotImplementedAppError('sql.upsertRow');
  }
}
