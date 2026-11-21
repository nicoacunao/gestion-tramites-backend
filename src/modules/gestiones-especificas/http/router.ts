import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { ApiErrorSchema, ApiMetaSchema } from '../../../shared/api/schemas';
import type { AppEnv } from '../../../shared/config/bindings';
import {
  GestionesEspecificasController,
  type GestionesEspecificasDependencies,
  type GestionesEspecificasDependenciesFactory,
} from './controller';
const responseSchema = z.object({
  data: z.array(
    z
      .object({
        id: z.string(),
        managementId: z.string(),
        managementTypeId: z.string(),
        managementTypeName: z.string(),
        level: z.number().int().positive(),
        responsibleUserId: z.string(),
        responsibleName: z.string(),
        status: z.string(),
        fileUrl: z.string().nullable(),
        uploadedAt: z.string(),
      })
      .openapi('SpecificManagement'),
  ),
  meta: ApiMetaSchema,
});
export function createGestionesEspecificasRouter(
  dependencies: GestionesEspecificasDependencies | GestionesEspecificasDependenciesFactory,
) {
  const router = new OpenAPIHono<AppEnv>();
  router.openapi(
    createRoute({
      method: 'get',
      path: '/items',
      tags: ['gestiones-especificas'],
      operationId: 'gestionesespecificasList',
      request: {
        query: z.object({ managementId: z.string().trim().regex(/^\d+$/).min(1) }),
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
      const items = await new GestionesEspecificasController(resolved).list(
        context.req.raw,
        context.req.valid('query').managementId,
      );
      return context.json(
        { data: Array.from(items), meta: { requestId: context.get('requestId') } },
        200,
      );
    },
  );
  return router;
}
