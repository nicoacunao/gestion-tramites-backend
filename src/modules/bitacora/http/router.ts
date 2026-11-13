import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { ApiErrorSchema, ApiMetaSchema } from '../../../shared/api/schemas';
import type { AppEnv } from '../../../shared/config/bindings';
import { authenticatedUser } from '../../../shared/auth/request-auth';
import { AppError } from '../../../shared/errors/app-error';
import {
  BitacoraController,
  type BitacoraDependencies,
  type BitacoraDependenciesFactory,
} from './controller';
export type { BitacoraDependencies, BitacoraDependenciesFactory } from './controller';

const LogEntrySchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    managementId: z.string().trim().min(1).max(100),
    userId: z.string().trim().min(1).max(100).nullable(),
    registeredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    registeredAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    title: z.string().trim().min(1).max(80),
    comment: z.string().trim().min(1).max(1000),
    authorName: z.string().nullable().optional(),
    authorInitials: z.string().nullable().optional(),
    type: z.enum(['inicio', 'novedad', 'seguimiento', 'contacto']).nullable().optional(),
    automatic: z.boolean().optional(),
    version: z.number().int().positive(),
  })
  .openapi('LogEntry');

const LogEntryWriteSchema = z
  .object({
    managementId: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(80),
    comment: z.string().trim().min(1).max(1000),
    type: z.enum(['inicio', 'novedad', 'seguimiento', 'contacto']).nullable().default('novedad'),
    automatic: z.boolean().default(false),
    id: z.string().trim().min(1).max(100).optional(),
    userId: z.string().trim().min(1).max(100).optional(),
    registeredOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    registeredAt: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .optional(),
  })
  .openapi('LogEntryWrite');
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
    409: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Una entrada no tiene código externo.',
    },
    422: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Código de gestión inválido.',
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
    422: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Usuario, gestión, fecha u hora inválidos.',
    },
  },
});

export function createBitacoraRouter(
  dependenciesOrFactory: BitacoraDependencies | BitacoraDependenciesFactory,
): OpenAPIHono<AppEnv> {
  const router = new OpenAPIHono<AppEnv>();
  const controller = new BitacoraController(dependenciesOrFactory);

  router.openapi(listRoute, async (context) => {
    const entries = await controller.list(context.env, context.req.valid('query').managementId);
    return context.json(
      { data: Array.from(entries), meta: { requestId: context.get('requestId') } },
      200,
    );
  });

  router.openapi(detailRoute, async (context) => {
    const entry = await controller.get(context.env, context.req.valid('param').id);
    return context.json({ data: entry, meta: { requestId: context.get('requestId') } }, 200);
  });

  router.openapi(createRouteDefinition, async (context) => {
    const input = context.req.valid('json');
    let userId = input.userId;
    let registeredOn = input.registeredOn;
    let registeredAt = input.registeredAt;
    if (!userId || !registeredOn || !registeredAt) {
      if (!context.req.header('authorization'))
        throw new AppError('UNAUTHORIZED', 'Debes autenticarte para registrar una novedad.', 401);
      const user = await authenticatedUser(context.req.raw, context.env);
      userId = user.id;
      const now = new Date();
      registeredOn = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
      registeredAt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Santiago',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);
    }
    const entry = await controller.create(context.env, {
      id: input.id,
      managementId: input.managementId,
      userId,
      registeredOn,
      registeredAt,
      title: input.title,
      comment: input.comment,
      type: input.type ?? null,
      automatic: input.automatic ?? false,
    });
    return context.json({ data: entry, meta: { requestId: context.get('requestId') } }, 201);
  });

  return router;
}
