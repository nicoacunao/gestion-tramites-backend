import type { AppBindings } from '../../shared/config/bindings';
import { AppError } from '../../shared/errors/app-error';
import type { ArchivosDependencies } from './http/router';
import { OneDriveStorage } from './infrastructure/onedrive-storage';
import { PostgresFileRepository } from './infrastructure/postgres-file-repository';

export function postgresArchivosDependencies(env: AppBindings): ArchivosDependencies {
  if (!env.database)
    throw new AppError('DATABASE_NOT_CONFIGURED', 'No hay sesión de base de datos.', 503);
  return {
    repository: new PostgresFileRepository(env.database.getPool()),
    storage: new OneDriveStorage(env),
  };
}
