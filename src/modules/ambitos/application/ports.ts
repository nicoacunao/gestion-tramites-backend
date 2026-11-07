import type { ManagementScope } from '../domain/model';

export interface AmbitosRepository {
  listScopes(): Promise<readonly ManagementScope[]>;
}
