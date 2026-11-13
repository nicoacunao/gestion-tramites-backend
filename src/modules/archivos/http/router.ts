import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { AppEnv } from '../../../shared/config/bindings';
import { authenticatedUser } from '../../../shared/auth/request-auth';
import { AppError } from '../../../shared/errors/app-error';
import type { FileRepository, FileStorage } from '../application/ports';

export interface ArchivosDependencies {
  repository: FileRepository;
  storage: FileStorage;
}

const FileSchema = z
  .object({
    id: z.string(),
    managementId: z.string(),
    managementBackgroundId: z.string().nullable(),
    storageProvider: z.string(),
    storageReference: z.string(),
    fileName: z.string(),
    mediaType: z.string(),
    sizeBytes: z.number().nonnegative(),
    uploadedByUserId: z.string(),
    uploadedAt: z.string(),
    version: z.number().int().nonnegative(),
  })
  .openapi('FileRecord');
const FileResponseSchema = z
  .object({ data: FileSchema, meta: z.object({ requestId: z.string() }) })
  .openapi('FileResponse');
const FileListResponseSchema = z
  .object({ data: z.array(FileSchema), meta: z.object({ requestId: z.string() }) })
  .openapi('FileListResponse');

const listRoute = createRoute({
  method: 'get',
  path: '/items',
  tags: ['archivos'],
  operationId: 'archivosList',
  request: { query: z.object({ managementId: z.string().trim().min(1).max(100) }) },
  responses: {
    200: {
      content: { 'application/json': { schema: FileListResponseSchema } },
      description: 'Archivos de una gestión.',
    },
    400: {
      content: { 'application/json': { schema: z.any() } },
      description: 'Consulta inválida.',
    },
  },
});
const detailRoute = createRoute({
  method: 'get',
  path: '/items/{id}',
  tags: ['archivos'],
  operationId: 'archivosGet',
  request: { params: z.object({ id: z.string().trim().min(1).max(100) }) },
  responses: {
    200: {
      content: { 'application/json': { schema: FileResponseSchema } },
      description: 'Archivo.',
    },
    404: {
      content: { 'application/json': { schema: z.any() } },
      description: 'Archivo no encontrado.',
    },
  },
});

export function createArchivosRouter(
  dependencies: (env: AppEnv['Bindings']) => ArchivosDependencies,
): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();
  app.openapi(listRoute, async (c) => {
    await authenticatedUser(c.req.raw, c.env);
    if (!c.env.database)
      throw new AppError('DATABASE_NOT_CONFIGURED', 'No hay base de datos.', 503);
    const managementId = c.req.valid('query').managementId;
    const resolved = dependencies(c.env);
    const records = await resolved.repository.listByManagement(managementId);
    return c.json({ data: Array.from(records), meta: { requestId: c.get('requestId') } }, 200);
  });
  app.openapi(detailRoute, async (c) => {
    await authenticatedUser(c.req.raw, c.env);
    if (!c.env.database)
      throw new AppError('DATABASE_NOT_CONFIGURED', 'No hay base de datos.', 503);
    const resolved = dependencies(c.env);
    const record = await resolved.repository.findById(c.req.valid('param').id);
    if (!record) throw new AppError('RESOURCE_NOT_FOUND', 'El archivo no existe.', 404);
    return c.json({ data: record, meta: { requestId: c.get('requestId') } }, 200);
  });
  app.post('/items', async (c) => {
    const user = await authenticatedUser(c.req.raw, c.env);
    if (!c.env.database)
      throw new AppError('DATABASE_NOT_CONFIGURED', 'No hay base de datos.', 503);
    const form = await c.req.raw.formData();
    const file = form.get('file');
    const managementId = String(form.get('managementId') ?? '');
    const backgroundId = form.get('managementBackgroundId');
    if (!(file instanceof File) || !managementId)
      throw new AppError('INVALID_FILE', 'Debes enviar file y managementId.', 400);
    const id = crypto.randomUUID();
    const key = `${managementId}/${id}-${file.name}`;
    const resolved = dependencies(c.env);
    const reference = await resolved.storage.put(
      key,
      file.stream(),
      file.type || 'application/octet-stream',
    );
    const record = {
      id,
      managementId,
      managementBackgroundId: backgroundId ? String(backgroundId) : null,
      storageProvider: 'onedrive',
      storageReference: reference,
      fileName: file.name,
      mediaType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      uploadedByUserId: user.id,
      uploadedAt: new Date().toISOString(),
      version: 1,
    };
    await resolved.repository.saveMetadata(record);
    return c.json({ data: record, meta: { requestId: c.get('requestId') } }, 201);
  });
  app.get('/items/:id/download', async (c) => {
    await authenticatedUser(c.req.raw, c.env);
    if (!c.env.database)
      throw new AppError('DATABASE_NOT_CONFIGURED', 'No hay base de datos.', 503);
    const resolved = dependencies(c.env);
    const record = await resolved.repository.findById(c.req.param('id'));
    if (!record) throw new AppError('RESOURCE_NOT_FOUND', 'El archivo no existe.', 404);
    const body = await resolved.storage.get(record.storageReference);
    if (!body) throw new AppError('RESOURCE_NOT_FOUND', 'El archivo no existe en OneDrive.', 404);
    return new Response(body, {
      headers: {
        'content-type': record.mediaType,
        'content-disposition': `attachment; filename="${record.fileName.replaceAll('"', '')}"`,
      },
    });
  });
  return app;
}
