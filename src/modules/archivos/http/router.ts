import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
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
        200: {
          content: {
            'application/json': { schema: z.object({ data: z.array(FileSchema), meta }) },
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
      return c.json({ data: Array.from(records), meta: { requestId: c.get('requestId') } }, 200);
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
        200: {
          content: { 'application/json': { schema: z.object({ data: FileSchema, meta }) } },
          description: 'Archivo antecedente.',
        },
        404: {
          content: { 'application/json': { schema: z.any() } },
          description: 'Archivo no encontrado.',
        },
      },
    }),
    async (c) => {
      await authenticatedUser(c.req.raw, c.env);
      const record = await dependencies(c.env).repository.findById(c.req.valid('param').id);
      if (!record) throw new AppError('RESOURCE_NOT_FOUND', 'El archivo no existe.', 404);
      return c.json({ data: record, meta: { requestId: c.get('requestId') } }, 200);
    },
  );
  app.post('/items', async (c) => {
    await authenticatedUser(c.req.raw, c.env);
    const form = await c.req.raw.formData();
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
    return c.json({ data: record, meta: { requestId: c.get('requestId') } }, 201);
  });
  app.get('/items/:id/download', async (c) => {
    await authenticatedUser(c.req.raw, c.env);
    const record = await dependencies(c.env).repository.findById(c.req.param('id'));
    if (!record) throw new AppError('RESOURCE_NOT_FOUND', 'El archivo no existe.', 404);
    const body = await dependencies(c.env).storage.get(record.storageReference);
    if (!body) throw new AppError('RESOURCE_NOT_FOUND', 'El archivo no existe en OneDrive.', 404);
    return new Response(body, {
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename="${record.id}"`,
      },
    });
  });
  return app;
}
