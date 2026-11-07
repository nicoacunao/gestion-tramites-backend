import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/config/bindings';
import { authenticatedUser } from '../../../shared/auth/request-auth';
import { AppError } from '../../../shared/errors/app-error';
import type { FileRepository, FileStorage } from '../application/ports';

export interface ArchivosDependencies {
  repository: FileRepository;
  storage: FileStorage;
}

export function createArchivosRouter(
  dependencies: (env: AppEnv['Bindings']) => ArchivosDependencies,
): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
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
