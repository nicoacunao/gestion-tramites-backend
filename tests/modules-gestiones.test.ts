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

  it('crea y edita una etapa de una gestión con validación de fechas', async () => {
    const repo = repository();
    const stage = {
      id: '30',
      managementId: '1001',
      stageId: '4',
      stageName: 'Ingreso',
      percentage: 30,
      status: 'Pendiente',
      estimatedOn: '2026-07-10',
      completedOn: null,
      responsible: null,
      responsibleUserId: null,
      notes: null,
    };
    repo.createStage = async () => stage;
    repo.findStage = async () => stage;
    repo.updateStage = async (_id, input) => ({ ...stage, ...input });
    const router = app(repo);
    const created = await router.request('/items/1001/stages', {
      method: 'POST',
      headers: { 'x-role': 'gestiones', 'content-type': 'application/json' },
      body: JSON.stringify({ stageId: '4', estimatedOn: '2026-07-10', completedOn: null }),
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ mensaje: { id: '30', managementId: '1001' } });

    const invalid = await router.request('/stages/30', {
      method: 'PUT',
      headers: { 'x-role': 'gestiones', 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'Completado',
        estimatedOn: '2026-07-10',
        completedOn: '2026-07-09',
        responsibleUserId: null,
        notes: null,
      }),
    });
    expect(invalid.status).toBe(422);
  });

  it('crea y actualiza un antecedente como instancia de gestión específica', async () => {
    const repo = repository();
    const specific = {
      id: '91',
      managementId: '1001',
      parentSpecificManagementId: null,
      managementTypeId: '12',
      managementTypeName: 'Permiso de obra',
      level: 1,
      required: true,
      responsibleUserId: '1',
      responsibleName: 'Test User',
      status: 'Pendiente',
      fileUrl: null,
      uploadedAt: '2026-07-02T12:00:00Z',
    };
    repo.createSpecific = async () => specific;
    repo.findSpecific = async () => specific;
    repo.updateSpecific = async (_id, input) => ({
      ...specific,
      status: input.status,
      fileUrl: input.fileReference,
    });
    const router = app(repo);
    const created = await router.request('/items/1001/backgrounds', {
      method: 'POST',
      headers: { 'x-role': 'gestiones', 'content-type': 'application/json' },
      body: JSON.stringify({ managementTypeId: '12' }),
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      mensaje: { id: '91', backgroundId: '12', required: true, level: 'N1' },
    });

    const updated = await router.request('/backgrounds/91', {
      method: 'PUT',
      headers: { 'x-role': 'gestiones', 'content-type': 'application/json' },
      body: JSON.stringify({ responsibleUserId: null, status: 'Recibido', fileReference: null }),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ mensaje: { status: 'Recibido' } });
  });
});
