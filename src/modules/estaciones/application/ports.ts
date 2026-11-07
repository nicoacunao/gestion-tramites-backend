import type { Station } from '../domain/station';

export interface StationRepository {
  listStations(): Promise<readonly Station[]>;
  findStationById(id: string): Promise<Station | null>;
  saveStation(station: Station, expectedVersion?: number): Promise<Station | void>;
}
