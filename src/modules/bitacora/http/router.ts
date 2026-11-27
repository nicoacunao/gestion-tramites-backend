import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  ApiBadRequestResponse,
  ApiInternalErrorResponse,
  ApiServiceUnavailableResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '../../../shared/api/schemas';
import { ApiErrorSchema, ApiMetaSchema } from '../../../shared/api/schemas';
import type { AppEnv } from '../../../shared/config/bindings';
import { authenticatedUser } from '../../../shared/auth/request-auth';
import type { BitacoraDependencies, BitacoraDependenciesFactory } from './controller';
import { BitacoraController } from './controller';
export type { BitacoraDependencies, BitacoraDependenciesFactory } from './controller';

const TypeSchema = z.enum(['inicio', 'novedad', 'seguimiento', 'contacto']);
const LogEntrySchema = z
  .object({
    id: z.string(),
    managementId: z.string(),
    userId: z.string().nullable(),
    registeredOn: z.string(),
    registeredAt: z.string(),
    title: z.string(),
    comment: z.string(),
    type: TypeSchema.nullable(),
  })
  .openapi('LogEntry');
const LogEntryResponseSchema = z.object({
  exito: z.literal(true),
  mensaje: LogEntrySchema,
  meta: ApiMetaSchema,
});
const LogEntryListResponseSchema = z.object({
  exito: z.literal(true),
  mensaje: z.array(LogEntrySchema),
  meta: ApiMetaSchema,
});
const LogEntryWriteSchema = z
  .object({
    managementId: z.string().regex(/^[1-9]\d{0,18}$/),
    title: z.string().trim().min(1).max(80),
    comment: z.string().trim().min(1).max(1000),
    type: TypeSchema.nullable().default('novedad'),
    userId: z
      .string()
      .regex(/^[1-9]\d{0,18}$/)
      .nullable()
      .optional(),
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

export function createBitacoraRouter(
  dependenciesOrFactory: BitacoraDependencies | BitacoraDependenciesFactory,
): OpenAPIHono<AppEnv> {
  const router = new OpenAPIHono<AppEnv>();
  const controller = new BitacoraController(dependenciesOrFactory);
  router.openapi(
    createRoute({
      method: 'get',
      path: '/items',
      tags: ['bitacora'],
      operationId: 'bitacoraListEntries',
      request: { query: z.object({ managementId: z.string().regex(/^[1-9]\d{0,18}$/) }) },
      responses: {
        ...ApiInternalErrorResponse,
        ...ApiBadRequestResponse,
        ...ApiServiceUnavailableResponse,
        ...ApiUnprocessableEntityResponse,
        200: {
          content: { 'application/json': { schema: LogEntryListResponseSchema } },
          description: 'Entradas de bitácora.',
        },
      },
    }),
    async (c) => {
      const entries = await controller.list(c.env, c.req.valid('query').managementId);
      return c.json(
        {
          exito: true as const,
          mensaje: Array.from(entries),
          meta: { requestId: c.get('requestId') },
        },
        200,
      );
    },
  );
  router.openapi(
    createRoute({
      method: 'get',
      path: '/items/{id}',
      tags: ['bitacora'],
      operationId: 'bitacoraGetEntry',
      request: { params: z.object({ id: z.string().regex(/^[1-9]\d{0,18}$/) }) },
      responses: {
        ...ApiInternalErrorResponse,
        ...ApiBadRequestResponse,
        ...ApiServiceUnavailableResponse,
        ...ApiUnprocessableEntityResponse,
        200: {
          content: { 'application/json': { schema: LogEntryResponseSchema } },
          description: 'Entrada de bitácora.',
        },
        404: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'No encontrada.',
        },
      },
    }),
    async (c) => {
      const entry = await controller.get(c.env, c.req.valid('param').id);
      return c.json(
        { exito: true as const, mensaje: entry, meta: { requestId: c.get('requestId') } },
        200,
      );
    },
  );
  router.openapi(
    createRoute({
      method: 'post',
      path: '/items',
      tags: ['bitacora'],
      operationId: 'bitacoraCreateEntry',
      request: { body: { content: { 'application/json': { schema: LogEntryWriteSchema } } } },
      responses: {
        ...ApiInternalErrorResponse,
        ...ApiBadRequestResponse,
        ...ApiServiceUnavailableResponse,
        ...ApiUnprocessableEntityResponse,
        ...ApiUnauthorizedResponse,
        201: {
          content: { 'application/json': { schema: LogEntryResponseSchema } },
          description: 'Entrada creada.',
        },
      },
    }),
    async (c) => {
      const input = c.req.valid('json');
      let userId = input.userId;
      if (!userId) userId = (await authenticatedUser(c.req.raw, c.env)).id;
      const entry = await controller.create(c.env, {
        managementId: input.managementId,
        title: input.title,
        comment: input.comment,
        type: input.type ?? null,
        userId,
        ...(input.registeredOn !== undefined ? { registeredOn: input.registeredOn } : {}),
        ...(input.registeredAt !== undefined ? { registeredAt: input.registeredAt } : {}),
      });
      return c.json(
        { exito: true as const, mensaje: entry, meta: { requestId: c.get('requestId') } },
        201,
      );
    },
  );
  return router;
}
