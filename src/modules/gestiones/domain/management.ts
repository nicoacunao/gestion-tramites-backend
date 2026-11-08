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
  stationName?: string | null | undefined;
  legalName?: string | null | undefined;
  responsibleName?: string | null | undefined;
  managementTypeName?: string | null | undefined;
  managementTypeCode?: string | null | undefined;
  creationMode?: 'principal' | 'subtramite' | undefined;
  specificManagementId?: string | null | undefined;
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

export interface ManagementBackgroundCreateInput {
  backgroundId?: string | null;
  parentBackgroundId?: string | null;
  name: string;
  category: 'requerido' | 'complementario' | 'adicional';
  required: boolean;
  requestedBy?: string | null;
  responsibleUserId?: string | null;
  responsibleName?: string | null;
  status?: 'Pendiente' | 'Recibido' | 'Recibido conforme';
  observations?: string | null;
  fileName?: string | null;
  fileReference?: string | null;
}

export interface ManagementStageCreateInput {
  stageId?: string | null;
  name: string;
  status?: 'Pendiente' | 'En curso' | 'Completado';
  estimatedOn?: string | null;
  completedOn?: string | null;
  responsibleUserId?: string | null;
  responsibleName?: string | null;
  notes?: string | null;
}

export interface ManagementAdditionalDataCreateInput {
  fieldId?: string | null;
  fieldCode?: string | null;
  value: string;
}

export interface CompleteManagementInput extends ManagementInput {
  creationMode: 'principal' | 'subtramite';
  specificManagementId?: string | null;
  associatedSpecificManagementIds?: string[];
  requiredBackgrounds?: ManagementBackgroundCreateInput[];
  complementaryBackgrounds?: ManagementBackgroundCreateInput[];
  stages?: ManagementStageCreateInput[];
  additionalData?: ManagementAdditionalDataCreateInput[];
}

export type ManagementInput = Omit<Management, 'version'> & { version?: number };
