import type { TabularDataSource, TabularRow } from '../../../shared/persistence/tabular-repository';
import type { LogRepository } from '../application/ports';
import type { LogEntry } from '../domain/log-entry';

function text(row: TabularRow, key: string): string {
  return String(row[key] ?? '').trim();
}

function nullableText(row: TabularRow, key: string): string | null {
  const value = text(row, key);
  return value || null;
}

function numberValue(row: TabularRow, key: string): number {
  return typeof row[key] === 'number' ? row[key] : Number(row[key] ?? 0);
}

function fromRow(row: TabularRow): LogEntry {
  return {
    id: text(row, 'id_entrada_bitacora'),
    managementId: text(row, 'id_gestion'),
    userId: nullableText(row, 'id_usuario'),
    registeredOn: text(row, 'fecha_registro'),
    registeredAt: text(row, 'hora_registro'),
    title: text(row, 'titulo'),
    comment: text(row, 'comentario'),
    version: numberValue(row, 'version'),
  };
}

function toRow(entry: LogEntry): TabularRow {
  return {
    id_entrada_bitacora: entry.id,
    id_gestion: entry.managementId,
    id_usuario: entry.userId,
    fecha_registro: entry.registeredOn,
    hora_registro: entry.registeredAt,
    titulo: entry.title,
    comentario: entry.comment,
    version: entry.version,
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

  async append(input: LogEntry): Promise<void> {
    const entry = { ...input, version: 1 };
    await this.source.upsertRow('tbl_entradas_bitacora', toRow(entry));
  }
}
