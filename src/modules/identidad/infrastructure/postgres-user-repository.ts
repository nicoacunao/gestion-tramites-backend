import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import type { UserRepository } from '../application/ports';
import type { User } from '../domain/user';

const projection = `id_usuario::text AS id, rut, contrasena_hash AS "passwordHash",
  nombres AS names, primer_apellido AS "firstSurname", segundo_apellido AS "secondSurname",
  correo AS email, telefono AS phone, descripcion AS description, rol AS role,
  organizacion AS organization, xmin::text AS version`;
type UserRow = Omit<User, 'active' | 'version'> & { version: string };

function fromRow(row: UserRow): User {
  // Decisión acordada: el esquema no modela desactivación de usuarios.
  return { ...row, active: true, version: Number(row.version) };
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly database: SqlExecutor) {}

  async findByRut(rut: string): Promise<User | null> {
    const result = await this.database.query<UserRow>(
      `SELECT ${projection} FROM usuario WHERE upper(btrim(rut)) = $1`,
      [rut.trim().toUpperCase()],
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

  save(_user: User, _expectedVersion?: number): Promise<void> {
    throw new Error('La modificación de usuarios no está expuesta por el login.');
  }
}
