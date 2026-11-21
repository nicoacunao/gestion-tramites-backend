import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import type { UserRepository } from '../application/ports';
import type { User } from '../domain/user';
import { AppError } from '../../../shared/errors/app-error';

const projection = `id_usuario::text AS id, rut, contrasena_hash AS "passwordHash",
  nombres AS names, primer_apellido AS "firstSurname", segundo_apellido AS "secondSurname",
  correo AS email, telefono AS phone, descripcion AS description, rol AS role,
  organizacion AS organization, flag_activo AS active,
  fecha_ultima_sesion::text AS "lastSessionAt"`;
type UserRow = User;

function normalizeRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

function fromRow(row: UserRow): User {
  return row;
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

  async upgradePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.database.query(
      `UPDATE usuario SET contrasena_hash = $2
       WHERE id_usuario = $1::bigint`,
      [id, passwordHash],
    );
  }

  async list(): Promise<readonly User[]> {
    const result = await this.database.query<UserRow>(
      `SELECT ${projection} FROM usuario ORDER BY nombres, primer_apellido, segundo_apellido, id_usuario`,
      [],
    );
    return result.rows.map(fromRow);
  }

  async save(user: User): Promise<void> {
    const result = await this.database.query(
      `UPDATE usuario SET nombres = $2, primer_apellido = $3, segundo_apellido = $4,
        correo = $5, telefono = $6, descripcion = $7
       WHERE id_usuario = $1::bigint
       RETURNING id_usuario`,
      [
        user.id,
        user.names,
        user.firstSurname,
        user.secondSurname,
        user.email,
        user.phone,
        user.description,
      ],
    );
    if (!result.rows[0]) throw new AppError('RESOURCE_NOT_FOUND', 'El usuario no existe.', 404);
  }

  async touchLastSession(id: string): Promise<void> {
    await this.database.query(
      'UPDATE usuario SET fecha_ultima_sesion = now() WHERE id_usuario = $1::bigint',
      [id],
    );
  }
}
