export interface ManagementType {
  id: string;
  parentId: string | null;
  scopeId: string | null;
  name: string;
  level: number;
  required: boolean;
}
