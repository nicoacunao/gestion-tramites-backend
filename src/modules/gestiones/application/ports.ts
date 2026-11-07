import type { Management, ManagementBackground, ManagementStage } from '../domain/management';

export interface ManagementRepository {
  list(): Promise<readonly Management[]>;
  findById(id: string): Promise<Management | null>;
  save(management: Management, expectedVersion?: number): Promise<void>;
  listBackgrounds(managementId: string): Promise<readonly ManagementBackground[]>;
  listStages(managementId: string): Promise<readonly ManagementStage[]>;
  updateBackground?(
    id: string,
    input: Omit<ManagementBackground, 'id' | 'version'>,
    expectedVersion: number,
  ): Promise<ManagementBackground>;
  updateStage?(
    id: string,
    input: Omit<ManagementStage, 'id' | 'version'>,
    expectedVersion: number,
  ): Promise<ManagementStage>;
}
