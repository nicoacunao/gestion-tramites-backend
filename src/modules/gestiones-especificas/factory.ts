import type { AppBindings } from '../../shared/config/bindings';
import { AppError } from '../../shared/errors/app-error';
import type { GestionesEspecificasDependencies } from './http/controller';
import { authorizeRequest } from '../../shared/auth/request-auth';
import { PostgresGestionesEspecificasRepository } from './infrastructure/postgres-repository';
export function postgresGestionesEspecificasDependencies(
  env: AppBindings,
): GestionesEspecificasDependencies {
  if (!env.database)
    throw new AppError(
      'DATABASE_NOT_CONFIGURED',
      'La sesión de base de datos no está configurada.',
      503,
    );
  return {
    repository: new PostgresGestionesEspecificasRepository(env.database.getPool()),
    authorize: (request, role) => authorizeRequest(request, env, role),
  };
}
