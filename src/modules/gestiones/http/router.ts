import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { ApiInternalErrorResponse } from '../../../shared/api/schemas';
import { ApiErrorSchema, ApiMetaSchema } from '../../../shared/api/schemas';
import type { AppEnv } from '../../../shared/config/bindings';
import { AppError } from '../../../shared/errors/app-error';
import type { User } from '../../identidad/domain/user';
import type { ManagementRepository } from '../application/ports';
import { presentManagement } from '../application/presentation';
import type { ManagementInput } from '../domain/management';

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Debe usar YYYY-MM-DD');
const ManagementSchema = z
  .object({
    id: z.string(),
    stationId: z.string(),
    responsibleUserId: z.string(),
    createdAt: z.string().optional(),
    openedOn: DateSchema,
    estimatedCompletionOn: DateSchema.nullable(),
    lastReviewedOn: DateSchema.nullable(),
    priority: z.enum(['Alta', 'Media', 'Baja']),
    status: z.enum([
      'Borrador',
      'Pendiente',
      'Ingresado',
      'En tramitación',
      'Observado',
      'Reingresado',
      'Rechazado',
      'Terminado aprobado',
      'Terminado desfavorable',
    ]),
    requesterName: z.string(),
    stationName: z.string().nullable().optional(),
    legalName: z.string().nullable().optional(),
    responsibleName: z.string().nullable().optional(),
    commune: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    legalRut: z.string().nullable().optional(),
    legalRepresentative: z.string().nullable().optional(),
    legalRepresentativeRut: z.string().nullable().optional(),
  })
  .openapi('Management');
const ManagementWriteSchema = z
  .object({
    stationId: z.string().regex(/^[1-9]\d*$/),
    responsibleUserId: z.string().regex(/^[1-9]\d*$/),
    openedOn: DateSchema,
    estimatedCompletionOn: DateSchema.nullable(),
    lastReviewedOn: DateSchema.nullable(),
    priority: z.enum(['Alta', 'Media', 'Baja']),
    status: z.enum([
      'Borrador',
      'Pendiente',
      'Ingresado',
      'En tramitación',
      'Observado',
      'Reingresado',
      'Rechazado',
      'Terminado aprobado',
      'Terminado desfavorable',
    ]),
    requesterName: z.string().trim().min(1).max(150),
  })
  .openapi('ManagementWrite');
const StageSchema = z
  .object({
    id: z.string(),
    managementId: z.string(),
    stageId: z.string(),
    stageName: z.string(),
    percentage: z.number(),
    status: z.string(),
    estimatedOn: DateSchema.nullable(),
    completedOn: DateSchema.nullable(),
    responsible: z.string().nullable(),
    responsibleUserId: z.string().nullable(),
    notes: z.string().nullable(),
  })
  .openapi('ManagementStage');

export interface GestionesDependencies {
  repository: ManagementRepository;
  authorize: (request: Request, requiredRole: string) => boolean | Promise<boolean>;
  authenticate: (request: Request) => Promise<User>;
}
export type GestionesDependenciesFactory = (env: AppEnv['Bindings']) => GestionesDependencies;

export function createGestionesRouter(
  dependenciesOrFactory: GestionesDependencies | GestionesDependenciesFactory,
): OpenAPIHono<AppEnv> {
  const router = new OpenAPIHono<AppEnv>();
  const resolve = (env: AppEnv['Bindings']) =>
    typeof dependenciesOrFactory === 'function'
      ? dependenciesOrFactory(env)
      : dependenciesOrFactory;
  const authorize = async (deps: GestionesDependencies, request: Request) => {
    if (!(await deps.authorize(request, 'gestiones')))
      throw new AppError('FORBIDDEN', 'No tienes permisos para gestionar gestiones.', 403);
  };
  const response = z.object({
    exito: z.literal(true),
    mensaje: ManagementSchema,
    meta: ApiMetaSchema,
  });
  const listResponse = z.object({
    exito: z.literal(true),
    mensaje: z.array(ManagementSchema),
    meta: ApiMetaSchema,
  });

  router.openapi(
    createRoute({
      method: 'get',
      path: '/items',
      tags: ['gestiones'],
      operationId: 'gestionesList',
      request: { query: z.object({ assignedToMe: z.enum(['true', 'false']).default('false') }) },
      responses: {
        ...ApiInternalErrorResponse,
        200: {
          content: { 'application/json': { schema: listResponse } },
          description: 'Gestiones.',
        },
      },
    }),
    async (c) => {
      const deps = resolve(c.env);
      await authorize(deps, c.req.raw);
      const query = c.req.valid('query');
      const user = query.assignedToMe === 'true' ? await deps.authenticate(c.req.raw) : undefined;
      return c.json(
        {
          exito: true as const,
          mensaje: Array.from(await deps.repository.list(user?.id), presentManagement),
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
      tags: ['gestiones'],
      operationId: 'gestionesGet',
      request: { params: z.object({ id: z.string().regex(/^[1-9]\d*$/) }) },
      responses: {
        ...ApiInternalErrorResponse,
        200: { content: { 'application/json': { schema: response } }, description: 'Gestión.' },
        404: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'No encontrada.',
        },
      },
    }),
    async (c) => {
      const deps = resolve(c.env);
      await authorize(deps, c.req.raw);
      const item = await deps.repository.findById(c.req.valid('param').id);
      if (!item) throw new AppError('RESOURCE_NOT_FOUND', 'La gestión solicitada no existe.', 404);
      return c.json(
        {
          exito: true as const,
          mensaje: presentManagement(item),
          meta: { requestId: c.get('requestId') },
        },
        200,
      );
    },
  );
  router.openapi(
    createRoute({
      method: 'post',
      path: '/items',
      tags: ['gestiones'],
      operationId: 'gestionesCreate',
      request: { body: { content: { 'application/json': { schema: ManagementWriteSchema } } } },
      responses: {
        ...ApiInternalErrorResponse,
        201: {
          content: { 'application/json': { schema: response } },
          description: 'Gestión creada.',
        },
      },
    }),
    async (c) => {
      const deps = resolve(c.env);
      await authorize(deps, c.req.raw);
      const item = await deps.repository.save(c.req.valid('json') as ManagementInput);
      if (!item)
        throw new AppError('MANAGEMENT_SAVE_FAILED', 'La gestión no pudo ser guardada.', 500);
      return c.json(
        {
          exito: true as const,
          mensaje: presentManagement(item),
          meta: { requestId: c.get('requestId') },
        },
        201,
      );
    },
  );
  router.openapi(
    createRoute({
      method: 'put',
      path: '/items/{id}',
      tags: ['gestiones'],
      operationId: 'gestionesUpdate',
      request: {
        params: z.object({ id: z.string().regex(/^[1-9]\d*$/) }),
        body: { content: { 'application/json': { schema: ManagementWriteSchema } } },
      },
      responses: {
        ...ApiInternalErrorResponse,
        200: {
          content: { 'application/json': { schema: response } },
          description: 'Gestión actualizada.',
        },
        404: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'No encontrada.',
        },
      },
    }),
    async (c) => {
      const deps = resolve(c.env);
      await authorize(deps, c.req.raw);
      const id = c.req.valid('param').id;
      if (!(await deps.repository.findById(id)))
        throw new AppError('RESOURCE_NOT_FOUND', 'La gestión solicitada no existe.', 404);
      const item = await deps.repository.save({ ...c.req.valid('json'), id } as ManagementInput);
      if (!item)
        throw new AppError('MANAGEMENT_SAVE_FAILED', 'La gestión no pudo ser guardada.', 500);
      return c.json(
        {
          exito: true as const,
          mensaje: presentManagement(item),
          meta: { requestId: c.get('requestId') },
        },
        200,
      );
    },
  );
  router.openapi(
    createRoute({
      method: 'get',
      path: '/items/{id}/stages',
      tags: ['gestiones'],
      operationId: 'gestionesListStages',
      request: { params: z.object({ id: z.string().regex(/^[1-9]\d*$/) }) },
      responses: {
        ...ApiInternalErrorResponse,
        200: {
          content: {
            'application/json': {
              schema: z.object({
                exito: z.literal(true),
                mensaje: z.array(StageSchema),
                meta: ApiMetaSchema,
              }),
            },
          },
          description: 'Etapas.',
        },
      },
    }),
    async (c) => {
      const deps = resolve(c.env);
      await authorize(deps, c.req.raw);
      const id = c.req.valid('param').id;
      if (!(await deps.repository.findById(id)))
        throw new AppError('RESOURCE_NOT_FOUND', 'La gestión solicitada no existe.', 404);
      return c.json(
        {
          exito: true as const,
          mensaje: Array.from(await deps.repository.listStages(id)),
          meta: { requestId: c.get('requestId') },
        },
        200,
      );
    },
  );
  return router;
}
