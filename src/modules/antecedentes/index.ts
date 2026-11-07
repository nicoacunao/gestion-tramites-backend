export type { BackgroundCatalogItem } from './domain/model';
export type { AntecedentesRepository } from './application/ports';
export type { AntecedentesDependencies, AntecedentesDependenciesFactory } from './http/controller';
export { createAntecedentesModule } from './module';
export { postgresAntecedentesDependencies } from './factory';
export { PostgresAntecedentesRepository } from './infrastructure/postgres-repository';
