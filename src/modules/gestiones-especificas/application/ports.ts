import type { SpecificManagement } from '../domain/model';

export interface GestionesEspecificasRepository {
  list(managementId: string): Promise<readonly SpecificManagement[]>;
}
