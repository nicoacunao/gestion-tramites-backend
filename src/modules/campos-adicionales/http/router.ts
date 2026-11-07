import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { ApiErrorSchema, ApiMetaSchema } from '../../../shared/api/schemas';
import type { AppEnv } from '../../../shared/config/bindings';
import {
  CamposAdicionalesController,
  type CamposAdicionalesDependencies,
  type CamposAdicionalesDependenciesFactory,
} from './controller';
const responseSchema = z.object({
  data: z.array(
    z
      .object({
        id: z.string(),
        managementTypeId: z.string(),
        code: z.string(),
        label: z.string(),
        controlType: z.enum(['text', 'select']),
        required: z.boolean(),
        options: z.array(z.object({ value: z.string(), order: z.number().int().positive() })),
      })
      .openapi('AdditionalField'),
  ),
  meta: ApiMetaSchema,
});
export function createCamposAdicionalesRouter(
  dependencies: CamposAdicionalesDependencies | CamposAdicionalesDependenciesFactory,
) {
  const router = new OpenAPIHono<AppEnv>();
  router.openapi(
    createRoute({
      method: 'get',
      path: '/items',
      tags: ['campos-adicionales'],
      operationId: 'camposadicionalesList',
      request: {
        query: z.object({ managementTypeId: z.string().trim().min(1).max(80).optional() }),
      },
      responses: {
        200: {
          content: { 'application/json': { schema: responseSchema } },
          description: 'Catálogo.',
        },
        400: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Filtro inválido.',
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
      const items = await new CamposAdicionalesController(resolved).list(
        context.req.raw,
        context.req.valid('query').managementTypeId,
      );
      return context.json(
        { data: Array.from(items), meta: { requestId: context.get('requestId') } },
        200,
      );
    },
  );
  return router;
}
