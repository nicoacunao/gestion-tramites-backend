import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import type { AppEnv } from '../config/bindings';
import { ApiErrorSchema, ModuleHealthResponseSchema } from './schemas';

export function createModuleHealthRouter(moduleName: string): OpenAPIHono<AppEnv> {
  const router = new OpenAPIHono<AppEnv>();
  const route = createRoute({
    method: 'get',
    path: '/health',
    operationId: `${moduleName}Health`,
    tags: [moduleName],
    summary: `Health check del módulo ${moduleName}`,
    responses: {
      200: {
        description: 'El módulo está disponible.',
        content: {
          'application/json': {
            schema: ModuleHealthResponseSchema,
          },
        },
      },
      500: {
        description: 'Error inesperado.',
        content: {
          'application/json': {
            schema: ApiErrorSchema,
          },
        },
      },
    },
  });

  router.openapi(route, (context) =>
    context.json(
      {
        data: {
          module: moduleName,
          status: 'ok' as const,
        },
        meta: {
          requestId: context.get('requestId'),
        },
      },
      200,
    ),
  );

  return router;
}
