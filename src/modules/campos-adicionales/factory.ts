import type { AppBindings } from '../../shared/config/bindings';
import { AppError } from '../../shared/errors/app-error';
import type { CamposAdicionalesDependencies } from './http/controller';
import { PostgresCamposAdicionalesRepository } from './infrastructure/postgres-repository';
export function postgresCamposAdicionalesDependencies(
  env: AppBindings,
): CamposAdicionalesDependencies {
  if (!env.database)
    throw new AppError(
      'DATABASE_NOT_CONFIGURED',
      'La sesión de base de datos no está configurada.',
      503,
    );
  return {
    repository: new PostgresCamposAdicionalesRepository(env.database.getPool()),
    authorize: (request, role) => request.headers.get('x-role') === role,
  };
}
