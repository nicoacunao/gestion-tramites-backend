export type { ManagementType } from './domain/model';
export type { TiposGestionRepository } from './application/ports';
export type { TiposGestionDependencies, TiposGestionDependenciesFactory } from './http/controller';
export { createTiposGestionModule } from './module';
export { postgresTiposGestionDependencies } from './factory';
export { PostgresTiposGestionRepository } from './infrastructure/postgres-repository';
