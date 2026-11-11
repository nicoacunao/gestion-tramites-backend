import type { AppBindings } from '../../shared/config/bindings';
import { AppError } from '../../shared/errors/app-error';
import { PostgresManagementQueries } from './infrastructure/postgres-management-queries';
import { PostgresStationRepository } from '../estaciones/infrastructure/postgres-station-repository';
import { authorizeRequest } from '../../shared/auth/request-auth';
import type { ConsultasDependencies } from './application/ports';
export function postgresConsultasDependencies(env: AppBindings) {
  if (!env.database)
    throw new AppError('DATABASE_NOT_CONFIGURED', 'No hay sesión de base de datos.', 503);
  return {
    queries: new PostgresManagementQueries(env.database.getPool()),
    stations: new PostgresStationRepository(env.database.getPool()),
    authorize: (request: Request, role: string) => authorizeRequest(request, env, role),
  } satisfies ConsultasDependencies;
}
