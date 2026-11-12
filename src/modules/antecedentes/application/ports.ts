import type { BackgroundCatalogItem, BackgroundCategory } from '../domain/model';

export interface AntecedentesRepository {
  listBackgrounds(category?: BackgroundCategory): Promise<readonly BackgroundCatalogItem[]>;
}
