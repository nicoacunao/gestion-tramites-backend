import type {
  Management,
  ManagementInput,
  ManagementBackground,
  ManagementBackgroundCreateInput,
  CompleteManagementInput,
  ManagementStage,
  ManagementStageCreateInput,
} from '../domain/management';

export interface ManagementRepository {
  list(responsibleUserId?: string): Promise<readonly Management[]>;
  findById(id: string): Promise<Management | null>;
  save(management: ManagementInput, expectedVersion?: number): Promise<Management | void>;
  listStages(managementId: string): Promise<readonly ManagementStage[]>;
  createStage?(managementId: string, input: ManagementStageCreateInput): Promise<ManagementStage>;
  findStage?(id: string): Promise<ManagementStage | null>;
  createComplete?(input: CompleteManagementInput): Promise<Management>;
  createBackground?(
    managementId: string,
    input: ManagementBackgroundCreateInput,
  ): Promise<ManagementBackground>;
  listBackgrounds?(managementId: string): Promise<readonly ManagementBackground[]>;
  updateBackground?(
    id: string,
    input: ManagementBackground,
    expectedVersion: number,
  ): Promise<ManagementBackground>;
  updateStage?(
    id: string,
    input: ManagementStage,
    expectedVersion: number,
  ): Promise<ManagementStage>;
}
