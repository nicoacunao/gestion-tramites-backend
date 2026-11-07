import { AppError } from '../../shared/errors/app-error';
import type { AppBindings } from '../../shared/config/bindings';
import { PostgresManagementRepository } from './infrastructure/postgres-management-repository';
import type { GestionesDependencies } from './http/router';

export function postgresGestionesDependencies(env: AppBindings): GestionesDependencies {
  if (!env.database)
    throw new AppError('DATABASE_NOT_CONFIGURED', 'No hay sesión de base de datos.', 503);
  return {
    repository: new PostgresManagementRepository(env.database.getPool()),
    authorize: (request, role) => request.headers.get('x-role') === role,
  };
}
