export type ManagementPriority = 'Alta' | 'Media' | 'Baja';
export type ManagementLevel = 'N1' | 'N2' | 'N3' | 'N4';
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
  responsibleUserId: string;
  createdAt?: string;
  openedOn: string;
  estimatedCompletionOn: string | null;
  lastReviewedOn: string | null;
  priority: ManagementPriority;
  status: ManagementStatus;
  requesterName: string;
  version?: number;
  managementTypeId?: string;
  scopeCode?: string;
  level?: ManagementLevel;
  sequence?: number;
  stationName?: string | null;
  legalName?: string | null;
  responsibleName?: string | null;
  commune?: string | null;
  address?: string | null;
  legalRut?: string | null;
  legalRepresentative?: string | null;
  legalRepresentativeRut?: string | null;
}

export interface ManagementStage {
  id: string;
  managementId: string;
  stageId: string;
  stageName: string;
  percentage: number;
  status: string;
  estimatedOn: string | null;
  completedOn: string | null;
  responsible: string | null;
  responsibleUserId: string | null;
  notes: string | null;
}

export interface ManagementStageCreateInput {
  stageId?: string | null;
  name: string;
  status?: string;
  estimatedOn?: string | null;
  completedOn?: string | null;
  responsibleUserId?: string | null;
  responsibleName?: string | null;
  notes?: string | null;
}

export interface ManagementBackground {
  id: string;
  managementId: string;
  parentManagementBackgroundId: string | null;
  managementTypeId: string;
  backgroundId: string;
  level: Exclude<ManagementLevel, 'N1'>;
  required: boolean;
  responsibleUserId: string | null;
  status: string;
  fileReference: string | null;
  uploadedAt: string | null;
  version: number;
}

export interface ManagementBackgroundCreateInput extends Partial<
  Omit<ManagementBackground, 'id' | 'version'>
> {
  name: string;
  category?: 'requerido' | 'complementario' | 'adicional';
  parentBackgroundId?: string | null;
}

export type CompleteManagementInput = ManagementInput & {
  creationMode?: 'principal' | 'subtramite';
  specificManagementId?: string | null;
};

export type ManagementInput = Omit<Management, 'id'> & { id?: string };
