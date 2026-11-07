import { describe, expect, it } from 'vitest';
import { createBitacoraRouter } from '../src/modules/bitacora/http/router';
import type { LogRepository } from '../src/modules/bitacora/application/ports';
import type { LogEntry } from '../src/modules/bitacora/domain/log-entry';
import { AppError } from '../src/shared/errors/app-error';

const entry: LogEntry = {
  id: 'BIT-001',
  managementId: '1001',
  userId: '1',
  registeredOn: '2026-11-05',
  registeredAt: '10:30:00',
  title: 'Documento recibido',
  comment: 'Se recibió el antecedente solicitado.',
  version: 1,
};

function repository(initial: LogEntry[] = [entry]): LogRepository {
  const entries = [...initial];
  return {
    listByManagement: async (managementId) =>
      entries.filter((item) => item.managementId === managementId),
    findById: async (id) => entries.find((item) => item.id === id) ?? null,
    append: async (value) => {
      if (entries.some((item) => item.id === value.id))
        throw new AppError('RESOURCE_CONFLICT', 'conflicto', 409);
      entries.push(value);
    },
  };
}

function app(repo: LogRepository) {
  const router = createBitacoraRouter({ repository: repo });
  router.onError((error, context) => {
    const appError =
      error instanceof AppError ? error : new AppError('INTERNAL_ERROR', 'Error', 500);
    return context.json(
      { error: { code: appError.code, message: appError.message }, meta: { requestId: 'test' } },
      appError.status,
    );
  });
  return router;
}

describe('bitácora', () => {
  it('lista y obtiene entradas asociadas a una gestión', async () => {
    const router = app(repository());
    const list = await router.request('/items?managementId=1001');
    const detail = await router.request('/items/BIT-001');

    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ data: [{ id: 'BIT-001', managementId: '1001' }] });
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ data: { title: 'Documento recibido' } });
  });

  it('crea una entrada y asigna la primera versión', async () => {
    const input = { ...entry };
    delete (input as Partial<LogEntry>).version;
    const response = await app(repository([])).request('/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ data: { id: 'BIT-001', version: 1 } });
  });

  it('rechaza título o comentario vacíos y no requiere autorización', async () => {
    const router = app(repository([]));
    const emptyTitle = await router.request('/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...entry, title: '   ' }),
    });
    const emptyComment = await router.request('/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...entry, comment: '' }),
    });
    const withoutAuth = await router.request('/items?managementId=1001');

    expect(emptyTitle.status).toBe(400);
    expect(emptyComment.status).toBe(400);
    expect(withoutAuth.status).toBe(200);
  });

  it('devuelve no encontrado para una entrada inexistente', async () => {
    const response = await app(repository()).request('/items/missing');

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: 'RESOURCE_NOT_FOUND' },
    });
  });
});
