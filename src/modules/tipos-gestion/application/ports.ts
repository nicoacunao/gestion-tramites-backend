import type { ManagementType } from '../domain/model';

export interface TiposGestionRepository {
  listManagementTypes(): Promise<readonly ManagementType[]>;
}
