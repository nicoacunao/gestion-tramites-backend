import type { GestionesEspecificasRepository } from './ports';

export class GestionesEspecificasService {
  constructor(private readonly repository: GestionesEspecificasRepository) {}
  list(managementTypeId?: string) {
    return this.repository.list(managementTypeId);
  }
}
