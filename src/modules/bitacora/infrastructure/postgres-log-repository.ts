import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import { AppError } from '../../../shared/errors/app-error';
import type { LogRepository } from '../application/ports';
import type { LogEntry } from '../domain/log-entry';

const TIME_ZONE = 'America/Santiago';

interface LogRow {
  internal_id: string;
  codigo_externo: string | null;
  management_code: string;
  user_id: string | null;
  registered_on: string;
  registered_at: string;
  titulo: string;
  comentario: string;
  autor_nombre: string;
  autor_iniciales: string;
  tipo: 'inicio' | 'novedad' | 'seguimiento' | 'contacto' | null;
  automatica: boolean;
  version: string;
}

const SELECT_ENTRY = `
  SELECT e.id_entrada_bitacora::text AS internal_id, e.codigo_externo,
         g.codigo AS management_code, e.id_usuario::text AS user_id,
         to_char(e.fecha_hora AT TIME ZONE $1, 'YYYY-MM-DD') AS registered_on,
         to_char(e.fecha_hora AT TIME ZONE $1, 'HH24:MI:SS') AS registered_at,
         e.titulo, e.comentario, e.autor_nombre, e.autor_iniciales, e.tipo, e.automatica, e.xmin::text AS version
  FROM entrada_bitacora e
  JOIN gestion g ON g.id_gestion = e.id_gestion`;

function fromRow(row: LogRow): LogEntry {
  if (row.codigo_externo === null)
    throw new AppError(
      'BITACORA_EXTERNAL_ID_REQUIRED',
      'Una entrada existente no tiene código externo; debe asignarse antes de exponerla por esta API.',
      409,
      { internalId: row.internal_id },
    );
  return {
    id: row.codigo_externo,
    managementId: row.management_code,
    userId: row.user_id,
    registeredOn: row.registered_on,
    registeredAt: row.registered_at,
    title: row.titulo,
    comment: row.comentario,
    authorName: row.autor_nombre,
    authorInitials: row.autor_iniciales,
    type: row.tipo,
    automatic: row.automatica,
    version: Number(row.version),
  };
}

export class PostgresLogRepository implements LogRepository {
  constructor(private readonly database: SqlExecutor) {}

  async listByManagement(managementId: string): Promise<readonly LogEntry[]> {
    const result = await this.database.query<LogRow>(
      `${SELECT_ENTRY}
       WHERE g.codigo = $2
       ORDER BY e.fecha_hora DESC, e.id_entrada_bitacora DESC`,
      [TIME_ZONE, managementId],
    );
    return result.rows.map(fromRow);
  }

  async findById(id: string): Promise<LogEntry | null> {
    const result = await this.database.query<LogRow>(
      `${SELECT_ENTRY} WHERE e.codigo_externo = $2`,
      [TIME_ZONE, id],
    );
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }

  async append(entry: LogEntry): Promise<void> {
    const reference = await this.database.query<{
      id_gestion: string;
      id_usuario: string;
      autor_nombre: string;
      autor_iniciales: string;
    }>(
      `SELECT g.id_gestion::text, u.id_usuario::text,
              concat_ws(' ', u.nombres, u.primer_apellido, u.segundo_apellido) AS autor_nombre,
              upper(left(u.nombres, 1) || left(u.primer_apellido, 1)) AS autor_iniciales
       FROM gestion g CROSS JOIN usuario u
       WHERE g.codigo = $1 AND u.id_usuario = $2::bigint`,
      [entry.managementId, entry.userId],
    );
    const author = reference.rows[0];
    if (!author)
      throw new AppError(
        'INVALID_LOG_REFERENCE',
        'La gestión o el usuario indicado no existe.',
        422,
      );
    if (
      Array.from(author.autor_nombre).length > 150 ||
      Array.from(author.autor_iniciales).length > 10
    )
      throw new AppError(
        'INVALID_LOG_AUTHOR',
        'El nombre o las iniciales del autor superan el máximo permitido.',
        422,
      );

    const result = await this.database.query<LogRow>(
      `INSERT INTO entrada_bitacora (
         codigo_externo, id_gestion, id_usuario, fecha_hora,
         autor_nombre, autor_iniciales, titulo, comentario
       ) VALUES (
         $1, $2::bigint, $3::bigint, ($4::date + $5::time) AT TIME ZONE $6,
         $7, $8, $9, $10
       )
       RETURNING id_entrada_bitacora::text AS internal_id, codigo_externo,
                 $11::text AS management_code, id_usuario::text AS user_id,
                 to_char(fecha_hora AT TIME ZONE $6, 'YYYY-MM-DD') AS registered_on,
                 to_char(fecha_hora AT TIME ZONE $6, 'HH24:MI:SS') AS registered_at,
                 titulo, comentario, autor_nombre, autor_iniciales, tipo, automatica, xmin::text AS version`,
      [
        entry.id,
        author.id_gestion,
        author.id_usuario,
        entry.registeredOn,
        entry.registeredAt,
        TIME_ZONE,
         author.autor_nombre,
        author.autor_iniciales,
        entry.title,
        entry.comment,
        entry.managementId,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new AppError('BITACORA_INSERT_FAILED', 'No se pudo registrar la entrada.', 500);
    void fromRow(row);
  }
}
