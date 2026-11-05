import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../../shared/config/bindings';
import { gestionesModule as health } from './health/router';
import {
  createGestionesRouter,
  type GestionesDependencies,
  type GestionesDependenciesFactory,
} from './http/router';

export function createGestionesModule(
  dependencies: GestionesDependencies | GestionesDependenciesFactory,
): OpenAPIHono<AppEnv> {
  const module = new OpenAPIHono<AppEnv>();
  module.route('/', health);
  module.route('/', createGestionesRouter(dependencies));
  return module;
}
