import { MicrosoftGraphWorkbookDataSource } from '../../infrastructure/persistence/excel-graph/microsoft-graph-workbook-data-source';
import { AppError } from '../../shared/errors/app-error';
import type { AppBindings } from '../../shared/config/bindings';
import { ExcelLogRepository } from './infrastructure/excel-log-repository';
import type { BitacoraDependencies } from './http/router';

export function excelBitacoraDependencies(env: AppBindings): BitacoraDependencies {
  const required = [
    'GRAPH_TENANT_ID',
    'GRAPH_CLIENT_ID',
    'GRAPH_CLIENT_SECRET',
    'GRAPH_REFRESH_TOKEN',
    'GRAPH_DRIVE_ID',
    'GRAPH_WORKBOOK_ITEM_ID',
  ] as const;
  if (required.some((key) => !env[key]))
    throw new AppError(
      'BITACORA_NOT_CONFIGURED',
      'La persistencia de bitácora no está configurada.',
      503,
    );
  const source = new MicrosoftGraphWorkbookDataSource({
    tenantId: env.GRAPH_TENANT_ID!,
    clientId: env.GRAPH_CLIENT_ID!,
    clientSecret: env.GRAPH_CLIENT_SECRET!,
    refreshToken: env.GRAPH_REFRESH_TOKEN!,
    driveId: env.GRAPH_DRIVE_ID!,
    workbookItemId: env.GRAPH_WORKBOOK_ITEM_ID!,
    authMode: 'delegated-refresh-token',
  });
  return { repository: new ExcelLogRepository(source) };
}
