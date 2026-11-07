import { AppError } from '../../shared/errors/app-error';
import type { AppBindings } from '../../shared/config/bindings';
import type { LoginDependencies } from './application/login';
import { PostgresUserRepository } from './infrastructure/postgres-user-repository';
import { Pbkdf2PasswordHasher } from './infrastructure/password-hasher';
import { HmacSessionIssuer } from './infrastructure/session-issuer';

export function postgresIdentityDependencies(env: AppBindings): LoginDependencies {
  if (!env.AUTH_TOKEN_SECRET || !env.database)
    throw new AppError(
      'IDENTITY_NOT_CONFIGURED',
      'La persistencia de identidad no está configurada.',
      503,
    );
  return {
    users: new PostgresUserRepository(env.database.getPool()),
    passwords: new Pbkdf2PasswordHasher(),
    sessions: new HmacSessionIssuer(env.AUTH_TOKEN_SECRET),
  };
}
