export type { SpecificManagement } from './domain/model';
export type { GestionesEspecificasRepository } from './application/ports';
export type {
  GestionesEspecificasDependencies,
  GestionesEspecificasDependenciesFactory,
} from './http/controller';
export { createGestionesEspecificasModule } from './module';
export { postgresGestionesEspecificasDependencies } from './factory';
export { PostgresGestionesEspecificasRepository } from './infrastructure/postgres-repository';
