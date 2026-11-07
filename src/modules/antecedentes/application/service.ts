import type { AntecedentesRepository } from './ports';

export class AntecedentesService {
  constructor(private readonly repository: AntecedentesRepository) {}
  list() {
    return this.repository.listBackgrounds();
  }
}
