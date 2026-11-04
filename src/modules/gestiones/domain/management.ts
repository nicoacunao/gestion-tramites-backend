export type ManagementLevel = 'N1' | 'N2' | 'N3' | 'N4';

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
  priority: string;
  requesterName: string;
  status: string | null;
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
