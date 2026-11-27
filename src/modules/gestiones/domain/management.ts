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
  scopeCode?: string | null;
  level?: ManagementLevel | null;
  sequence?: number | null;
  stationName?: string | null;
  legalName?: string | null;
  responsibleName?: string | null;
  managementTypeName?: string | null;
  scopeName?: string | null;
  code?: string | null;
  trafficLight?: 'al-dia' | 'proximo-vencer' | 'atrasado';
  trafficLightLabel?: string;
  codigo?: string | null;
  nivel?: ManagementLevel | null;
  ambito?: string | null;
  codigoAmbito?: string | null;
  correlativo?: number | null;
  semaforo?: 'al-dia' | 'proximo-vencer' | 'atrasado';
  semaforoEtiqueta?: string;
  commune?: string | null;
  address?: string | null;
  legalRut?: string | null;
  legalRepresentative?: string | null;
  legalRepresentativeRut?: string | null;
}

export interface ManagementSpecific {
  id: string;
  managementId: string;
  parentSpecificManagementId: string | null;
  managementTypeId: string;
  managementTypeName: string;
  level: number;
  required: boolean;
  responsibleUserId: string;
  responsibleName: string;
  status: string;
  fileUrl: string | null;
  uploadedAt: string;
}

export interface ManagementSpecificCreateInput {
  managementTypeId: string;
  responsibleUserId?: string | null;
  status?: string;
  fileReference?: string | null;
}

export interface ManagementSpecificUpdateInput {
  responsibleUserId: string | null;
  status: string;
  fileReference: string | null;
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

export interface ManagementStageUpdateInput {
  status: string;
  estimatedOn: string | null;
  completedOn: string | null;
  responsibleUserId: string | null;
  notes: string | null;
}

export type ManagementInput = Omit<Management, 'id'> & { id?: string };
