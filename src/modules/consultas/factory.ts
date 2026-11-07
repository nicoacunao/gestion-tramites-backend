import type { AppBindings } from '../../shared/config/bindings';
import { AppError } from '../../shared/errors/app-error';
import { PostgresManagementQueries } from './infrastructure/postgres-management-queries';
export function postgresConsultasDependencies(env: AppBindings) {
  if (!env.database) throw new AppError('DATABASE_NOT_CONFIGURED', 'No hay sesión de base de datos.', 503);
  return new PostgresManagementQueries(env.database.getPool());
}
