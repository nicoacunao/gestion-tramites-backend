import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { ApiErrorSchema, ApiMetaSchema } from '../../../shared/api/schemas';
import type { AppEnv } from '../../../shared/config/bindings';
import {
  AntecedentesController,
  type AntecedentesDependencies,
  type AntecedentesDependenciesFactory,
} from './controller';

const responseSchema = z.object({
  data: z.array(
    z
      .object({ id: z.string(), name: z.string(), version: z.number().int().nonnegative() })
      .openapi('BackgroundCatalogItem'),
  ),
  meta: ApiMetaSchema,
});

export function createAntecedentesRouter(
  dependencies: AntecedentesDependencies | AntecedentesDependenciesFactory,
  path = '/items',
  operationId = 'antecedentesList',
) {
  const router = new OpenAPIHono<AppEnv>();
  router.openapi(
    createRoute({
      method: 'get',
      path,
      tags: ['antecedentes'],
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
      const items = await new AntecedentesController(resolved).list(context.req.raw);
      return context.json(
        { data: Array.from(items), meta: { requestId: context.get('requestId') } },
        200,
      );
    },
  );
  return router;
}
