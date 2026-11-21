import type { GestionesEspecificasRepository } from './ports';

export class GestionesEspecificasService {
  constructor(private readonly repository: GestionesEspecificasRepository) {}
  list(managementId: string) {
    return this.repository.list(managementId);
  }
}
