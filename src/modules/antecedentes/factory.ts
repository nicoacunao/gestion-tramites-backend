import type { AppBindings } from '../../shared/config/bindings';
import { AppError } from '../../shared/errors/app-error';
import type { AntecedentesDependencies } from './http/controller';
import { authorizeRequest } from '../../shared/auth/request-auth';
import { PostgresAntecedentesRepository } from './infrastructure/postgres-repository';

export function postgresAntecedentesDependencies(env: AppBindings): AntecedentesDependencies {
  if (!env.database)
    throw new AppError(
      'DATABASE_NOT_CONFIGURED',
      'La sesión de base de datos no está configurada.',
      503,
    );
  return {
    repository: new PostgresAntecedentesRepository(env.database.getPool()),
    authorize: (request, role) => authorizeRequest(request, env, role),
  };
}
