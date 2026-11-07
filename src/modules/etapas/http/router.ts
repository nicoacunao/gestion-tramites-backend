import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { ApiErrorSchema, ApiMetaSchema } from '../../../shared/api/schemas';
import type { AppEnv } from '../../../shared/config/bindings';
import {
  EtapasController,
  type EtapasDependencies,
  type EtapasDependenciesFactory,
} from './controller';

const responseSchema = z.object({
  data: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        percentage: z.number().int().min(0).max(100),
        order: z.number().int().positive(),
        version: z.number().int().nonnegative(),
      })
      .openapi('StageCatalogItem'),
  ),
  meta: ApiMetaSchema,
});

export function createEtapasRouter(
  dependencies: EtapasDependencies | EtapasDependenciesFactory,
  path = '/items',
  operationId = 'etapasList',
) {
  const router = new OpenAPIHono<AppEnv>();
  router.openapi(
    createRoute({
      method: 'get',
      path,
      tags: ['etapas'],
      operationId,
      responses: {
        200: {
          content: { 'application/json': { schema: responseSchema } },
          description: 'Catálogo.',
        },
        403: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Sin permiso.',
        },
      },
    }),
    async (context) => {
      const resolved =
        typeof dependencies === 'function' ? dependencies(context.env) : dependencies;
      const items = await new EtapasController(resolved).list(context.req.raw);
      return context.json(
        { data: Array.from(items), meta: { requestId: context.get('requestId') } },
        200,
      );
    },
  );
  return router;
}
