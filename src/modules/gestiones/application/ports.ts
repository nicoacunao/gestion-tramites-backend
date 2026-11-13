import type {
  CompleteManagementInput,
  Management,
  ManagementBackground,
  ManagementBackgroundCreateInput,
  ManagementStage,
  ManagementStageCreateInput,
} from '../domain/management';

export interface ManagementRepository {
  list(): Promise<readonly Management[]>;
  findById(id: string): Promise<Management | null>;
  save(management: Management, expectedVersion?: number): Promise<void>;
  listBackgrounds(managementId: string): Promise<readonly ManagementBackground[]>;
  listStages(managementId: string): Promise<readonly ManagementStage[]>;
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
