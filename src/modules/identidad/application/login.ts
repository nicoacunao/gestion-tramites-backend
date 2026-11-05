import type { AuthSession, User } from '../domain/user';
import type { PasswordHasher, SessionIssuer, UserRepository } from './ports';

export class InvalidCredentialsError extends Error {}

export interface LoginDependencies {
  users: UserRepository;
  passwords: PasswordHasher;
  sessions: SessionIssuer;
}

export interface LoginResult {
  session: AuthSession;
  user: Pick<User, 'id' | 'rut' | 'names' | 'firstSurname' | 'secondSurname' | 'email' | 'role'>;
}

export async function login(
  rut: string,
  password: string,
  dependencies: LoginDependencies,
): Promise<LoginResult> {
  const user = await dependencies.users.findByRut(rut);
  const valid =
    user !== null &&
    user.active &&
    (await dependencies.passwords.verify(password, user.passwordHash));

  if (!valid || user === null) throw new InvalidCredentialsError();

  return {
    session: await dependencies.sessions.issue(user.id),
    user: {
      id: user.id,
      rut: user.rut,
      names: user.names,
      firstSurname: user.firstSurname,
      secondSurname: user.secondSurname,
      email: user.email,
      role: user.role,
    },
  };
}
