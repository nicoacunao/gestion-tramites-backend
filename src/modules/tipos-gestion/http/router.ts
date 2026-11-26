import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { ApiBadRequestResponse, ApiInternalErrorResponse } from '../../../shared/api/schemas';
import { ApiErrorSchema, ApiMetaSchema } from '../../../shared/api/schemas';
import type { AppEnv } from '../../../shared/config/bindings';
import {
  TiposGestionController,
  type TiposGestionDependencies,
  type TiposGestionDependenciesFactory,
} from './controller';

const responseSchema = z.object({
  exito: z.literal(true),
  mensaje: z.array(
    z
      .object({
        id: z.string(),
        parentId: z.string().nullable(),
        scopeId: z.string().nullable(),
        name: z.string(),
        level: z.number().int().positive(),
        required: z.boolean(),
      })
      .openapi('ManagementType'),
  ),
  meta: ApiMetaSchema,
});

export function createTiposGestionRouter(
  dependencies: TiposGestionDependencies | TiposGestionDependenciesFactory,
  path = '/items',
  operationId = 'tiposgestionList',
) {
  const router = new OpenAPIHono<AppEnv>();
  router.openapi(
    createRoute({
      method: 'get',
      path,
      tags: ['tipos-gestion'],
      operationId,
      responses: {
        ...ApiInternalErrorResponse,
        ...ApiBadRequestResponse,
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
      const items = await new TiposGestionController(resolved).list(context.req.raw);
      return context.json(
        {
          exito: true as const,
          mensaje: Array.from(items),
          meta: { requestId: context.get('requestId') },
        },
        200,
      );
    },
  );
  return router;
}
