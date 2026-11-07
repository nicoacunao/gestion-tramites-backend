import type { StageCatalogItem } from '../domain/model';

export interface EtapasRepository {
  listStages(): Promise<readonly StageCatalogItem[]>;
}
