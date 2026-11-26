import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  ApiBadRequestResponse,
  ApiErrorSchema,
  ApiInternalErrorResponse,
  ApiServiceUnavailableResponse,
} from '../../../shared/api/schemas';
import type { AppEnv } from '../../../shared/config/bindings';
import { authenticatedUser } from '../../../shared/auth/request-auth';
import { AppError } from '../../../shared/errors/app-error';
import type { FileRepository, FileStorage } from '../application/ports';

export interface ArchivosDependencies {
  repository: FileRepository;
  storage: FileStorage;
}
const IdSchema = z.string().regex(/^[1-9]\d{0,18}$/);
const FileSchema = z
  .object({
    id: z.string(),
    managementSpecificId: z.string(),
    storageReference: z.string(),
    uploadedAt: z.string(),
  })
  .openapi('FileRecord');
const meta = z.object({ requestId: z.string() });

export function createArchivosRouter(
  dependencies: (env: AppEnv['Bindings']) => ArchivosDependencies,
): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();
  app.openapi(
    createRoute({
      method: 'get',
      path: '/items',
      tags: ['archivos'],
      operationId: 'archivosList',
      request: { query: z.object({ managementSpecificId: IdSchema }) },
      responses: {
        ...ApiInternalErrorResponse,
        ...ApiBadRequestResponse,
        ...ApiServiceUnavailableResponse,
        401: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'No autenticado.',
        },
        200: {
          content: {
            'application/json': {
              schema: z.object({ exito: z.literal(true), mensaje: z.array(FileSchema), meta }),
            },
          },
          description: 'Archivo de una gestión específica.',
        },
      },
    }),
    async (c) => {
      await authenticatedUser(c.req.raw, c.env);
      const resolved = dependencies(c.env);
      const records = await resolved.repository.listByManagementSpecific(
        c.req.valid('query').managementSpecificId,
      );
      return c.json(
        {
          exito: true as const,
          mensaje: Array.from(records),
          meta: { requestId: c.get('requestId') },
        },
        200,
      );
    },
  );
  app.openapi(
    createRoute({
      method: 'get',
      path: '/items/{id}',
      tags: ['archivos'],
      operationId: 'archivosGet',
      request: { params: z.object({ id: IdSchema }) },
      responses: {
        ...ApiInternalErrorResponse,
        ...ApiBadRequestResponse,
        ...ApiServiceUnavailableResponse,
        401: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'No autenticado.',
        },
        200: {
          content: {
            'application/json': {
              schema: z.object({ exito: z.literal(true), mensaje: FileSchema, meta }),
            },
          },
          description: 'Archivo antecedente.',
        },
        404: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Archivo no encontrado.',
        },
      },
    }),
    async (c) => {
      await authenticatedUser(c.req.raw, c.env);
      const record = await dependencies(c.env).repository.findById(c.req.valid('param').id);
      if (!record) throw new AppError('RESOURCE_NOT_FOUND', 'El archivo no existe.', 404);
      return c.json(
        { exito: true as const, mensaje: record, meta: { requestId: c.get('requestId') } },
        200,
      );
    },
  );
  app.openapi(
    createRoute({
      method: 'post',
      path: '/items',
      tags: ['archivos'],
      operationId: 'archivosUpload',
      request: {
        body: {
          content: {
            'multipart/form-data': {
              schema: z.object({ file: z.any(), managementSpecificId: IdSchema }),
            },
          },
        },
      },
      responses: {
        ...ApiInternalErrorResponse,
        ...ApiBadRequestResponse,
        ...ApiServiceUnavailableResponse,
        201: {
          content: {
            'application/json': {
              schema: z.object({ exito: z.literal(true), mensaje: FileSchema, meta }),
            },
          },
          description: 'Archivo cargado.',
        },
        400: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Archivo o gestión inválidos.',
        },
        401: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'No autenticado.',
        },
      },
    }),
    async (c) => {
      await authenticatedUser(c.req.raw, c.env);
      let form: FormData;
      try {
        form = await c.req.raw.formData();
      } catch {
        throw new AppError(
          'INVALID_MULTIPART',
          'La solicitud debe incluir un archivo y enviarse como multipart/form-data.',
          400,
        );
      }
      const file = form.get('file');
      const managementSpecificId = String(form.get('managementSpecificId') ?? '');
      if (!(file instanceof File) || !/^[1-9]\d{0,18}$/.test(managementSpecificId))
        throw new AppError('INVALID_FILE', 'Debes enviar file y managementSpecificId válido.', 400);
      const id = crypto.randomUUID();
      const reference = await dependencies(c.env).storage.put(
        `${managementSpecificId}/${id}-${file.name}`,
        file.stream(),
        file.type || 'application/octet-stream',
      );
      const record = await dependencies(c.env).repository.saveMetadata({
        id: managementSpecificId,
        managementSpecificId,
        storageReference: reference,
        uploadedAt: new Date().toISOString(),
      });
      return c.json(
        { exito: true as const, mensaje: record, meta: { requestId: c.get('requestId') } },
        201,
      );
    },
  );
  app.openapi(
    createRoute({
      method: 'get',
      path: '/items/{id}/download',
      tags: ['archivos'],
      operationId: 'archivosDownload',
      request: { params: z.object({ id: IdSchema }) },
      responses: {
        ...ApiInternalErrorResponse,
        ...ApiBadRequestResponse,
        ...ApiServiceUnavailableResponse,
        200: {
          content: {
            'application/octet-stream': { schema: z.string().openapi({ format: 'binary' }) },
          },
          description: 'Contenido del archivo.',
        },
        401: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'No autenticado.',
        },
        404: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Archivo no encontrado.',
        },
      },
    }),
    async (c) => {
      await authenticatedUser(c.req.raw, c.env);
      const record = await dependencies(c.env).repository.findById(c.req.valid('param').id);
      if (!record) throw new AppError('RESOURCE_NOT_FOUND', 'El archivo no existe.', 404);
      const body = await dependencies(c.env).storage.get(record.storageReference);
      if (!body)
        throw new AppError(
          'RESOURCE_NOT_FOUND',
          'El archivo no existe en el servidor de almacenamiento.',
          404,
        );
      return new Response(body, {
        headers: {
          'content-type': 'application/octet-stream',
          'content-disposition': `attachment; filename="${record.id}"`,
        },
      });
    },
  );
  return app;
}
