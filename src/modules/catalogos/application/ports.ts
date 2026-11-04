import type {
  BackgroundCatalogItem,
  ManagementScope,
  ManagementType,
  ManagementTypeRelation,
  StageCatalogItem,
  Station,
} from '../domain/catalog';

export interface CatalogRepository {
  listStations(): Promise<readonly Station[]>;
  listScopes(): Promise<readonly ManagementScope[]>;
  listManagementTypes(): Promise<readonly ManagementType[]>;
  listTypeRelations(): Promise<readonly ManagementTypeRelation[]>;
  listBackgrounds(): Promise<readonly BackgroundCatalogItem[]>;
  listStages(): Promise<readonly StageCatalogItem[]>;
}
