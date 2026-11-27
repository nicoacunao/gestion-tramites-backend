import type {
  Management,
  ManagementInput,
  ManagementStage,
  ManagementStageCreateInput,
  ManagementStageUpdateInput,
  ManagementSpecific,
  ManagementSpecificCreateInput,
  ManagementSpecificUpdateInput,
} from '../domain/management';

export interface ManagementRepository {
  list(responsibleUserId?: string): Promise<readonly Management[]>;
  findById(id: string): Promise<Management | null>;
  save(management: ManagementInput, expectedVersion?: number): Promise<Management | void>;
  listStages(managementId: string): Promise<readonly ManagementStage[]>;
  listSpecifics?(managementId: string): Promise<readonly ManagementSpecific[]>;
  createSpecific?(
    managementId: string,
    input: ManagementSpecificCreateInput,
  ): Promise<ManagementSpecific>;
  findSpecific?(id: string): Promise<ManagementSpecific | null>;
  updateSpecific?(id: string, input: ManagementSpecificUpdateInput): Promise<ManagementSpecific>;
  createStage?(managementId: string, input: ManagementStageCreateInput): Promise<ManagementStage>;
  findStage?(id: string): Promise<ManagementStage | null>;
  updateStage?(id: string, input: ManagementStageUpdateInput): Promise<ManagementStage>;
}
