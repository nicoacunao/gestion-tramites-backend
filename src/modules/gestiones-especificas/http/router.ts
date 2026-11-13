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
        managementTypeId: z.string(),
        code: z.string(),
        name: z.string(),
        active: z.boolean(),
        backgrounds: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            level: z.enum(['N2', 'N3', 'N4']),
            parentBackgroundId: z.string().nullable(),
          }),
        ),
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
      const items = await new GestionesEspecificasController(resolved).list(
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
