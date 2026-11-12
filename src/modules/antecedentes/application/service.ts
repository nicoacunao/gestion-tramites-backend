import type { AntecedentesRepository } from './ports';
import type { BackgroundCategory } from '../domain/model';

export class AntecedentesService {
  constructor(private readonly repository: AntecedentesRepository) {}
  list(category?: BackgroundCategory) {
    return this.repository.listBackgrounds(category);
  }
}
