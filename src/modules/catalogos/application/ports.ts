import type {
  BackgroundCatalogItem,
  ManagementScope,
  ManagementType,
  StageCatalogItem,
  Station,
} from '../domain/catalog';

export interface CatalogRepository {
  listStations(): Promise<readonly Station[]>;
  findStationById(id: string): Promise<Station | null>;
  saveStation(station: Station, expectedVersion?: number): Promise<Station | void>;
  listScopes(): Promise<readonly ManagementScope[]>;
  listManagementTypes(): Promise<readonly ManagementType[]>;
  listBackgrounds(): Promise<readonly BackgroundCatalogItem[]>;
  listStages(): Promise<readonly StageCatalogItem[]>;
}
