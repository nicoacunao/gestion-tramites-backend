import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { AppEnv } from '../../../shared/config/bindings';
import { ApiErrorSchema, ApiMetaSchema } from '../../../shared/api/schemas';
import { AppError } from '../../../shared/errors/app-error';
import type { ConsultasDependencies } from '../application/ports';
import { parseStationImport, StationService } from '../../estaciones';
import { createModuleHealthRouter } from '../../../shared/api/health-router';

const summary = z.object({
  stationId: z.string(),
  activeCount: z.number(),
  pendingCount: z.number(),
  daysWithoutProgress: z.number(),
  overallStatus: z.string(),
});
export function createConsultasModule(
  dependencies: (env: AppEnv['Bindings']) => ConsultasDependencies,
): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();
  app.route('/', createModuleHealthRouter('consultas'));
  app.openapi(
    createRoute({
      method: 'get',
      path: '/stations/summary',
      tags: ['consultas'],
      operationId: 'consultasStationSummary',
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({ data: z.array(summary), meta: ApiMetaSchema }),
            },
          },
          description: 'Resumen de estaciones.',
        },
        403: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Sin permiso.',
        },
      },
    }),
    async (c) => {
      const resolved = dependencies(c.env);
      if (!(await resolved.authorize(c.req.raw, 'gestiones')))
        throw new AppError('FORBIDDEN', 'No tienes permisos para consultar.', 403);
      return c.json(
        {
          data: Array.from(await resolved.queries.summarizeStations()),
          meta: { requestId: c.get('requestId') },
        },
        200,
      );
    },
  );
  const stationData = z.object({
    stationId: z.string(),
    legalName: z.string(),
    address: z.string(),
    comuna: z.string(),
    zoneManager: z.string(),
    commercialManager: z.string(),
    companyRut: z.string(),
    legalRepresentative: z.string(),
    legalRepresentativeRut: z.string().nullable(),
    status: z.string(),
  });
  const importRowError = z.object({ row: z.number(), message: z.string() });
  app.openapi(
    createRoute({
      method: 'get',
      path: '/stations',
      tags: ['consultas'],
      operationId: 'consultasListStations',
      request: {
        query: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(5),
        }),
      },
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({
                data: z.array(stationData),
                meta: ApiMetaSchema.extend({
                  page: z.number(),
                  pageSize: z.number(),
                  total: z.number(),
                  totalPages: z.number(),
                }),
              }),
            },
          },
          description: 'Estaciones.',
        },
        403: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Sin permiso.',
        },
      },
    }),
    async (c) => {
      const resolved = dependencies(c.env);
      if (!(await resolved.authorize(c.req.raw, 'indagación')))
        throw new AppError('FORBIDDEN', 'No tienes permisos para consultar estaciones.', 403);
      const query = c.req.valid('query');
      const result = await new StationService(resolved.stations).listPage(
        query.page,
        query.pageSize,
      );
      return c.json(
        {
          data: result.stations.map((item) => ({
            stationId: item.id,
            legalName: item.legalName,
            address: item.address,
            comuna: item.commune,
            zoneManager: item.zoneManager,
            commercialManager: item.commercialManager,
            companyRut: item.companyRut,
            legalRepresentative: item.legalRepresentative,
            legalRepresentativeRut: item.legalRepresentativeRut,
            status: item.status,
          })),
          meta: {
            requestId: c.get('requestId'),
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
            totalPages: result.totalPages,
          },
        },
        200,
      );
    },
  );
  app.openapi(
    createRoute({
      method: 'post',
      path: '/stations/import',
      tags: ['consultas'],
      operationId: 'consultasImportStations',
      request: {
        body: { content: { 'multipart/form-data': { schema: z.object({ file: z.any() }) } } },
      },
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({
                data: z.array(stationData),
                meta: ApiMetaSchema.extend({
                  created: z.number(),
                  updated: z.number(),
                  rejected: z.number(),
                  rejectedRows: z.array(importRowError),
                }),
              }),
            },
          },
          description: 'Importación completada.',
        },
        403: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Sin permiso.',
        },
        422: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Archivo inválido.',
        },
      },
    }),
    async (c) => {
      const resolved = dependencies(c.env);
      if (!(await resolved.authorize(c.req.raw, 'indagación')))
        throw new AppError('FORBIDDEN', 'No tienes permisos para importar estaciones.', 403);
      let formData: Record<string, string | File | File[]>;
      try {
        formData = await c.req.parseBody();
      } catch {
        throw new AppError(
          'INVALID_MULTIPART',
          'La solicitud debe enviarse como multipart/form-data con un archivo en el campo file.',
          422,
          {
            receivedContentType: c.req.header('content-type')?.split(';', 1)[0] ?? null,
          },
        );
      }
      const file = formData.file;
      if (!(file instanceof File))
        throw new AppError('INVALID_FILE', 'Debes enviar el campo file.', 422);
      const parsed = await parseStationImport(file);
      const result = await new StationService(resolved.stations).import(
        parsed.stations,
        parsed.errors.length,
      );
      return c.json(
        {
          data: result.stations.map((item) => ({
            stationId: item.id,
            legalName: item.legalName,
            address: item.address,
            comuna: item.commune,
            zoneManager: item.zoneManager,
            commercialManager: item.commercialManager,
            companyRut: item.companyRut,
            legalRepresentative: item.legalRepresentative,
            legalRepresentativeRut: item.legalRepresentativeRut,
            status: item.status,
          })),
          meta: {
            requestId: c.get('requestId'),
            created: result.created,
            updated: result.updated,
            rejected: result.rejected,
            rejectedRows: [...parsed.errors],
          },
        },
        200,
      );
    },
  );
  return app;
}
