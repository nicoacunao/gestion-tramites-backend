import type { UserRepository } from '../application/ports';
import type { User } from '../domain/user';
import type { TabularDataSource, TabularRow } from '../../../shared/persistence/tabular-repository';
import { NotImplementedAppError } from '../../../shared/errors/app-error';

function text(row: TabularRow, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : String(value ?? '');
}

function nullableText(row: TabularRow, key: string): string | null {
  const value = text(row, key);
  return value || null;
}

function userFromRow(row: TabularRow): User {
  return {
    id: text(row, 'id_usuario'),
    rut: text(row, 'rut'),
    passwordHash: text(row, 'contrasena_hash'),
    names: text(row, 'nombres'),
    firstSurname: text(row, 'primer_apellido'),
    secondSurname: nullableText(row, 'segundo_apellido'),
    email: text(row, 'correo'),
    phone: nullableText(row, 'telefono'),
    description: nullableText(row, 'descripcion'),
    role: text(row, 'rol'),
    organization: nullableText(row, 'organizacion'),
    active: row.flag_activo === true || text(row, 'flag_activo').toUpperCase() === 'TRUE',
    lastSessionAt: nullableText(row, 'fecha_ultima_sesion'),
  };
}

export class ExcelUserRepository implements UserRepository {
  constructor(private readonly source: TabularDataSource) {}

  async findByRut(rut: string): Promise<User | null> {
    const rows = await this.source.readTable('tbl_usuarios');
    const row = rows.find((candidate) => text(candidate, 'rut').trim().toUpperCase() === rut);
    return row ? userFromRow(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.source.findRow('tbl_usuarios', id);
    return row ? userFromRow(row) : null;
  }

  save(_user: User): Promise<void> {
    throw new NotImplementedAppError('identidad.users.save');
  }
}
