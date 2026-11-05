export type ManagementLevel = 'N1' | 'N2' | 'N3' | 'N4';
export type ManagementPriority = 'Alta' | 'Media' | 'Baja';
export type ManagementStatus =
  | 'Borrador'
  | 'Pendiente'
  | 'Ingresado'
  | 'En tramitación'
  | 'Observado'
  | 'Reingresado'
  | 'Rechazado'
  | 'Terminado aprobado'
  | 'Terminado desfavorable';

export interface Management {
  id: string;
  stationId: string;
  managementTypeId: string;
  scopeCode: string;
  responsibleUserId: string;
  level: ManagementLevel;
  sequence: number;
  openedOn: string;
  estimatedCompletionOn: string | null;
  lastReviewedOn: string | null;
  priority: ManagementPriority;
  requesterName: string;
  status: ManagementStatus | null;
  version: number;
}

export interface ManagementBackground {
  id: string;
  managementId: string;
  parentManagementBackgroundId: string | null;
  managementTypeId: string;
  backgroundId: string;
  level: Exclude<ManagementLevel, 'N1'>;
  required: boolean;
  responsibleUserId: string;
  status: string;
  fileReference: string | null;
  uploadedAt: string | null;
  version: number;
}

export interface ManagementStage {
  id: string;
  managementId: string;
  stageId: string;
  status: string;
  estimatedOn: string | null;
  completedOn: string | null;
  responsible: string | null;
  notes: string | null;
  version: number;
}
