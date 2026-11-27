import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiInternalErrorResponse,
  ApiNotFoundResponse,
  ApiServiceUnavailableResponse,
  ApiUnauthorizedResponse,
} from '../../../shared/api/schemas';
import { ApiErrorSchema, ApiMetaSchema } from '../../../shared/api/schemas';
import type { AppEnv } from '../../../shared/config/bindings';
import { AppError } from '../../../shared/errors/app-error';
import type { User } from '../../identidad/domain/user';
import type { ManagementRepository } from '../application/ports';
import { presentManagement } from '../application/presentation';
import type {
  ManagementInput,
  ManagementSpecific,
  ManagementSpecificCreateInput,
  ManagementSpecificUpdateInput,
  ManagementStageCreateInput,
  ManagementStageUpdateInput,
} from '../domain/management';

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
    managementTypeName: z.string().nullable().optional(),
    level: z
      .string()
      .regex(/^N[1-9]\d*$/)
      .nullable()
      .optional(),
    scopeCode: z.string().nullable().optional(),
    scopeName: z.string().nullable().optional(),
    sequence: z.number().int().positive().nullable().optional(),
    code: z.string().nullable().optional(),
    trafficLight: z.enum(['al-dia', 'proximo-vencer', 'atrasado']).optional(),
    trafficLightLabel: z.string().optional(),
    codigo: z.string().nullable().optional(),
    nivel: z.string().nullable().optional(),
    ambito: z.string().nullable().optional(),
    codigoAmbito: z.string().nullable().optional(),
    correlativo: z.number().int().positive().nullable().optional(),
    semaforo: z.enum(['al-dia', 'proximo-vencer', 'atrasado']).optional(),
    semaforoEtiqueta: z.string().optional(),
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
const StageCreateSchema = z.object({
  stageId: z.string().regex(/^[1-9]\d*$/),
  status: z.enum(['Pendiente', 'En curso', 'Completado']).default('Pendiente'),
  estimatedOn: DateSchema.nullable().optional(),
  completedOn: DateSchema.nullable().optional(),
  responsibleUserId: z
    .string()
    .regex(/^[1-9]\d*$/)
    .nullable()
    .optional(),
  notes: z.string().max(300).nullable().optional(),
});
const StageUpdateSchema = z.object({
  status: z.enum(['Pendiente', 'En curso', 'Completado']),
  estimatedOn: DateSchema.nullable(),
  completedOn: DateSchema.nullable(),
  responsibleUserId: z
    .string()
    .regex(/^[1-9]\d*$/)
    .nullable(),
  notes: z.string().max(300).nullable(),
});
const BackgroundSchema = z
  .object({
    id: z.string(),
    managementId: z.string(),
    parentManagementBackgroundId: z.string().nullable(),
    managementTypeId: z.string(),
    backgroundId: z.string(),
    level: z.string().regex(/^N[1-9]\d*$/),
    required: z.boolean(),
    responsibleUserId: z.string(),
    status: z.string(),
    fileReference: z.string().nullable(),
    uploadedAt: z.string(),
    managementTypeName: z.string(),
  })
  .openapi('ManagementBackground');
const SpecificCreateSchema = z.object({
  managementTypeId: z.string().regex(/^[1-9]\d*$/),
  responsibleUserId: z
    .string()
    .regex(/^[1-9]\d*$/)
    .nullable()
    .optional(),
  status: z.string().trim().min(1).max(30).optional(),
  fileReference: z.string().max(500).nullable().optional(),
});
const SpecificUpdateSchema = z.object({
  responsibleUserId: z
    .string()
    .regex(/^[1-9]\d*$/)
    .nullable(),
  status: z.string().trim().min(1).max(30),
  fileReference: z.string().max(500).nullable(),
});

function toBackground(item: ManagementSpecific) {
  return {
    id: item.id,
    managementId: item.managementId,
    parentManagementBackgroundId: item.parentSpecificManagementId,
    managementTypeId: item.managementTypeId,
    backgroundId: item.managementTypeId,
    level: `N${item.level}`,
    required: item.required,
    responsibleUserId: item.responsibleUserId,
    status: item.status,
    fileReference: item.fileUrl,
    uploadedAt: item.uploadedAt,
    managementTypeName: item.managementTypeName,
  };
}

function assertStageDates(estimatedOn: string | null, completedOn: string | null): void {
  if (estimatedOn && completedOn && completedOn < estimatedOn)
    throw new AppError(
      'INVALID_STAGE_DATE_RANGE',
      'La fecha real de la etapa no puede ser anterior a la fecha estimada.',
      422,
    );
}

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
        ...ApiBadRequestResponse,
        ...ApiServiceUnavailableResponse,
        ...ApiUnauthorizedResponse,
        ...ApiForbiddenResponse,
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
        ...ApiBadRequestResponse,
        ...ApiServiceUnavailableResponse,
        ...ApiUnauthorizedResponse,
        ...ApiForbiddenResponse,
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
        ...ApiBadRequestResponse,
        ...ApiServiceUnavailableResponse,
        ...ApiUnauthorizedResponse,
        ...ApiForbiddenResponse,
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
        ...ApiBadRequestResponse,
        ...ApiServiceUnavailableResponse,
        ...ApiUnauthorizedResponse,
        ...ApiForbiddenResponse,
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
        ...ApiBadRequestResponse,
        ...ApiServiceUnavailableResponse,
        ...ApiNotFoundResponse,
        ...ApiUnauthorizedResponse,
        ...ApiForbiddenResponse,
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
  router.openapi(
    createRoute({
      method: 'post',
      path: '/items/{id}/stages',
      tags: ['gestiones'],
      operationId: 'gestionesCreateStage',
      request: {
        params: z.object({ id: z.string().regex(/^[1-9]\d*$/) }),
        body: { content: { 'application/json': { schema: StageCreateSchema } } },
      },
      responses: {
        ...ApiInternalErrorResponse,
        ...ApiBadRequestResponse,
        ...ApiServiceUnavailableResponse,
        ...ApiUnauthorizedResponse,
        ...ApiForbiddenResponse,
        201: {
          content: {
            'application/json': {
              schema: z.object({
                exito: z.literal(true),
                mensaje: StageSchema,
                meta: ApiMetaSchema,
              }),
            },
          },
          description: 'Etapa asociada a la gestión.',
        },
        404: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Gestión no encontrada.',
        },
        422: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Fechas inválidas.',
        },
      },
    }),
    async (c) => {
      const deps = resolve(c.env);
      await authorize(deps, c.req.raw);
      const managementId = c.req.valid('param').id;
      if (!(await deps.repository.findById(managementId)))
        throw new AppError('RESOURCE_NOT_FOUND', 'La gestión solicitada no existe.', 404);
      if (!deps.repository.createStage)
        throw new AppError(
          'CAPABILITY_NOT_IMPLEMENTED',
          'La creación de etapas no está disponible.',
          503,
        );
      const body = c.req.valid('json');
      assertStageDates(body.estimatedOn ?? null, body.completedOn ?? null);
      const input: ManagementStageCreateInput = {
        stageId: body.stageId,
        name: '',
        status: body.status,
        estimatedOn: body.estimatedOn ?? null,
        completedOn: body.completedOn ?? null,
        responsibleUserId: body.responsibleUserId ?? null,
        notes: body.notes ?? null,
      };
      const item = await deps.repository.createStage(managementId, input);
      return c.json(
        { exito: true as const, mensaje: item, meta: { requestId: c.get('requestId') } },
        201,
      );
    },
  );
  router.openapi(
    createRoute({
      method: 'put',
      path: '/stages/{id}',
      tags: ['gestiones'],
      operationId: 'gestionesUpdateStage',
      request: {
        params: z.object({ id: z.string().regex(/^[1-9]\d*$/) }),
        body: { content: { 'application/json': { schema: StageUpdateSchema } } },
      },
      responses: {
        ...ApiInternalErrorResponse,
        ...ApiBadRequestResponse,
        ...ApiServiceUnavailableResponse,
        ...ApiUnauthorizedResponse,
        ...ApiForbiddenResponse,
        200: {
          content: {
            'application/json': {
              schema: z.object({
                exito: z.literal(true),
                mensaje: StageSchema,
                meta: ApiMetaSchema,
              }),
            },
          },
          description: 'Etapa actualizada.',
        },
        404: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Etapa no encontrada.',
        },
        422: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Fechas inválidas.',
        },
      },
    }),
    async (c) => {
      const deps = resolve(c.env);
      await authorize(deps, c.req.raw);
      const id = c.req.valid('param').id;
      if (!deps.repository.findStage || !deps.repository.updateStage)
        throw new AppError(
          'CAPABILITY_NOT_IMPLEMENTED',
          'La edición de etapas no está disponible.',
          503,
        );
      if (!(await deps.repository.findStage(id)))
        throw new AppError('RESOURCE_NOT_FOUND', 'La etapa de la gestión no existe.', 404);
      const body = c.req.valid('json');
      assertStageDates(body.estimatedOn, body.completedOn);
      const input: ManagementStageUpdateInput = body;
      const item = await deps.repository.updateStage(id, input);
      return c.json(
        { exito: true as const, mensaje: item, meta: { requestId: c.get('requestId') } },
        200,
      );
    },
  );
  router.openapi(
    createRoute({
      method: 'get',
      path: '/items/{id}/backgrounds',
      tags: ['gestiones'],
      operationId: 'gestionesListBackgrounds',
      request: { params: z.object({ id: z.string().regex(/^[1-9]\d*$/) }) },
      responses: {
        ...ApiInternalErrorResponse,
        ...ApiBadRequestResponse,
        ...ApiServiceUnavailableResponse,
        ...ApiNotFoundResponse,
        ...ApiUnauthorizedResponse,
        ...ApiForbiddenResponse,
        200: {
          content: {
            'application/json': {
              schema: z.object({
                exito: z.literal(true),
                mensaje: z.array(BackgroundSchema),
                meta: ApiMetaSchema,
              }),
            },
          },
          description: 'Antecedentes asociados a la gestión.',
        },
      },
    }),
    async (c) => {
      const deps = resolve(c.env);
      await authorize(deps, c.req.raw);
      const id = c.req.valid('param').id;
      if (!(await deps.repository.findById(id)))
        throw new AppError('RESOURCE_NOT_FOUND', 'La gestión solicitada no existe.', 404);
      if (!deps.repository.listSpecifics)
        throw new AppError(
          'CAPABILITY_NOT_IMPLEMENTED',
          'La lectura de antecedentes no está disponible.',
          503,
        );
      const items = (await deps.repository.listSpecifics(id)).map(toBackground);
      return c.json(
        { exito: true as const, mensaje: items, meta: { requestId: c.get('requestId') } },
        200,
      );
    },
  );
  router.openapi(
    createRoute({
      method: 'post',
      path: '/items/{id}/backgrounds',
      tags: ['gestiones'],
      operationId: 'gestionesCreateBackground',
      request: {
        params: z.object({ id: z.string().regex(/^[1-9]\d*$/) }),
        body: { content: { 'application/json': { schema: SpecificCreateSchema } } },
      },
      responses: {
        ...ApiInternalErrorResponse,
        ...ApiBadRequestResponse,
        ...ApiServiceUnavailableResponse,
        ...ApiUnauthorizedResponse,
        ...ApiForbiddenResponse,
        201: {
          content: {
            'application/json': {
              schema: z.object({
                exito: z.literal(true),
                mensaje: BackgroundSchema,
                meta: ApiMetaSchema,
              }),
            },
          },
          description: 'Antecedente asociado a la gestión.',
        },
        404: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Gestión o tipo no encontrado.',
        },
        422: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Referencias inválidas o antecedente N2+ recibido sin archivo.',
        },
      },
    }),
    async (c) => {
      const deps = resolve(c.env);
      await authorize(deps, c.req.raw);
      const id = c.req.valid('param').id;
      if (!deps.repository.createSpecific)
        throw new AppError(
          'CAPABILITY_NOT_IMPLEMENTED',
          'La creación de antecedentes no está disponible.',
          503,
        );
      const body = c.req.valid('json');
      const input: ManagementSpecificCreateInput = {
        managementTypeId: body.managementTypeId,
        ...(body.responsibleUserId !== undefined
          ? { responsibleUserId: body.responsibleUserId }
          : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.fileReference !== undefined ? { fileReference: body.fileReference } : {}),
      };
      const item = await deps.repository.createSpecific(id, input);
      return c.json(
        {
          exito: true as const,
          mensaje: toBackground(item),
          meta: { requestId: c.get('requestId') },
        },
        201,
      );
    },
  );
  router.openapi(
    createRoute({
      method: 'put',
      path: '/backgrounds/{id}',
      tags: ['gestiones'],
      operationId: 'gestionesUpdateBackground',
      request: {
        params: z.object({ id: z.string().regex(/^[1-9]\d*$/) }),
        body: { content: { 'application/json': { schema: SpecificUpdateSchema } } },
      },
      responses: {
        ...ApiInternalErrorResponse,
        ...ApiBadRequestResponse,
        ...ApiServiceUnavailableResponse,
        ...ApiUnauthorizedResponse,
        ...ApiForbiddenResponse,
        200: {
          content: {
            'application/json': {
              schema: z.object({
                exito: z.literal(true),
                mensaje: BackgroundSchema,
                meta: ApiMetaSchema,
              }),
            },
          },
          description: 'Antecedente actualizado.',
        },
        404: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Antecedente no encontrado.',
        },
        422: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Referencias inválidas o antecedente N2+ recibido sin archivo.',
        },
      },
    }),
    async (c) => {
      const deps = resolve(c.env);
      await authorize(deps, c.req.raw);
      const id = c.req.valid('param').id;
      if (!deps.repository.findSpecific || !deps.repository.updateSpecific)
        throw new AppError(
          'CAPABILITY_NOT_IMPLEMENTED',
          'La edición de antecedentes no está disponible.',
          503,
        );
      const existing = await deps.repository.findSpecific(id);
      if (!existing)
        throw new AppError('RESOURCE_NOT_FOUND', 'El antecedente de la gestión no existe.', 404);
      const input: ManagementSpecificUpdateInput = c.req.valid('json');
      if (
        existing.level > 1 &&
        ['Recibido', 'Recibido conforme'].includes(input.status) &&
        !input.fileReference
      )
        throw new AppError(
          'SPECIFIC_MANAGEMENT_FILE_REQUIRED',
          'Para marcar este antecedente como recibido debes asociar un archivo.',
          422,
        );
      const item = await deps.repository.updateSpecific(id, input);
      return c.json(
        {
          exito: true as const,
          mensaje: toBackground(item),
          meta: { requestId: c.get('requestId') },
        },
        200,
      );
    },
  );
  return router;
}
