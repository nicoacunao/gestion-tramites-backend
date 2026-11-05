import { AppError } from '../../shared/errors/app-error';
import type { AppBindings } from '../../shared/config/bindings';
import type { LoginDependencies } from './application/login';
import { ExcelGraphUserDataSource } from '../../infrastructure/persistence/excel-graph/excel-user-data-source';
import { ExcelUserRepository } from './infrastructure/user-repository';
import { Pbkdf2PasswordHasher } from './infrastructure/password-hasher';
import { HmacSessionIssuer } from './infrastructure/session-issuer';

export function excelIdentityDependencies(env: AppBindings): LoginDependencies {
  const required = [
    'GRAPH_TENANT_ID',
    'GRAPH_CLIENT_ID',
    'GRAPH_CLIENT_SECRET',
    'GRAPH_REFRESH_TOKEN',
    'GRAPH_DRIVE_ID',
    'GRAPH_WORKBOOK_ITEM_ID',
    'AUTH_TOKEN_SECRET',
  ] as const;
  if (required.some((key) => !env[key]))
    throw new AppError(
      'IDENTITY_NOT_CONFIGURED',
      'La persistencia de identidad no está configurada.',
      503,
    );
  const source = new ExcelGraphUserDataSource({
    tenantId: env.GRAPH_TENANT_ID!,
    clientId: env.GRAPH_CLIENT_ID!,
    clientSecret: env.GRAPH_CLIENT_SECRET!,
    refreshToken: env.GRAPH_REFRESH_TOKEN!,
    driveId: env.GRAPH_DRIVE_ID!,
    workbookItemId: env.GRAPH_WORKBOOK_ITEM_ID!,
  });
  return {
    users: new ExcelUserRepository(source),
    passwords: new Pbkdf2PasswordHasher(),
    sessions: new HmacSessionIssuer(env.AUTH_TOKEN_SECRET!),
  };
}
