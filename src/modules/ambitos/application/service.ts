import type { AmbitosRepository } from './ports';

export class AmbitosService {
  constructor(private readonly repository: AmbitosRepository) {}
  list() {
    return this.repository.listScopes();
  }
}
