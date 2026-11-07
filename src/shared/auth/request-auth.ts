import { AppError } from '../errors/app-error';
import type { AppBindings } from '../config/bindings';
import { PostgresUserRepository } from '../../modules/identidad/infrastructure/postgres-user-repository';
import { HmacSessionVerifier } from '../../modules/identidad/infrastructure/session-issuer';
import type { User } from '../../modules/identidad/domain/user';

export async function authenticatedUser(request: Request, env: AppBindings): Promise<User> {
  if (!env.AUTH_TOKEN_SECRET || !env.database)
    throw new AppError('IDENTITY_NOT_CONFIGURED', 'La autenticación no está configurada.', 503);
  const value = request.headers.get('authorization');
  if (!value?.startsWith('Bearer '))
    throw new AppError('UNAUTHORIZED', 'Debes enviar un bearer token válido.', 401);
  const userId = await new HmacSessionVerifier(env.AUTH_TOKEN_SECRET).verify(value.slice(7));
  if (!userId) throw new AppError('UNAUTHORIZED', 'La sesión no es válida.', 401);
  const user = await new PostgresUserRepository(env.database.getPool()).findById(userId);
  if (!user || !user.active)
    throw new AppError('UNAUTHORIZED', 'La sesión no es válida o el usuario está inactivo.', 401);
  return user;
}

export async function authorizeRequest(
  request: Request,
  env: AppBindings,
  requiredRole: string,
): Promise<boolean> {
  try {
    const user = await authenticatedUser(request, env);
    return user.role === requiredRole || user.role === 'Administrador';
  } catch (error) {
    if (error instanceof AppError && error.status === 403) return false;
    return false;
  }
}
