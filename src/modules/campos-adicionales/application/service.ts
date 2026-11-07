import type { CamposAdicionalesRepository } from './ports';

export class CamposAdicionalesService {
  constructor(private readonly repository: CamposAdicionalesRepository) {}
  list(managementTypeId?: string) {
    return this.repository.list(managementTypeId);
  }
}
