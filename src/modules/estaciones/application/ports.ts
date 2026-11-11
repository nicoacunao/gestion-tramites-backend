import type { Station } from '../domain/station';

export interface StationRepository {
  listStations(): Promise<readonly Station[]>;
  listStationsPage?(page: number, pageSize: number): Promise<StationPage>;
  findStationById(id: string): Promise<Station | null>;
  saveStation(station: Station, expectedVersion?: number): Promise<Station | void>;
  importStations?(stations: readonly Station[]): Promise<StationImportSummary>;
}

export interface StationPage {
  stations: readonly Station[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface StationImportSummary {
  created: number;
  updated: number;
  rejected: number;
  stations: readonly Station[];
}
