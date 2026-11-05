import type { AppBindings } from '../../shared/config/bindings';
import { AppError } from '../../shared/errors/app-error';
import { MicrosoftGraphWorkbookDataSource } from '../../infrastructure/persistence/excel-graph/microsoft-graph-workbook-data-source';
import { ExcelCatalogRepository } from './infrastructure/excel-catalog-repository';
import type { CatalogosDependencies } from './http/router';

export function excelCatalogosDependencies(env: AppBindings): CatalogosDependencies {
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
      'CATALOGS_NOT_CONFIGURED',
      'La persistencia de catálogos no está configurada.',
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
  return {
    repository: new ExcelCatalogRepository(source),
    authorize: (request, role) => request.headers.get('x-role') === role,
  };
}
