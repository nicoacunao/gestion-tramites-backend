import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../../../shared/config/bindings';
import { createEstacionesModule } from '../../estaciones';
import { createAmbitosModule } from '../../ambitos';
import { createTiposGestionModule } from '../../tipos-gestion';
import { createAntecedentesModule } from '../../antecedentes';
import { createEtapasModule } from '../../etapas';
import type { CatalogRepository } from '../application/ports';

export interface CatalogosDependencies {
  repository: CatalogRepository;
  authorize: (request: Request, requiredRole: string) => boolean | Promise<boolean>;
}
export type CatalogosDependenciesFactory = (env: AppEnv['Bindings']) => CatalogosDependencies;

/** Alias de compatibilidad. La lógica HTTP y de aplicación vive en cada módulo. */
export function createCatalogosRouter(
  dependencies: CatalogosDependencies | CatalogosDependenciesFactory,
) {
  const router = new OpenAPIHono<AppEnv>();
  const resolve = (env: AppEnv['Bindings']) =>
    typeof dependencies === 'function' ? dependencies(env) : dependencies;
  router.route('/', createEstacionesModule(resolve, 'catalogos'));
  router.route('/', createAmbitosModule(resolve, '/scopes', 'catalogosListScopes'));
  router.route(
    '/',
    createTiposGestionModule(resolve, '/management-types', 'catalogosListManagementTypes'),
  );
  router.route('/', createAntecedentesModule(resolve, '/backgrounds', 'catalogosListBackgrounds'));
  router.route('/', createEtapasModule(resolve, '/stages', 'catalogosListStages'));
  return router;
}
