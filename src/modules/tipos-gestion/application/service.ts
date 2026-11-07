import type { TiposGestionRepository } from './ports';

export class TiposGestionService {
  constructor(private readonly repository: TiposGestionRepository) {}
  list() {
    return this.repository.listManagementTypes();
  }
}
