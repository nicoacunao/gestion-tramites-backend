import type {
  CompleteManagementInput,
  Management,
  ManagementBackground,
  ManagementBackgroundCreateInput,
  ManagementStage,
  ManagementStageCreateInput,
} from '../domain/management';

export interface ManagementRepository {
  list(responsibleUserId?: string): Promise<readonly Management[]>;
  findById(id: string): Promise<Management | null>;
  save(management: Management, expectedVersion?: number): Promise<void>;
  listBackgrounds(managementId: string): Promise<readonly ManagementBackground[]>;
  listStages(managementId: string): Promise<readonly ManagementStage[]>;
  findBackground?(id: string): Promise<ManagementBackground | null>;
  findStage?(id: string): Promise<ManagementStage | null>;
  createComplete?(input: CompleteManagementInput): Promise<Management>;
  createBackground?(
    managementId: string,
    input: ManagementBackgroundCreateInput,
  ): Promise<ManagementBackground>;
  createStage?(managementId: string, input: ManagementStageCreateInput): Promise<ManagementStage>;
  updateBackground?(
    id: string,
    input: Omit<ManagementBackground, 'id' | 'version'>,
    expectedVersion: number,
  ): Promise<ManagementBackground>;
  updateStage?(
    id: string,
    input: Omit<ManagementStage, 'id' | 'version' | 'stageName' | 'percentage'>,
    expectedVersion: number,
  ): Promise<ManagementStage>;
}
