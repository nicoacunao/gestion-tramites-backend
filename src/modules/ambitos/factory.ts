import type { AppBindings } from '../../shared/config/bindings';
import { AppError } from '../../shared/errors/app-error';
import type { AmbitosDependencies } from './http/controller';
import { PostgresAmbitosRepository } from './infrastructure/postgres-repository';

export function postgresAmbitosDependencies(env: AppBindings): AmbitosDependencies {
  if (!env.database)
    throw new AppError(
      'DATABASE_NOT_CONFIGURED',
      'La sesión de base de datos no está configurada.',
      503,
    );
  return {
    repository: new PostgresAmbitosRepository(env.database.getPool()),
    authorize: (request, role) => request.headers.get('x-role') === role,
  };
}
