import type { TabularDataSource, TabularRow } from '../../../shared/persistence/tabular-repository';
import type { ManagementRepository } from '../application/ports';
import type { Management, ManagementPriority, ManagementStatus } from '../domain/management';

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

function managementFromRow(row: TabularRow): Management {
  return {
    id: text(row, 'id_gestion'),
    stationId: text(row, 'id_estacion'),
    managementTypeId: text(row, 'id_tipo_gestion'),
    scopeCode: text(row, 'codigo_ambito'),
    responsibleUserId: text(row, 'id_usuario_responsable'),
    level: text(row, 'nivel') as Management['level'],
    sequence: numberValue(row, 'correlativo'),
    openedOn: text(row, 'fecha_apertura'),
    estimatedCompletionOn: nullableText(row, 'fecha_estimada_termino'),
    lastReviewedOn: nullableText(row, 'fecha_ultima_revision'),
    priority: text(row, 'prioridad') as ManagementPriority,
    requesterName: text(row, 'nombre_solicitante'),
    status: nullableText(row, 'estado') as ManagementStatus | null,
    version: numberValue(row, 'version'),
  };
}

function managementToRow(management: Management): TabularRow {
  return {
    id_gestion: management.id,
    id_estacion: management.stationId,
    id_tipo_gestion: management.managementTypeId,
    codigo_ambito: management.scopeCode,
    id_usuario_responsable: management.responsibleUserId,
    nivel: management.level,
    correlativo: management.sequence,
    fecha_apertura: management.openedOn,
    fecha_estimada_termino: management.estimatedCompletionOn,
    fecha_ultima_revision: management.lastReviewedOn,
    prioridad: management.priority,
    nombre_solicitante: management.requesterName,
    estado: management.status,
    version: management.version,
  };
}

export class ExcelManagementRepository implements ManagementRepository {
  constructor(private readonly source: TabularDataSource) {}

  async list(): Promise<readonly Management[]> {
    return (await this.source.readTable('tbl_gestiones')).map(managementFromRow);
  }

  async findById(id: string): Promise<Management | null> {
    const row = await this.source.findRow('tbl_gestiones', id);
    return row ? managementFromRow(row) : null;
  }

  async save(management: Management, expectedVersion?: number): Promise<void> {
    await this.source.upsertRow('tbl_gestiones', managementToRow(management), expectedVersion);
  }

  async listBackgrounds(): Promise<readonly never[]> {
    return [];
  }

  async listStages(): Promise<readonly never[]> {
    return [];
  }
}
