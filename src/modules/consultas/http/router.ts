import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { AppEnv } from '../../../shared/config/bindings';
import { ApiErrorSchema, ApiMetaSchema } from '../../../shared/api/schemas';
import { AppError } from '../../../shared/errors/app-error';
import { authorizeRequest } from '../../../shared/auth/request-auth';
import type { ManagementQueries } from '../application/ports';
import { createModuleHealthRouter } from '../../../shared/api/health-router';

const summary = z.object({ stationId: z.string(), activeCount: z.number(), pendingCount: z.number(), daysWithoutProgress: z.number(), overallStatus: z.string() });
export function createConsultasModule(dependencies: (env: AppEnv['Bindings']) => ManagementQueries): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();
  app.route('/', createModuleHealthRouter('consultas'));
  app.openapi(createRoute({ method: 'get', path: '/stations/summary', tags: ['consultas'], operationId: 'consultasStationSummary', responses: {
    200: { content: { 'application/json': { schema: z.object({ data: z.array(summary), meta: ApiMetaSchema }) } }, description: 'Resumen de estaciones.' },
    403: { content: { 'application/json': { schema: ApiErrorSchema } }, description: 'Sin permiso.' },
  } }), async (c) => {
    if (!(await authorizeRequest(c.req.raw, c.env, 'gestiones'))) throw new AppError('FORBIDDEN', 'No tienes permisos para consultar.', 403);
    return c.json({ data: Array.from(await dependencies(c.env).summarizeStations()), meta: { requestId: c.get('requestId') } }, 200);
  });
  return app;
}
