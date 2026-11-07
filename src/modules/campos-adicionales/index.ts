export type { AdditionalField } from './domain/model';
export type { CamposAdicionalesRepository } from './application/ports';
export type {
  CamposAdicionalesDependencies,
  CamposAdicionalesDependenciesFactory,
} from './http/controller';
export { createCamposAdicionalesModule } from './module';
export { postgresCamposAdicionalesDependencies } from './factory';
export { PostgresCamposAdicionalesRepository } from './infrastructure/postgres-repository';
