import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { ApiErrorSchema } from '../../../shared/api/schemas';
import type { AppEnv } from '../../../shared/config/bindings';
import {
  StationController,
  type EstacionesDependencies,
  type EstacionesDependenciesFactory,
} from './controller';
import {
  StationWriteSchema,
  StationUpdateSchema,
  StationResponseSchema,
  StationListResponseSchema,
} from './schemas';

const stationListRoute = createRoute({
  method: 'get',
  path: '/items',
  tags: ['estaciones'],
  operationId: 'estacionesListStations',
  request: {
    query: z.object({
      eds: z.string().optional(),
      commune: z.string().optional(),
      status: z.string().optional(),
      legalName: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: StationListResponseSchema } },
      description: 'Estaciones.',
    },
    401: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'No autenticado.',
    },
    403: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Sin permiso.',
    },
  },
});

const stationCreateRoute = createRoute({
  method: 'post',
  path: '/items',
  tags: ['estaciones'],
  operationId: 'estacionesCreateStation',
  request: { body: { content: { 'application/json': { schema: StationWriteSchema } } } },
  responses: {
    201: {
      content: { 'application/json': { schema: StationResponseSchema } },
      description: 'Estación creada.',
    },
    400: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Solicitud inválida.',
    },
    401: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'No autenticado.',
    },
    403: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Sin permiso.',
    },
    409: { content: { 'application/json': { schema: ApiErrorSchema } }, description: 'Conflicto.' },
  },
});

const stationDetailRoute = createRoute({
  method: 'get',
  path: '/items/{id}',
  tags: ['estaciones'],
  operationId: 'estacionesGetStation',
  request: { params: z.object({ id: z.string().min(1) }) },
  responses: {
    200: {
      content: { 'application/json': { schema: StationResponseSchema } },
      description: 'Estación.',
    },
    401: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'No autenticado.',
    },
    403: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Sin permiso.',
    },
    404: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'No encontrada.',
    },
  },
});

const stationUpdateRoute = createRoute({
  method: 'put',
  path: '/items/{id}',
  tags: ['estaciones'],
  operationId: 'estacionesUpdateStation',
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: { content: { 'application/json': { schema: StationUpdateSchema } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: StationResponseSchema } },
      description: 'Estación actualizada.',
    },
    400: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Solicitud inválida.',
    },
    401: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'No autenticado.',
    },
    403: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Sin permiso.',
    },
    404: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'No encontrada.',
    },
    409: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Conflicto de versión.',
    },
  },
});

export function createEstacionesRouter(
  dependencies: EstacionesDependencies | EstacionesDependenciesFactory,
  operationPrefix = 'estaciones',
) {
  const router = new OpenAPIHono<AppEnv>();
  const controller = (env: AppEnv['Bindings']) =>
    new StationController(typeof dependencies === 'function' ? dependencies(env) : dependencies);
  router.openapi(
    { ...stationListRoute, operationId: `${operationPrefix}ListStations` },
    async (context) =>
      context.json(
        {
          data: Array.from(
            await controller(context.env).list(context.req.raw, context.req.valid('query')),
          ),
          meta: { requestId: context.get('requestId') },
        },
        200,
      ),
  );
  router.openapi(
    { ...stationDetailRoute, operationId: `${operationPrefix}GetStation` },
    async (context) =>
      context.json(
        {
          data: await controller(context.env).get(context.req.raw, context.req.valid('param').id),
          meta: { requestId: context.get('requestId') },
        },
        200,
      ),
  );
  router.openapi(
    { ...stationCreateRoute, operationId: `${operationPrefix}CreateStation` },
    async (context) =>
      context.json(
        {
          data: await controller(context.env).create(context.req.raw, context.req.valid('json')),
          meta: { requestId: context.get('requestId') },
        },
        201,
      ),
  );
  router.openapi(
    { ...stationUpdateRoute, operationId: `${operationPrefix}UpdateStation` },
    async (context) =>
      context.json(
        {
          data: await controller(context.env).update(
            context.req.raw,
            context.req.valid('param').id,
            context.req.valid('json'),
          ),
          meta: { requestId: context.get('requestId') },
        },
        200,
      ),
  );
  return router;
}
