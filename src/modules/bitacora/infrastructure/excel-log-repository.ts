import type { TabularDataSource, TabularRow } from '../../../shared/persistence/tabular-repository';
import type { LogRepository } from '../application/ports';
import type { LogEntry, LogEntryInput } from '../domain/log-entry';

const text = (row: TabularRow, key: string) => String(row[key] ?? '').trim();

function fromRow(row: TabularRow): LogEntry {
  return {
    id: text(row, 'id_entrada_bitacora'),
    managementId: text(row, 'id_gestion'),
    userId: text(row, 'id_usuario') || null,
    registeredOn: text(row, 'fecha_registro'),
    registeredAt: text(row, 'hora_registro'),
    title: text(row, 'titulo'),
    comment: text(row, 'comentario'),
    type: (text(row, 'tipo') || null) as LogEntry['type'],
  };
}

export class ExcelLogRepository implements LogRepository {
  constructor(private readonly source: TabularDataSource) {}
  async listByManagement(managementId: string): Promise<readonly LogEntry[]> {
    return (await this.source.readTable('tbl_entradas_bitacora'))
      .map(fromRow)
      .filter((entry) => entry.managementId === managementId);
  }
  async findById(id: string): Promise<LogEntry | null> {
    const row = await this.source.findRow('tbl_entradas_bitacora', id);
    return row ? fromRow(row) : null;
  }
  async append(input: LogEntryInput): Promise<LogEntry> {
    const row: TabularRow = {
      id_entrada_bitacora: '',
      id_gestion: input.managementId,
      id_usuario: input.userId,
      fecha_registro: input.registeredOn ?? '',
      hora_registro: input.registeredAt ?? '',
      titulo: input.title,
      comentario: input.comment,
      tipo: input.type,
    };
    await this.source.upsertRow('tbl_entradas_bitacora', row);
    return fromRow(row);
  }
}
