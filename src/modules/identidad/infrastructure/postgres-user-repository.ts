import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import type { UserRepository } from '../application/ports';
import type { User } from '../domain/user';
import { AppError } from '../../../shared/errors/app-error';

const projection = `id_usuario::text AS id, rut, contrasena_hash AS "passwordHash",
  nombres AS names, primer_apellido AS "firstSurname", segundo_apellido AS "secondSurname",
  correo AS email, telefono AS phone, descripcion AS description, rol AS role,
  organizacion AS organization, xmin::text AS version`;
type UserRow = Omit<User, 'active' | 'version'> & { version: string };

function normalizeRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

function fromRow(row: UserRow): User {
  // Decisión acordada: el esquema no modela desactivación de usuarios.
  return { ...row, active: true, version: Number(row.version) };
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly database: SqlExecutor) {}

  async findByRut(rut: string): Promise<User | null> {
    const result = await this.database.query<UserRow>(
      `SELECT ${projection} FROM usuario
       WHERE regexp_replace(upper(btrim(rut)), '[^0-9K]', '', 'g') = $1`,
      [normalizeRut(rut)],
    );
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.database.query<UserRow>(
      `SELECT ${projection} FROM usuario WHERE id_usuario = $1::bigint`,
      [id],
    );
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }

  async upgradePasswordHash(
    id: string,
    passwordHash: string,
    expectedVersion?: number,
  ): Promise<void> {
    await this.database.query(
      `UPDATE usuario SET contrasena_hash = $2
       WHERE id_usuario = $1::bigint AND ($3::text IS NULL OR xmin::text = $3)`,
      [id, passwordHash, expectedVersion === undefined ? null : String(expectedVersion)],
    );
  }

  async list(): Promise<readonly User[]> {
    const result = await this.database.query<UserRow>(
      `SELECT ${projection} FROM usuario ORDER BY nombres, primer_apellido, segundo_apellido, id_usuario`,
      [],
    );
    return result.rows.map(fromRow);
  }

  async save(user: User, expectedVersion?: number): Promise<void> {
    const result = await this.database.query(
      `UPDATE usuario SET nombres = $2, primer_apellido = $3, segundo_apellido = $4,
        correo = $5, telefono = $6, descripcion = $7
       WHERE id_usuario = $1::bigint AND ($8::text IS NULL OR xmin::text = $8)
       RETURNING id_usuario`,
      [
        user.id,
        user.names,
        user.firstSurname,
        user.secondSurname,
        user.email,
        user.phone,
        user.description,
        expectedVersion === undefined ? null : String(expectedVersion),
      ],
    );
    if (!result.rows[0])
      throw new AppError('VERSION_CONFLICT', 'El usuario fue modificado por otro usuario.', 409);
  }
}
