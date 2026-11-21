import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import type { LogRepository } from '../application/ports';
import type { LogEntry, LogEntryInput } from '../domain/log-entry';

const TIME_ZONE = 'America/Santiago';
type LogRow = Omit<LogEntry, 'id'> & { id: string };
const projection = `e.id_entrada_bitacora::text AS id, e.id_gestion::text AS "managementId",
  e.id_usuario::text AS "userId", to_char(e.fecha_registro AT TIME ZONE $1, 'YYYY-MM-DD') AS "registeredOn",
  to_char(e.fecha_registro AT TIME ZONE $1, 'HH24:MI:SS') AS "registeredAt",
  e.titulo AS title, e.comentario AS comment, e.tipo AS type`;

export class PostgresLogRepository implements LogRepository {
  constructor(private readonly database: SqlExecutor) {}

  async listByManagement(managementId: string): Promise<readonly LogEntry[]> {
    const result = await this.database.query<LogRow>(
      `SELECT ${projection} FROM entrada_bitacora e
       WHERE e.id_gestion = $2::bigint
       ORDER BY e.fecha_registro DESC, e.id_entrada_bitacora DESC`,
      [TIME_ZONE, managementId],
    );
    return result.rows;
  }

  async findById(id: string): Promise<LogEntry | null> {
    const result = await this.database.query<LogRow>(
      `SELECT ${projection} FROM entrada_bitacora e
       WHERE e.id_entrada_bitacora = $2::bigint`,
      [TIME_ZONE, id],
    );
    return result.rows[0] ?? null;
  }

  async append(entry: LogEntryInput): Promise<LogEntry> {
    const result = await this.database.query<LogRow>(
      `INSERT INTO entrada_bitacora (id_gestion, id_usuario, fecha_registro, titulo, comentario, tipo)
       VALUES ($1::bigint, NULLIF($2, '')::bigint,
         (($3::date + $4::time) AT TIME ZONE $5), $6, $7, $8)
       RETURNING id_entrada_bitacora::text AS id, id_gestion::text AS "managementId",
         id_usuario::text AS "userId", to_char(fecha_registro AT TIME ZONE $5, 'YYYY-MM-DD') AS "registeredOn",
         to_char(fecha_registro AT TIME ZONE $5, 'HH24:MI:SS') AS "registeredAt",
         titulo AS title, comentario AS comment, tipo AS type`,
      [
        entry.managementId,
        entry.userId ?? '',
        entry.registeredOn,
        entry.registeredAt,
        TIME_ZONE,
        entry.title,
        entry.comment,
        entry.type ?? null,
      ],
    );
    if (!result.rows[0]) throw new Error('No se pudo registrar la entrada.');
    return result.rows[0];
  }
}
