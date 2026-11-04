export interface FileRecord {
  id: string;
  managementId: string;
  managementBackgroundId: string | null;
  storageProvider: string;
  storageReference: string;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  uploadedByUserId: string;
  uploadedAt: string;
  version: number;
}
