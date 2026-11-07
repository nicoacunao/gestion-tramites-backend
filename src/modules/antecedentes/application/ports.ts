import type { BackgroundCatalogItem } from '../domain/model';

export interface AntecedentesRepository {
  listBackgrounds(): Promise<readonly BackgroundCatalogItem[]>;
}
