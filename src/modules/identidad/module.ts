import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../../shared/config/bindings';
import type { LoginDependencies } from './application/login';
import { createLoginRouter } from './http/router';
import { identidadModule as health } from './health/router';

export function createIdentidadModule(
  dependencies: (env: AppEnv['Bindings']) => LoginDependencies,
): OpenAPIHono<AppEnv> {
  const module = new OpenAPIHono<AppEnv>();
  module.route('/', health);
  module.route('/', createLoginRouter(dependencies));
  return module;
}
