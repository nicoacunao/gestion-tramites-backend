import type { AppBindings } from '../../shared/config/bindings';
import { AppError } from '../../shared/errors/app-error';
import type { EtapasDependencies } from './http/controller';
import { PostgresEtapasRepository } from './infrastructure/postgres-repository';

export function postgresEtapasDependencies(env: AppBindings): EtapasDependencies {
  if (!env.database)
    throw new AppError(
      'DATABASE_NOT_CONFIGURED',
      'La sesión de base de datos no está configurada.',
      503,
    );
  return {
    repository: new PostgresEtapasRepository(env.database.getPool()),
    authorize: (request, role) => request.headers.get('x-role') === role,
  };
}
