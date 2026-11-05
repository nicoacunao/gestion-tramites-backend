import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { ApiErrorSchema, ApiMetaSchema } from '../../../shared/api/schemas';
import type { AppEnv } from '../../../shared/config/bindings';
import { AppError } from '../../../shared/errors/app-error';
import type { LogRepository } from '../application/ports';
import type { LogEntry } from '../domain/log-entry';

const LogEntrySchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    managementId: z.string().trim().min(1).max(100),
    userId: z.string().trim().min(1).max(100).nullable(),
    registeredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    registeredAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    title: z.string().trim().min(1).max(80),
    comment: z.string().trim().min(1).max(1000),
    version: z.number().int().positive(),
  })
  .openapi('LogEntry');

const LogEntryWriteSchema = LogEntrySchema.omit({ version: true }).openapi('LogEntryWrite');
const LogEntryResponseSchema = z
  .object({ data: LogEntrySchema, meta: ApiMetaSchema })
  .openapi('LogEntryResponse');
const LogEntryListResponseSchema = z
  .object({ data: z.array(LogEntrySchema), meta: ApiMetaSchema })
  .openapi('LogEntryListResponse');

const listRoute = createRoute({
  method: 'get',
  path: '/items',
  tags: ['bitacora'],
  operationId: 'bitacoraListEntries',
  request: { query: z.object({ managementId: z.string().trim().min(1).max(100) }) },
  responses: {
    200: {
      content: { 'application/json': { schema: LogEntryListResponseSchema } },
      description: 'Entradas de bitácora de una gestión.',
    },
  },
});

const detailRoute = createRoute({
  method: 'get',
  path: '/items/{id}',
  tags: ['bitacora'],
  operationId: 'bitacoraGetEntry',
  request: { params: z.object({ id: z.string().trim().min(1).max(100) }) },
  responses: {
    200: {
      content: { 'application/json': { schema: LogEntryResponseSchema } },
      description: 'Entrada de bitácora.',
    },
    404: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'No encontrada.',
    },
  },
});

const createRouteDefinition = createRoute({
  method: 'post',
  path: '/items',
  tags: ['bitacora'],
  operationId: 'bitacoraCreateEntry',
  request: { body: { content: { 'application/json': { schema: LogEntryWriteSchema } } } },
  responses: {
    201: {
      content: { 'application/json': { schema: LogEntryResponseSchema } },
      description: 'Entrada creada.',
    },
    400: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Solicitud inválida.',
    },
    409: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Ya existe una entrada con ese identificador.',
    },
  },
});

export interface BitacoraDependencies {
  repository: LogRepository;
}
export type BitacoraDependenciesFactory = (env: AppEnv['Bindings']) => BitacoraDependencies;

export function createBitacoraRouter(
  dependenciesOrFactory: BitacoraDependencies | BitacoraDependenciesFactory,
): OpenAPIHono<AppEnv> {
  const router = new OpenAPIHono<AppEnv>();
  const resolve = (env: AppEnv['Bindings']) =>
    typeof dependenciesOrFactory === 'function'
      ? dependenciesOrFactory(env)
      : dependenciesOrFactory;

  router.openapi(listRoute, async (context) => {
    const entries = await resolve(context.env).repository.listByManagement(
      context.req.valid('query').managementId,
    );
    return context.json(
      { data: Array.from(entries), meta: { requestId: context.get('requestId') } },
      200,
    );
  });

  router.openapi(detailRoute, async (context) => {
    const entry = await resolve(context.env).repository.findById(context.req.valid('param').id);
    if (!entry) throw new AppError('RESOURCE_NOT_FOUND', 'La entrada solicitada no existe.', 404);
    return context.json({ data: entry, meta: { requestId: context.get('requestId') } }, 200);
  });

  router.openapi(createRouteDefinition, async (context) => {
    const dependencies = resolve(context.env);
    const input = context.req.valid('json');
    if (await dependencies.repository.findById(input.id))
      throw new AppError('RESOURCE_CONFLICT', 'Ya existe una entrada con ese identificador.', 409);
    const entry: LogEntry = { ...input, version: 1 };
    await dependencies.repository.append(entry);
    return context.json({ data: entry, meta: { requestId: context.get('requestId') } }, 201);
  });

  return router;
}
