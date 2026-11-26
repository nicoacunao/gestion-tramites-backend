import { describe, expect, it } from 'vitest';
import { createGestionesRouter } from '../src/modules/gestiones/http/router';
import type { ManagementRepository } from '../src/modules/gestiones/application/ports';
import type { Management } from '../src/modules/gestiones/domain/management';
import { AppError } from '../src/shared/errors/app-error';

const management: Management = {
  id: '1001',
  stationId: '60001',
  responsibleUserId: '1',
  createdAt: '2026-07-02T12:00:00Z',
  openedOn: '2026-07-02',
  estimatedCompletionOn: '2026-07-12',
  lastReviewedOn: '2026-07-08',
  priority: 'Alta',
  status: 'Ingresado',
  requesterName: 'Claudio Doñas',
};

function repository(initial: Management[] = [management]): ManagementRepository {
  const items = [...initial];
  return {
    list: async (responsibleUserId) =>
      responsibleUserId
        ? items.filter((item) => item.responsibleUserId === responsibleUserId)
        : items,
    findById: async (id) => items.find((item) => item.id === id) ?? null,
    save: async (value) => {
      const item = {
        ...value,
        id: value.id ?? String(items.length + 1001),
        createdAt: value.createdAt ?? '2026-07-02T12:00:00Z',
      } as Management;
      const index = items.findIndex((entry) => entry.id === item.id);
      if (index >= 0) items[index] = item;
      else items.push(item);
      return item;
    },
    listStages: async () => [],
  };
}

function app(repo: ManagementRepository) {
  const router = createGestionesRouter({
    repository: repo,
    authorize: (request, role) => request.headers.get('x-role') === role,
    authenticate: async () => ({
      id: '1',
      rut: '1-1',
      passwordHash: '',
      names: 'Test',
      firstSurname: 'User',
      secondSurname: null,
      email: 'test@example.com',
      phone: null,
      description: null,
      role: 'gestiones',
      organization: null,
      active: true,
      lastSessionAt: null,
    }),
  });
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

describe('gestiones', () => {
  it('lista y obtiene gestiones por id_gestion', async () => {
    const router = app(repository());
    expect((await router.request('/items', { headers: { 'x-role': 'gestiones' } })).status).toBe(
      200,
    );
    const response = await router.request('/items/1001', { headers: { 'x-role': 'gestiones' } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      exito: true,
      mensaje: { id: '1001', status: 'Ingresado' },
    });
  });

  it('crea una gestión sin código y retorna el id generado', async () => {
    const router = app(repository([]));
    const response = await router.request('/items', {
      method: 'POST',
      headers: { 'x-role': 'gestiones', 'content-type': 'application/json' },
      body: JSON.stringify({
        stationId: '60001',
        responsibleUserId: '1',
        openedOn: '2026-07-02',
        estimatedCompletionOn: null,
        lastReviewedOn: null,
        priority: 'Media',
        status: 'Borrador',
        requesterName: 'Ana',
      }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      exito: true,
      mensaje: { id: '1001', status: 'Borrador' },
    });
  });

  it('rechaza un id de gestión no numérico', async () => {
    const response = await app(repository()).request('/items/ABC', {
      headers: { 'x-role': 'gestiones' },
    });
    expect(response.status).toBe(400);
  });
});
