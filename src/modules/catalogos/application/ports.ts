import type { ManagementScope, ManagementType, StageCatalogItem, Station } from '../domain/catalog';

export interface CatalogRepository {
  listStations(): Promise<readonly Station[]>;
  findStationById(id: string): Promise<Station | null>;
  saveStation(station: Station): Promise<Station | void>;
  listScopes(): Promise<readonly ManagementScope[]>;
  listManagementTypes(): Promise<readonly ManagementType[]>;
  listStages(): Promise<readonly StageCatalogItem[]>;
}
