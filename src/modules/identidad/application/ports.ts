import type { AuthSession, User } from '../domain/user';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByRut(rut: string): Promise<User | null>;
  save(user: User, expectedVersion?: number): Promise<void>;
  list?(): Promise<readonly User[]>;
}

export interface PasswordHasher {
  hash(plainText: string): Promise<string>;
  verify(plainText: string, passwordHash: string): Promise<boolean>;
}

export interface SessionIssuer {
  issue(userId: string): Promise<AuthSession>;
}
