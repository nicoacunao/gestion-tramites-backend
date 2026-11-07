import type { SpecificManagement } from '../domain/model';

export interface GestionesEspecificasRepository {
  list(managementTypeId?: string): Promise<readonly SpecificManagement[]>;
}
