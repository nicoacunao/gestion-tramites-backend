import type { EtapasRepository } from './ports';

export class EtapasService {
  constructor(private readonly repository: EtapasRepository) {}
  list() {
    return this.repository.listStages();
  }
}
