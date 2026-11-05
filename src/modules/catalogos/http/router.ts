import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { ApiErrorSchema, ApiMetaSchema } from '../../../shared/api/schemas';
import type { AppEnv } from '../../../shared/config/bindings';
import { AppError } from '../../../shared/errors/app-error';
import type { CatalogRepository } from '../application/ports';
import type { Station } from '../domain/catalog';
import type {
  ManagementScope,
  ManagementType,
  ManagementTypeRelation,
  BackgroundCatalogItem,
  StageCatalogItem,
} from '../domain/catalog';

const StationSchema = z
  .object({
    id: z.string().trim().min(1).max(20),
    name: z.string().trim().max(150).nullable().optional(),
    address: z.string().trim().min(1).max(250),
    commune: z.string().trim().min(1).max(100),
    legalName: z.string().trim().min(1).max(150),
    zoneManager: z.string().trim().min(1).max(150),
    commercialManager: z.string().trim().min(1).max(150),
    companyRut: z.string().trim().min(1).max(12),
    legalRepresentative: z.string().trim().min(1).max(150),
    legalRepresentativeRut: z.string().trim().max(12).nullable().optional(),
    status: z.string().trim().min(1).max(30),
    version: z.number().int().nonnegative(),
  })
  .openapi('Station');

const StationWriteSchema = StationSchema.omit({ version: true }).openapi('StationWrite');
const StationUpdateSchema = StationWriteSchema.extend({
  version: z.number().int().positive(),
}).openapi('StationUpdate');

const StationResponseSchema = z
  .object({ data: StationSchema, meta: ApiMetaSchema })
  .openapi('StationResponse');
const StationListResponseSchema = z
  .object({ data: z.array(StationSchema), meta: ApiMetaSchema })
  .openapi('StationListResponse');

const CatalogListResponseSchema = z
  .object({
    data: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
    meta: ApiMetaSchema,
  })
  .openapi('CatalogListResponse');

export interface CatalogosDependencies {
  repository: CatalogRepository;
  authorize: (request: Request, requiredRole: string) => boolean | Promise<boolean>;
}
export type CatalogosDependenciesFactory = (env: AppEnv['Bindings']) => CatalogosDependencies;

const stationListRoute = createRoute({
  method: 'get',
  path: '/items',
  tags: ['catalogos'],
  operationId: 'catalogosListStations',
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
  tags: ['catalogos'],
  operationId: 'catalogosCreateStation',
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
  tags: ['catalogos'],
  operationId: 'catalogosGetStation',
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
  tags: ['catalogos'],
  operationId: 'catalogosUpdateStation',
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

const catalogRoutes = [
  ['scopes', 'catalogosListScopes', 'Ámbitos de gestión.'],
  ['management-types', 'catalogosListManagementTypes', 'Tipos de gestión.'],
  ['type-relations', 'catalogosListTypeRelations', 'Relaciones entre tipos.'],
  ['backgrounds', 'catalogosListBackgrounds', 'Biblioteca de antecedentes.'],
  ['stages', 'catalogosListStages', 'Etapas.'],
] as const;

const catalogRouteConfigs = catalogRoutes.map(([path, operationId, description]) =>
  createRoute({
    method: 'get',
    path: `/${path}`,
    tags: ['catalogos'],
    operationId,
    responses: {
      200: { content: { 'application/json': { schema: CatalogListResponseSchema } }, description },
      401: {
        content: { 'application/json': { schema: ApiErrorSchema } },
        description: 'No autenticado.',
      },
      403: {
        content: { 'application/json': { schema: ApiErrorSchema } },
        description: 'Sin permiso.',
      },
    },
  }),
);

function forbidden() {
  throw new AppError('FORBIDDEN', 'No tienes permisos para administrar catálogos.', 403);
}

async function ensureAuthorized(
  dependencies: CatalogosDependencies,
  request: Request,
): Promise<void> {
  if (!(await dependencies.authorize(request, 'indagación'))) forbidden();
}

export function createCatalogosRouter(
  dependenciesOrFactory: CatalogosDependencies | CatalogosDependenciesFactory,
): OpenAPIHono<AppEnv> {
  const router = new OpenAPIHono<AppEnv>();
  const resolve = (env: AppEnv['Bindings']) =>
    typeof dependenciesOrFactory === 'function'
      ? dependenciesOrFactory(env)
      : dependenciesOrFactory;

  router.openapi(stationListRoute, async (context) => {
    const dependencies = resolve(context.env);
    await ensureAuthorized(dependencies, context.req.raw);
    const query = context.req.valid('query');
    const stations = (await dependencies.repository.listStations()).filter(
      (item) =>
        (!query.eds || item.id === query.eds) &&
        (!query.commune ||
          item.commune.toLocaleLowerCase().includes(query.commune.toLocaleLowerCase())) &&
        (!query.status || item.status === query.status) &&
        (!query.legalName ||
          item.legalName.toLocaleLowerCase().includes(query.legalName.toLocaleLowerCase())),
    );
    return context.json(
      {
        data: Array.from(stations),
        meta: { requestId: context.get('requestId') },
      },
      200,
    );
  });

  router.openapi(stationDetailRoute, async (context) => {
    const dependencies = resolve(context.env);
    await ensureAuthorized(dependencies, context.req.raw);
    const station = await dependencies.repository.findStationById(context.req.valid('param').id);
    if (!station)
      throw new AppError('RESOURCE_NOT_FOUND', 'La estación solicitada no existe.', 404);
    return context.json({ data: station, meta: { requestId: context.get('requestId') } }, 200);
  });

  router.openapi(stationCreateRoute, async (context) => {
    const dependencies = resolve(context.env);
    await ensureAuthorized(dependencies, context.req.raw);
    const input = context.req.valid('json');
    const station: Station = {
      ...input,
      name: input.name ?? null,
      legalRepresentativeRut: input.legalRepresentativeRut ?? null,
      version: 1,
    };
    if (await dependencies.repository.findStationById(station.id))
      throw new AppError('RESOURCE_CONFLICT', 'Ya existe una estación con ese EDS.', 409);
    await dependencies.repository.saveStation(station);
    return context.json({ data: station, meta: { requestId: context.get('requestId') } }, 201);
  });

  router.openapi(stationUpdateRoute, async (context) => {
    const dependencies = resolve(context.env);
    await ensureAuthorized(dependencies, context.req.raw);
    const { id } = context.req.valid('param');
    const input = context.req.valid('json');
    const current = await dependencies.repository.findStationById(id);
    if (!current)
      throw new AppError('RESOURCE_NOT_FOUND', 'La estación solicitada no existe.', 404);
    if (input.version !== current.version)
      throw new AppError('VERSION_CONFLICT', 'La estación fue modificada por otro usuario.', 409, {
        expectedVersion: current.version,
      });
    const station: Station = {
      ...input,
      id,
      name: input.name ?? null,
      legalRepresentativeRut: input.legalRepresentativeRut ?? null,
      version: current.version + 1,
    };
    await dependencies.repository.saveStation(station, current.version);
    return context.json({ data: station, meta: { requestId: context.get('requestId') } }, 200);
  });

  router.openapi(catalogRouteConfigs[0]!, async (context) => {
    const dependencies = resolve(context.env);
    await ensureAuthorized(dependencies, context.req.raw);
    return context.json(
      {
        data: toRows(await dependencies.repository.listScopes()),
        meta: { requestId: context.get('requestId') },
      },
      200,
    );
  });
  router.openapi(catalogRouteConfigs[1]!, async (context) => {
    const dependencies = resolve(context.env);
    await ensureAuthorized(dependencies, context.req.raw);
    return context.json(
      {
        data: toRows(await dependencies.repository.listManagementTypes()),
        meta: { requestId: context.get('requestId') },
      },
      200,
    );
  });
  router.openapi(catalogRouteConfigs[2]!, async (context) => {
    const dependencies = resolve(context.env);
    await ensureAuthorized(dependencies, context.req.raw);
    return context.json(
      {
        data: toRows(await dependencies.repository.listTypeRelations()),
        meta: { requestId: context.get('requestId') },
      },
      200,
    );
  });
  router.openapi(catalogRouteConfigs[3]!, async (context) => {
    const dependencies = resolve(context.env);
    await ensureAuthorized(dependencies, context.req.raw);
    return context.json(
      {
        data: toRows(await dependencies.repository.listBackgrounds()),
        meta: { requestId: context.get('requestId') },
      },
      200,
    );
  });
  router.openapi(catalogRouteConfigs[4]!, async (context) => {
    const dependencies = resolve(context.env);
    await ensureAuthorized(dependencies, context.req.raw);
    return context.json(
      {
        data: toRows(await dependencies.repository.listStages()),
        meta: { requestId: context.get('requestId') },
      },
      200,
    );
  });

  return router;
}

function toRows(
  items: readonly (
    | ManagementScope
    | ManagementType
    | ManagementTypeRelation
    | BackgroundCatalogItem
    | StageCatalogItem
  )[],
): Record<string, string | number | null>[] {
  return items.map((item) =>
    Object.fromEntries(
      Object.entries(item).map(([key, value]) => [
        key,
        typeof value === 'boolean' ? String(value) : value,
      ]),
    ),
  );
}
