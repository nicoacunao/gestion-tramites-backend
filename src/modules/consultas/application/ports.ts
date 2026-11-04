import type { ManagementListItem, StationSummary } from '../domain/read-models';

export interface ManagementQueries {
  listAssignedTo(userId: string): Promise<readonly ManagementListItem[]>;
  listAll(): Promise<readonly ManagementListItem[]>;
  summarizeStations(): Promise<readonly StationSummary[]>;
}
