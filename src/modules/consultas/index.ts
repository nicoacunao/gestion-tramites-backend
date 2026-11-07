export type { ManagementQueries } from './application/ports';
export type { ManagementListItem, StationSummary } from './domain/read-models';
export { consultasModule } from './health/router';
export { createConsultasModule } from './http/router';
export { postgresConsultasDependencies } from './factory';
