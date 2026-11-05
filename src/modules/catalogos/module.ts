import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../../shared/config/bindings';
import {
  createCatalogosRouter,
  type CatalogosDependencies,
  type CatalogosDependenciesFactory,
} from './http/router';
import { catalogosModule as health } from './health/router';

export function createCatalogosModule(
  dependencies: CatalogosDependencies | CatalogosDependenciesFactory,
): OpenAPIHono<AppEnv> {
  const module = new OpenAPIHono<AppEnv>();
  module.route('/', health);
  module.route('/', createCatalogosRouter(dependencies));
  return module;
}
