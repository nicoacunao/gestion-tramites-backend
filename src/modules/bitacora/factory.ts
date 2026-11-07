import { AppError } from '../../shared/errors/app-error';
import type { AppBindings } from '../../shared/config/bindings';
import { PostgresLogRepository } from './infrastructure/postgres-log-repository';
import type { BitacoraDependencies } from './http/controller';

export function postgresBitacoraDependencies(env: AppBindings): BitacoraDependencies {
  if (!env.database)
    throw new AppError(
      'DATABASE_NOT_CONFIGURED',
      'La sesión de base de datos no está configurada.',
      503,
    );
  return { repository: new PostgresLogRepository(env.database.getPool()) };
}
