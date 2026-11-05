import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../../shared/config/bindings';
import { bitacoraModule as health } from './health/router';
import {
  createBitacoraRouter,
  type BitacoraDependencies,
  type BitacoraDependenciesFactory,
} from './http/router';

export function createBitacoraModule(
  dependencies: BitacoraDependencies | BitacoraDependenciesFactory,
): OpenAPIHono<AppEnv> {
  const module = new OpenAPIHono<AppEnv>();
  module.route('/', health);
  module.route('/', createBitacoraRouter(dependencies));
  return module;
}
