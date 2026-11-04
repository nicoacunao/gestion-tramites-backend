import { NotImplementedAppError } from '../../../shared/errors/app-error';
import type { TabularDataSource, TabularRow } from '../../../shared/persistence/tabular-repository';

export interface MicrosoftGraphWorkbookOptions {
  tenantId: string;
  clientId: string;
  driveId: string;
  workbookItemId: string;
  authMode: 'disabled' | 'delegated-refresh-token';
}

/**
 * Placeholder intencional.
 *
 * Excel Workbook API no admite permisos de aplicación para las operaciones
 * verificadas. Este adaptador no se conecta hasta aprobar un flujo OAuth
 * delegado u otra estrategia de almacenamiento.
 */
export class MicrosoftGraphWorkbookDataSource implements TabularDataSource {
  constructor(readonly options: MicrosoftGraphWorkbookOptions) {}

  readTable(_tableName: string): Promise<readonly TabularRow[]> {
    throw new NotImplementedAppError('excel-graph.readTable');
  }

  findRow(_tableName: string, _id: string): Promise<TabularRow | null> {
    throw new NotImplementedAppError('excel-graph.findRow');
  }

  upsertRow(_tableName: string, _row: TabularRow, _expectedVersion?: number): Promise<void> {
    throw new NotImplementedAppError('excel-graph.upsertRow');
  }
}
