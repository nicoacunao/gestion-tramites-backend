import { describe, expect, it } from 'vitest';
import { createBitacoraRouter } from '../src/modules/bitacora/http/router';
import type { LogRepository } from '../src/modules/bitacora/application/ports';
import type { LogEntry } from '../src/modules/bitacora/domain/log-entry';
import { AppError } from '../src/shared/errors/app-error';

const entry: LogEntry = {
  id: '1',
  managementId: '1001',
  userId: '1',
  registeredOn: '2026-11-05',
  registeredAt: '10:30:00',
  title: 'Documento recibido',
  comment: 'Se recibió el antecedente solicitado.',
  type: 'novedad',
};

function repository(initial: LogEntry[] = [entry]): LogRepository {
  const entries = [...initial];
  return {
    listByManagement: async (managementId) =>
      entries.filter((item) => item.managementId === managementId),
    findById: async (id) => entries.find((item) => item.id === id) ?? null,
    append: async (value) => {
      const created = {
        ...value,
        id: String(entries.length + 1),
        registeredOn: value.registeredOn ?? '2026-11-05',
        registeredAt: value.registeredAt ?? '10:30:00',
      };
      entries.push(created);
      return created;
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
  it('lista y obtiene entradas por id_gestion e id_entrada_bitacora', async () => {
    const router = app(repository());
    expect((await router.request('/items?managementId=1001')).status).toBe(200);
    const detail = await router.request('/items/1');
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ data: { id: '1', managementId: '1001' } });
  });

  it('crea una entrada y conserva la validación de tipos', async () => {
    const response = await app(repository([])).request('/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        managementId: '1001',
        userId: '1',
        registeredOn: '2026-11-05',
        registeredAt: '10:30:00',
        title: 'Ingreso',
        comment: 'Se registró la gestión.',
        type: 'inicio',
      }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ data: { id: '1', type: 'inicio' } });
  });

  it('rechaza un tipo no permitido', async () => {
    const response = await app(repository([])).request('/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        managementId: '1001',
        userId: '1',
        title: 'Ingreso',
        comment: 'Texto',
        type: 'otro',
      }),
    });
    expect(response.status).toBe(400);
  });
});
