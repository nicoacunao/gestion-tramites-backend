import type { ManagementListItem, StationSummary } from '../domain/read-models';
import type { StationRepository } from '../../estaciones/application/ports';

export interface ConsultasDependencies {
  queries: ManagementQueries;
  stations: StationRepository;
  authorize: (request: Request, requiredRole: string) => boolean | Promise<boolean>;
}

export interface ManagementQueries {
  listAssignedTo(userId: string): Promise<readonly ManagementListItem[]>;
  listAll(): Promise<readonly ManagementListItem[]>;
  summarizeStations(): Promise<readonly StationSummary[]>;
}
