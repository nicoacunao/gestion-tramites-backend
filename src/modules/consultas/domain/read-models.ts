export interface ManagementListItem {
  id: string;
  code: string;
  level: string;
  stationId: string;
  commune: string;
  responsibleName: string;
  status: string;
  openedOn: string;
}

export interface StationSummary {
  stationId: string;
  activeCount: number;
  pendingCount: number;
  daysWithoutProgress: number;
  overallStatus: string;
}
