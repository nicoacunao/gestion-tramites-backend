export interface SpecificManagement {
  id: string;
  managementId: string;
  managementTypeId: string;
  managementTypeName: string;
  level: number;
  responsibleUserId: string;
  responsibleName: string;
  status: string;
  fileUrl: string | null;
  uploadedAt: string;
}
