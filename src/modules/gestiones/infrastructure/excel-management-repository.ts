import type { TabularDataSource, TabularRow } from '../../../shared/persistence/tabular-repository';
import type { ManagementRepository } from '../application/ports';
import type { Management, ManagementInput } from '../domain/management';

const text = (row: TabularRow, key: string) => String(row[key] ?? '').trim();
const nullable = (row: TabularRow, key: string) => text(row, key) || null;

function fromRow(row: TabularRow): Management {
  return {
    id: text(row, 'id_gestion'),
    stationId: text(row, 'id_estacion'),
    responsibleUserId: text(row, 'id_usuario_responsable'),
    createdAt: text(row, 'fecha_creacion'),
    openedOn: text(row, 'fecha_apertura'),
    estimatedCompletionOn: nullable(row, 'fecha_estimada_termino'),
    lastReviewedOn: nullable(row, 'fecha_ultima_revision'),
    priority: text(row, 'prioridad') as Management['priority'],
    status: text(row, 'estado') as Management['status'],
    requesterName: text(row, 'nombre_solicitante'),
  };
}

function toRow(input: ManagementInput): TabularRow {
  return {
    id_gestion: input.id ?? '',
    id_estacion: input.stationId,
    id_usuario_responsable: input.responsibleUserId,
    fecha_apertura: input.openedOn,
    fecha_estimada_termino: input.estimatedCompletionOn,
    fecha_ultima_revision: input.lastReviewedOn,
    prioridad: input.priority,
    estado: input.status,
    nombre_solicitante: input.requesterName,
  };
}

export class ExcelManagementRepository implements ManagementRepository {
  constructor(private readonly source: TabularDataSource) {}
  async list(responsibleUserId?: string): Promise<readonly Management[]> {
    const rows = (await this.source.readTable('tbl_gestiones')).map(fromRow);
    return responsibleUserId
      ? rows.filter((row) => row.responsibleUserId === responsibleUserId)
      : rows;
  }
  async findById(id: string): Promise<Management | null> {
    const row = await this.source.findRow('tbl_gestiones', id);
    return row ? fromRow(row) : null;
  }
  async save(input: ManagementInput): Promise<Management> {
    const row = toRow(input);
    await this.source.upsertRow('tbl_gestiones', row);
    return fromRow(row);
  }
  async listStages(): Promise<readonly never[]> {
    return [];
  }
}
