import type { AdditionalField } from '../domain/model';

export interface CamposAdicionalesRepository {
  list(managementTypeId?: string): Promise<readonly AdditionalField[]>;
}
