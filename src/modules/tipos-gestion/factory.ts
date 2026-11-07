import type { AppBindings } from '../../shared/config/bindings';
import { AppError } from '../../shared/errors/app-error';
import type { TiposGestionDependencies } from './http/controller';
import { authorizeRequest } from '../../shared/auth/request-auth';
import { PostgresTiposGestionRepository } from './infrastructure/postgres-repository';

export function postgresTiposGestionDependencies(env: AppBindings): TiposGestionDependencies {
  if (!env.database)
    throw new AppError(
      'DATABASE_NOT_CONFIGURED',
      'La sesión de base de datos no está configurada.',
      503,
    );
  return {
    repository: new PostgresTiposGestionRepository(env.database.getPool()),
    authorize: (request, role) => authorizeRequest(request, env, role),
  };
}
