export type { ManagementScope } from './domain/model';
export type { AmbitosRepository } from './application/ports';
export type { AmbitosDependencies, AmbitosDependenciesFactory } from './http/controller';
export { createAmbitosModule } from './module';
export { postgresAmbitosDependencies } from './factory';
export { PostgresAmbitosRepository } from './infrastructure/postgres-repository';
