import type { AppBindings } from '../../shared/config/bindings';
import { AppError } from '../../shared/errors/app-error';
import type { EstacionesDependencies } from './http/controller';
import { PostgresStationRepository } from './infrastructure/postgres-station-repository';
import { authorizeRequest } from '../../shared/auth/request-auth';

export function postgresEstacionesDependencies(env: AppBindings): EstacionesDependencies {
  if (!env.database)
    throw new AppError(
      'DATABASE_NOT_CONFIGURED',
      'La sesión de base de datos no está configurada.',
      503,
    );
  return {
    repository: new PostgresStationRepository(env.database.getPool()),
    authorize: (request, role) => authorizeRequest(request, env, role),
  };
}
