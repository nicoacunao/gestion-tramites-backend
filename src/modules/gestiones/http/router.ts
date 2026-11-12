import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { ApiErrorSchema, ApiMetaSchema } from '../../../shared/api/schemas';
import type { AppEnv } from '../../../shared/config/bindings';
import { AppError } from '../../../shared/errors/app-error';
import type { ManagementRepository } from '../application/ports';
import { presentManagement } from '../application/presentation';
import type {
  CompleteManagementInput,
  Management,
  ManagementAdditionalDataCreateInput,
  ManagementBackgroundCreateInput,
  ManagementStageCreateInput,
} from '../domain/management';

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Debe usar YYYY-MM-DD');
const ManagementSchema = z
  .object({
    id: z.string().trim().min(1).max(50),
    stationId: z.string().trim().min(1).max(20),
    managementTypeId: z.string().trim().min(1).max(80),
    scopeCode: z.string().trim().min(1).max(20),
    responsibleUserId: z.string().trim().min(1).max(50),
    level: z.enum(['N1', 'N2', 'N3', 'N4']),
    sequence: z.number().int().positive(),
    openedOn: DateSchema,
    estimatedCompletionOn: DateSchema.nullable(),
    lastReviewedOn: DateSchema.nullable(),
    priority: z.enum(['Alta', 'Media', 'Baja']),
    requesterName: z.string().trim().min(1).max(150),
    status: z
      .enum([
        'Borrador',
        'Pendiente',
        'Ingresado',
        'En tramitación',
        'Observado',
        'Reingresado',
        'Rechazado',
        'Terminado aprobado',
        'Terminado desfavorable',
      ])
      .nullable(),
    version: z.number().int().nonnegative(),
    stationName: z.string().nullable().optional(),
    legalName: z.string().nullable().optional(),
    responsibleName: z.string().nullable().optional(),
    managementTypeName: z.string().nullable().optional(),
    managementTypeCode: z.string().nullable().optional(),
    commune: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    legalRut: z.string().nullable().optional(),
    legalRepresentative: z.string().nullable().optional(),
    legalRepresentativeRut: z.string().nullable().optional(),
    codigo: z.string().optional(),
    ambito: z.string().optional(),
    codigoAmbito: z.string().optional(),
    correlativo: z.number().int().positive().optional(),
    semaforo: z.enum(['al-dia', 'proximo-vencer', 'atrasado']).optional(),
    semaforoEtiqueta: z.string().optional(),
    fechaInicio: z.string().optional(),
    fechaIngreso: z.string().optional(),
    fechaIngresoOrden: z.string().optional(),
    fechaEstimadaTermino: z.string().optional(),
    responsableInterno: z.string().optional(),
    idEstacion: z.string().optional(),
    estacionServicio: z.string().optional(),
    direccion: z.string().optional(),
    comuna: z.string().optional(),
    rutRazonSocial: z.string().optional(),
    razonSocial: z.string().optional(),
    representanteLegal: z.string().optional(),
    rutRepresentanteLegal: z.string().optional(),
    concesionario: z.string().optional(),
    descripcion: z.string().optional(),
  })
  .openapi('Management');
const ManagementWriteSchema = ManagementSchema.omit({ version: true })
  .extend({
    id: z.string().trim().min(1).max(50).optional(),
    sequence: z.number().int().positive().optional(),
    creationMode: z.enum(['principal', 'subtramite']).optional(),
    specificManagementId: z.string().nullable().optional(),
    associatedSpecificManagementIds: z.array(z.string()).optional(),
    requiredBackgrounds: z
      .array(
        z.object({
          backgroundId: z.string().nullable().optional(),
          parentBackgroundId: z.string().nullable().optional(),
          name: z.string().trim().min(1).max(300),
          category: z.literal('requerido').default('requerido'),
          required: z.boolean().default(true),
          requestedBy: z.string().nullable().optional(),
          responsibleUserId: z.string().nullable().optional(),
          responsibleName: z.string().nullable().optional(),
          status: z.enum(['Pendiente', 'Recibido', 'Recibido conforme']).optional(),
          observations: z.string().nullable().optional(),
          fileName: z.string().nullable().optional(),
          fileReference: z.string().nullable().optional(),
        }),
      )
      .optional(),
    complementaryBackgrounds: z
      .array(
        z.object({
          backgroundId: z.string().nullable().optional(),
          parentBackgroundId: z.string().nullable().optional(),
          name: z.string().trim().min(1).max(300),
          category: z.literal('complementario').default('complementario'),
          required: z.boolean().default(false),
          requestedBy: z.string().nullable().optional(),
          responsibleUserId: z.string().nullable().optional(),
          responsibleName: z.string().nullable().optional(),
          status: z.enum(['Pendiente', 'Recibido', 'Recibido conforme']).optional(),
          observations: z.string().nullable().optional(),
          fileName: z.string().nullable().optional(),
          fileReference: z.string().nullable().optional(),
        }),
      )
      .optional(),
    stages: z
      .array(
        z.object({
          stageId: z.string().nullable().optional(),
          name: z.string().trim().min(1).max(200),
          status: z.enum(['Pendiente', 'En curso', 'Completado']).optional(),
          estimatedOn: DateSchema.nullable().optional(),
          completedOn: DateSchema.nullable().optional(),
          responsibleUserId: z.string().nullable().optional(),
          responsibleName: z.string().nullable().optional(),
          notes: z.string().nullable().optional(),
        }),
      )
      .optional(),
    additionalData: z
      .array(
        z.object({
          fieldId: z.string().nullable().optional(),
          fieldCode: z.string().nullable().optional(),
          value: z.string().trim().min(1).max(500),
        }),
      )
      .optional(),
    datosAdicionales: z.record(z.string(), z.string()).optional(),
    subtramitesAsociados: z.array(z.string().trim().min(1)).optional(),
    antecedentesConfigurados: z.array(z.string().trim().min(1)).optional(),
    antecedentesComplementariosConfigurados: z.array(z.string().trim().min(1)).optional(),
    etapasConfiguradas: z.array(z.string().trim().min(1)).optional(),
  })
  .openapi('ManagementWrite');
const ManagementUpdateSchema = ManagementWriteSchema.extend({
  version: z.number().int().positive(),
}).openapi('ManagementUpdate');
const ManagementResponseSchema = z
  .object({ data: ManagementSchema, meta: ApiMetaSchema })
  .openapi('ManagementResponse');
const ManagementListResponseSchema = z
  .object({ data: z.array(ManagementSchema), meta: ApiMetaSchema })
  .openapi('ManagementListResponse');

export interface GestionesDependencies {
  repository: ManagementRepository;
  authorize: (request: Request, requiredRole: string) => boolean | Promise<boolean>;
}
export type GestionesDependenciesFactory = (env: AppEnv['Bindings']) => GestionesDependencies;

const listRoute = createRoute({
  method: 'get',
  path: '/items',
  tags: ['gestiones'],
  operationId: 'gestionesList',
  responses: {
    200: {
      content: { 'application/json': { schema: ManagementListResponseSchema } },
      description: 'Gestiones.',
    },
    403: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Sin permiso.',
    },
  },
});
const detailRoute = createRoute({
  method: 'get',
  path: '/items/{id}',
  tags: ['gestiones'],
  operationId: 'gestionesGet',
  request: { params: z.object({ id: z.string().min(1) }) },
  responses: {
    200: {
      content: { 'application/json': { schema: ManagementResponseSchema } },
      description: 'Gestión.',
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
const createRouteDefinition = createRoute({
  method: 'post',
  path: '/items',
  tags: ['gestiones'],
  operationId: 'gestionesCreate',
  request: { body: { content: { 'application/json': { schema: ManagementWriteSchema } } } },
  responses: {
    201: {
      content: { 'application/json': { schema: ManagementResponseSchema } },
      description: 'Gestión creada.',
    },
    400: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Solicitud inválida.',
    },
    403: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Sin permiso.',
    },
    409: { content: { 'application/json': { schema: ApiErrorSchema } }, description: 'Conflicto.' },
  },
});
const updateRoute = createRoute({
  method: 'put',
  path: '/items/{id}',
  tags: ['gestiones'],
  operationId: 'gestionesUpdate',
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: { content: { 'application/json': { schema: ManagementUpdateSchema } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ManagementResponseSchema } },
      description: 'Gestión actualizada.',
    },
    400: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Solicitud inválida.',
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

const ROLE = 'gestiones';
const BackgroundSchema = z.object({
  id: z.string(),
  managementId: z.string(),
  parentManagementBackgroundId: z.string().nullable(),
  managementTypeId: z.string(),
  backgroundId: z.string(),
  level: z.enum(['N2', 'N3', 'N4']),
  required: z.boolean(),
  responsibleUserId: z.string(),
  status: z.string(),
  fileReference: z.string().nullable(),
  uploadedAt: z.string().nullable(),
  version: z.number().int().nonnegative(),
});
const StageSchema = z.object({
  id: z.string(),
  managementId: z.string(),
  stageId: z.string(),
  status: z.string(),
  estimatedOn: DateSchema.nullable(),
  completedOn: DateSchema.nullable(),
  responsible: z.string().nullable(),
  notes: z.string().nullable(),
  version: z.number().int().nonnegative(),
});
const BackgroundUpdateSchema = z.object({
  responsibleUserId: z.string().trim().max(50),
  status: z.enum(['Pendiente', 'Recibido', 'Recibido conforme']),
  fileReference: z.string().trim().max(500).nullable(),
  version: z.number().int().positive(),
});
const StageUpdateSchema = z.object({
  status: z.enum(['Pendiente', 'En curso', 'Completado']),
  estimatedOn: DateSchema.nullable(),
  completedOn: DateSchema.nullable(),
  responsible: z.string().trim().max(150).nullable(),
  notes: z.string().trim().max(300).nullable(),
  version: z.number().int().positive(),
});
function assertDates(
  openedOn: string,
  estimatedCompletionOn: string | null,
  lastReviewedOn: string | null,
): void {
  if (estimatedCompletionOn && estimatedCompletionOn < openedOn)
    throw new AppError(
      'INVALID_DATE_RANGE',
      'La fecha estimada no puede ser anterior a la apertura.',
      422,
    );
  if (lastReviewedOn && lastReviewedOn < openedOn)
    throw new AppError(
      'INVALID_DATE_RANGE',
      'La última revisión no puede ser anterior a la apertura.',
      422,
    );
}

export function createGestionesRouter(
  dependenciesOrFactory: GestionesDependencies | GestionesDependenciesFactory,
): OpenAPIHono<AppEnv> {
  const router = new OpenAPIHono<AppEnv>();
  const resolve = (env: AppEnv['Bindings']) =>
    typeof dependenciesOrFactory === 'function'
      ? dependenciesOrFactory(env)
      : dependenciesOrFactory;
  const ensureAuthorized = async (deps: GestionesDependencies, request: Request) => {
    if (!(await deps.authorize(request, ROLE)))
      throw new AppError('FORBIDDEN', 'No tienes permisos para gestionar gestiones.', 403);
  };
  router.openapi(listRoute, async (context) => {
    const deps = resolve(context.env);
    await ensureAuthorized(deps, context.req.raw);
    return context.json(
      {
        data: Array.from(await deps.repository.list(), presentManagement),
        meta: { requestId: context.get('requestId') },
      },
      200,
    );
  });
  router.openapi(detailRoute, async (context) => {
    const deps = resolve(context.env);
    await ensureAuthorized(deps, context.req.raw);
    const item = await deps.repository.findById(context.req.valid('param').id);
    if (!item) throw new AppError('RESOURCE_NOT_FOUND', 'La gestión solicitada no existe.', 404);
    return context.json(
      { data: presentManagement(item), meta: { requestId: context.get('requestId') } },
      200,
    );
  });
  router.openapi(
    createRoute({
      method: 'get',
      path: '/items/{id}/backgrounds',
      tags: ['gestiones'],
      operationId: 'gestionesListBackgrounds',
      request: { params: z.object({ id: z.string().min(1) }) },
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({ data: z.array(BackgroundSchema), meta: ApiMetaSchema }),
            },
          },
          description: 'Antecedentes de la gestión.',
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
    }),
    async (context) => {
      const deps = resolve(context.env);
      await ensureAuthorized(deps, context.req.raw);
      const id = context.req.valid('param').id;
      if (!(await deps.repository.findById(id)))
        throw new AppError('RESOURCE_NOT_FOUND', 'La gestión solicitada no existe.', 404);
      return context.json(
        {
          data: Array.from(await deps.repository.listBackgrounds(id)),
          meta: { requestId: context.get('requestId') },
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
      request: { params: z.object({ id: z.string().min(1) }) },
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({ data: z.array(StageSchema), meta: ApiMetaSchema }),
            },
          },
          description: 'Etapas de la gestión.',
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
    }),
    async (context) => {
      const deps = resolve(context.env);
      await ensureAuthorized(deps, context.req.raw);
      const id = context.req.valid('param').id;
      if (!(await deps.repository.findById(id)))
        throw new AppError('RESOURCE_NOT_FOUND', 'La gestión solicitada no existe.', 404);
      return context.json(
        {
          data: Array.from(await deps.repository.listStages(id)),
          meta: { requestId: context.get('requestId') },
        },
        200,
      );
    },
  );
  router.openapi(createRouteDefinition, async (context) => {
    const deps = resolve(context.env);
    await ensureAuthorized(deps, context.req.raw);
    const input = context.req.valid('json');
    assertDates(input.openedOn, input.estimatedCompletionOn, input.lastReviewedOn);
    if (input.id && (await deps.repository.findById(input.id)))
      throw new AppError('RESOURCE_CONFLICT', 'Ya existe una gestión con ese identificador.', 409);
    const hasRelations = Boolean(
      (deps.repository.createComplete && input.creationMode) ||
      input.specificManagementId ||
      input.associatedSpecificManagementIds ||
      input.requiredBackgrounds ||
      input.complementaryBackgrounds ||
      input.stages ||
      input.additionalData ||
      input.datosAdicionales ||
      input.subtramitesAsociados ||
      input.antecedentesConfigurados ||
      input.antecedentesComplementariosConfigurados ||
      input.etapasConfiguradas,
    );
    if (hasRelations) {
      if (!deps.repository.createComplete)
        throw new AppError('NOT_IMPLEMENTED', 'La creación completa no está disponible.', 503);
      const completeInput = {
        ...input,
        id: input.id ?? '',
        creationMode: input.creationMode ?? 'principal',
        associatedSpecificManagementIds:
          input.associatedSpecificManagementIds ?? input.subtramitesAsociados,
        requiredBackgrounds:
          input.requiredBackgrounds ??
          input.antecedentesConfigurados?.map((name) => ({
            name,
            category: 'requerido' as const,
            required: true,
          })),
        complementaryBackgrounds:
          input.complementaryBackgrounds ??
          input.antecedentesComplementariosConfigurados?.map((name) => ({
            name,
            category: 'complementario' as const,
            required: false,
          })),
        stages:
          input.stages ??
          input.etapasConfiguradas?.map((name) => ({
            name,
            status: 'Pendiente' as const,
          })),
        additionalData:
          input.additionalData ??
          Object.entries(input.datosAdicionales ?? {}).map(([fieldCode, value]) => ({
            fieldCode,
            value,
          })),
      } as CompleteManagementInput;
      const item = await deps.repository.createComplete(completeInput);
      return context.json(
        { data: presentManagement(item), meta: { requestId: context.get('requestId') } },
        201,
      );
    }
    const item: Management = {
      ...input,
      id: input.id ?? `${input.level}-${input.scopeCode}-${Date.now()}`,
      sequence: input.sequence ?? 1,
      version: 1,
    };
    await deps.repository.save(item);
    return context.json(
      { data: presentManagement(item), meta: { requestId: context.get('requestId') } },
      201,
    );
  });
  router.openapi(updateRoute, async (context) => {
    const deps = resolve(context.env);
    await ensureAuthorized(deps, context.req.raw);
    const id = context.req.valid('param').id;
    const input = context.req.valid('json');
    const current = await deps.repository.findById(id);
    if (!current) throw new AppError('RESOURCE_NOT_FOUND', 'La gestión solicitada no existe.', 404);
    if (input.version !== current.version)
      throw new AppError('VERSION_CONFLICT', 'La gestión fue modificada por otro usuario.', 409, {
        expectedVersion: current.version,
      });
    assertDates(input.openedOn, input.estimatedCompletionOn, input.lastReviewedOn);
    const item: Management = {
      ...input,
      id,
      sequence: input.sequence ?? current.sequence,
      version: current.version + 1,
    };
    await deps.repository.save(item, current.version);
    return context.json(
      { data: presentManagement(item), meta: { requestId: context.get('requestId') } },
      200,
    );
  });
  router.openapi(
    createRoute({
      method: 'put',
      path: '/backgrounds/{id}',
      tags: ['gestiones'],
      operationId: 'gestionesUpdateBackground',
      request: {
        params: z.object({ id: z.string().min(1) }),
        body: { content: { 'application/json': { schema: BackgroundUpdateSchema } } },
      },
      responses: {
        200: {
          content: {
            'application/json': { schema: z.object({ data: z.any(), meta: ApiMetaSchema }) },
          },
          description: 'Antecedente actualizado.',
        },
        403: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Sin permiso.',
        },
        409: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Conflicto de versión.',
        },
      },
    }),
    async (context) => {
      const deps = resolve(context.env);
      await ensureAuthorized(deps, context.req.raw);
      if (!deps.repository.updateBackground)
        throw new AppError(
          'NOT_IMPLEMENTED',
          'La edición de antecedentes no está disponible.',
          503,
        );
      const body = context.req.valid('json');
      const item = await deps.repository.updateBackground(
        context.req.valid('param').id,
        {
          managementId: '',
          parentManagementBackgroundId: null,
          managementTypeId: '',
          backgroundId: '',
          level: 'N2',
          required: false,
          responsibleUserId: body.responsibleUserId,
          status: body.status,
          fileReference: body.fileReference,
          uploadedAt: null,
        },
        body.version,
      );
      return context.json({ data: item, meta: { requestId: context.get('requestId') } }, 200);
    },
  );
  router.openapi(
    createRoute({
      method: 'put',
      path: '/stages/{id}',
      tags: ['gestiones'],
      operationId: 'gestionesUpdateStage',
      request: {
        params: z.object({ id: z.string().min(1) }),
        body: { content: { 'application/json': { schema: StageUpdateSchema } } },
      },
      responses: {
        200: {
          content: {
            'application/json': { schema: z.object({ data: z.any(), meta: ApiMetaSchema }) },
          },
          description: 'Etapa actualizada.',
        },
        403: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Sin permiso.',
        },
        409: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Conflicto de versión.',
        },
      },
    }),
    async (context) => {
      const deps = resolve(context.env);
      await ensureAuthorized(deps, context.req.raw);
      if (!deps.repository.updateStage)
        throw new AppError('NOT_IMPLEMENTED', 'La edición de etapas no está disponible.', 503);
      const body = context.req.valid('json');
      const item = await deps.repository.updateStage(
        context.req.valid('param').id,
        {
          managementId: '',
          stageId: '',
          status: body.status,
          estimatedOn: body.estimatedOn,
          completedOn: body.completedOn,
          responsible: body.responsible,
          notes: body.notes,
        },
        body.version,
      );
      return context.json({ data: item, meta: { requestId: context.get('requestId') } }, 200);
    },
  );
  const relationResponse = z.object({ data: z.any(), meta: ApiMetaSchema });
  router.openapi(
    createRoute({
      method: 'post',
      path: '/items/{id}/backgrounds',
      tags: ['gestiones'],
      operationId: 'gestionesCreateBackground',
      request: {
        params: z.object({ id: z.string().min(1) }),
        body: {
          content: {
            'application/json': {
              schema: z.object({
                backgroundId: z.string().nullable().optional(),
                parentBackgroundId: z.string().nullable().optional(),
                name: z.string().trim().min(1).max(300),
                category: z.enum(['requerido', 'complementario', 'adicional']),
                required: z.boolean(),
                requestedBy: z.string().nullable().optional(),
                responsibleUserId: z.string().nullable().optional(),
                responsibleName: z.string().nullable().optional(),
                status: z.enum(['Pendiente', 'Recibido', 'Recibido conforme']).optional(),
                observations: z.string().nullable().optional(),
                fileName: z.string().nullable().optional(),
                fileReference: z.string().nullable().optional(),
              }),
            },
          },
        },
      },
      responses: {
        201: {
          content: { 'application/json': { schema: relationResponse } },
          description: 'Antecedente creado.',
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
    }),
    async (context) => {
      const deps = resolve(context.env);
      await ensureAuthorized(deps, context.req.raw);
      if (!deps.repository.createBackground)
        throw new AppError('NOT_IMPLEMENTED', 'El alta de antecedentes no está disponible.', 503);
      const id = context.req.valid('param').id;
      if (!(await deps.repository.findById(id)))
        throw new AppError('RESOURCE_NOT_FOUND', 'La gestión solicitada no existe.', 404);
      const item = await deps.repository.createBackground(
        id,
        context.req.valid('json') as ManagementBackgroundCreateInput,
      );
      return context.json({ data: item, meta: { requestId: context.get('requestId') } }, 201);
    },
  );
  router.openapi(
    createRoute({
      method: 'post',
      path: '/items/{id}/stages',
      tags: ['gestiones'],
      operationId: 'gestionesCreateStage',
      request: {
        params: z.object({ id: z.string().min(1) }),
        body: {
          content: {
            'application/json': {
              schema: z.object({
                stageId: z.string().nullable().optional(),
                name: z.string().trim().min(1).max(200),
                status: z.enum(['Pendiente', 'En curso', 'Completado']).optional(),
                estimatedOn: DateSchema.nullable().optional(),
                completedOn: DateSchema.nullable().optional(),
                responsibleUserId: z.string().nullable().optional(),
                responsibleName: z.string().nullable().optional(),
                notes: z.string().nullable().optional(),
              }),
            },
          },
        },
      },
      responses: {
        201: {
          content: { 'application/json': { schema: relationResponse } },
          description: 'Etapa creada.',
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
    }),
    async (context) => {
      const deps = resolve(context.env);
      await ensureAuthorized(deps, context.req.raw);
      if (!deps.repository.createStage)
        throw new AppError('NOT_IMPLEMENTED', 'El alta de etapas no está disponible.', 503);
      const id = context.req.valid('param').id;
      if (!(await deps.repository.findById(id)))
        throw new AppError('RESOURCE_NOT_FOUND', 'La gestión solicitada no existe.', 404);
      const item = await deps.repository.createStage(
        id,
        context.req.valid('json') as ManagementStageCreateInput,
      );
      return context.json({ data: item, meta: { requestId: context.get('requestId') } }, 201);
    },
  );
  router.openapi(
    createRoute({
      method: 'post',
      path: '/items/{id}/additional-data',
      tags: ['gestiones'],
      operationId: 'gestionesCreateAdditionalData',
      request: {
        params: z.object({ id: z.string().min(1) }),
        body: {
          content: {
            'application/json': {
              schema: z.object({
                fieldId: z.string().nullable().optional(),
                fieldCode: z.string().nullable().optional(),
                value: z.string().trim().min(1).max(500),
              }),
            },
          },
        },
      },
      responses: {
        201: {
          content: { 'application/json': { schema: relationResponse } },
          description: 'Dato adicional creado.',
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
    }),
    async (context) => {
      const deps = resolve(context.env);
      await ensureAuthorized(deps, context.req.raw);
      if (!deps.repository.createAdditionalData)
        throw new AppError(
          'NOT_IMPLEMENTED',
          'El alta de datos adicionales no está disponible.',
          503,
        );
      const id = context.req.valid('param').id;
      if (!(await deps.repository.findById(id)))
        throw new AppError('RESOURCE_NOT_FOUND', 'La gestión solicitada no existe.', 404);
      await deps.repository.createAdditionalData(
        id,
        context.req.valid('json') as ManagementAdditionalDataCreateInput,
      );
      return context.json(
        { data: { managementId: id }, meta: { requestId: context.get('requestId') } },
        201,
      );
    },
  );
  return router;
}
