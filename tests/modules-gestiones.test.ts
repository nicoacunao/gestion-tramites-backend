import { describe, expect, it } from 'vitest';
import { createGestionesRouter } from '../src/modules/gestiones/http/router';
import type { ManagementRepository } from '../src/modules/gestiones/application/ports';
import type { Management, ManagementBackground } from '../src/modules/gestiones/domain/management';
import { AppError } from '../src/shared/errors/app-error';

const management: Management = {
  id: '1001',
  stationId: '60001',
  managementTypeId: 'patente-comercial',
  scopeCode: 'PAT',
  responsibleUserId: 'u-1',
  level: 'N1',
  sequence: 1,
  openedOn: '2026-07-02',
  estimatedCompletionOn: '2026-07-12',
  lastReviewedOn: '2026-07-08',
  priority: 'Alta',
  requesterName: 'Claudio Doñas',
  status: 'Ingresado',
  version: 1,
};

function repository(
  initial: Management[] = [management],
  backgrounds: ManagementBackground[] = [],
): ManagementRepository {
  const items = [...initial];
  return {
    list: async () => items,
    findById: async (id) => items.find((item) => item.id === id) ?? null,
    save: async (value, expectedVersion) => {
      const index = items.findIndex((item) => item.id === value.id);
      if (index >= 0 && expectedVersion !== undefined && items[index]?.version !== expectedVersion)
        throw new AppError('VERSION_CONFLICT', 'conflicto', 409);
      if (index >= 0) items[index] = value;
      else items.push(value);
    },
    listBackgrounds: async () => backgrounds,
    listStages: async () => [],
  };
}

function app(repo: ManagementRepository) {
  const router = createGestionesRouter({
    repository: repo,
    authorize: (request, role) => request.headers.get('x-role') === role,
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

const auth = { 'x-role': 'gestiones' };

describe('gestiones', () => {
  it('lista y obtiene una gestión con el envelope estándar', async () => {
    const router = app(repository());
    const list = await router.request('/items', { headers: auth });
    const detail = await router.request('/items/1001', { headers: auth });

    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({
      data: [
        {
          id: '1001',
          codigo: '1001',
          nivel: 'N1',
          codigoAmbito: 'PAT',
          correlativo: 1,
          semaforo: 'al-dia',
          semaforoEtiqueta: 'Al día',
          fechaInicio: '02-07-2026',
          fechaIngreso: '02-07-2026',
          fechaIngresoOrden: '2026-07-02',
          fechaEstimadaTermino: '12-07-2026',
          responsableInterno: 'u-1',
        },
      ],
    });
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ data: { priority: 'Alta' } });
  });

  it('crea una gestión y asigna la primera versión', async () => {
    const input = { ...management };
    delete (input as Partial<Management>).version;
    const response = await app(repository([])).request('/items', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ data: { id: '1001', version: 1 } });
  });

  it('normaliza el payload legado de TramiteNuevo dentro del alta transaccional', async () => {
    const repo = repository([]);
    let completeInput: Record<string, unknown> | undefined;
    repo.createComplete = async (input) => {
      completeInput = input as unknown as Record<string, unknown>;
      return { ...management, id: input.id, version: 1 };
    };
    const input = { ...management, id: '1002' };
    delete (input as Partial<Management>).version;

    const response = await app(repo).request('/items', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        ...input,
        subtramitesAsociados: ['Recepción definitiva'],
        antecedentesConfigurados: ['Certificado de dominio vigente'],
        antecedentesComplementariosConfigurados: ['Fotografías'],
        etapasConfiguradas: ['Consulta y definición de antecedentes'],
      }),
    });

    expect(response.status).toBe(201);
    expect(completeInput).toMatchObject({
      associatedSpecificManagementIds: ['Recepción definitiva'],
      requiredBackgrounds: [{ name: 'Certificado de dominio vigente', required: true }],
      complementaryBackgrounds: [{ name: 'Fotografías', required: false }],
      stages: [{ name: 'Consulta y definición de antecedentes', status: 'Pendiente' }],
    });
  });

  it('actualiza con control de concurrencia optimista', async () => {
    const response = await app(repository()).request('/items/1001', {
      method: 'PUT',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ ...management, priority: 'Media', version: 1 }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { priority: 'Media', version: 2 } });
  });

  it('rechaza validación, fechas incoherentes y solicitudes sin autorización', async () => {
    const router = app(repository());
    const invalid = await router.request('/items', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ ...management, priority: 'Urgente' }),
    });
    const dates = await router.request('/items', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ ...management, id: '1002', estimatedCompletionOn: '2026-07-01' }),
    });
    const unauthorized = await router.request('/items');

    expect(invalid.status).toBe(400);
    expect(dates.status).toBe(422);
    expect(unauthorized.status).toBe(403);
  });

  it('devuelve no encontrado y conflicto de versión', async () => {
    const router = app(repository());
    const missing = await router.request('/items/missing', { headers: auth });
    const conflict = await router.request('/items/1001', {
      method: 'PUT',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ ...management, version: 9 }),
    });

    expect(missing.status).toBe(404);
    expect(conflict.status).toBe(409);
  });

  it('devuelve el nivel y el padre de cada antecedente', async () => {
    const backgrounds: ManagementBackground[] = [
      {
        id: '10',
        managementId: '1001',
        parentManagementBackgroundId: null,
        managementTypeId: 'patente-comercial',
        backgroundId: '20',
        level: 'N2',
        required: true,
        responsibleUserId: '',
        status: 'Pendiente',
        fileReference: null,
        uploadedAt: null,
        version: 1,
      },
      {
        id: '11',
        managementId: '1001',
        parentManagementBackgroundId: '10',
        managementTypeId: 'patente-comercial',
        backgroundId: '21',
        level: 'N3',
        required: true,
        responsibleUserId: '',
        status: 'Pendiente',
        fileReference: null,
        uploadedAt: null,
        version: 1,
      },
    ];
    const response = await app(repository([management], backgrounds)).request(
      '/items/1001/backgrounds',
      { headers: auth },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [
        { id: '10', level: 'N2', parentManagementBackgroundId: null },
        { id: '11', level: 'N3', parentManagementBackgroundId: '10' },
      ],
    });
  });

  it('valida y reenvía el nivel al crear un antecedente', async () => {
    const repo = repository();
    let received: unknown;
    repo.createBackground = async (_managementId, input) => {
      received = input;
      return {
        id: '12',
        managementId: '1001',
        parentManagementBackgroundId: '10',
        managementTypeId: 'patente-comercial',
        backgroundId: input.backgroundId ?? '',
        level: input.level,
        required: input.required,
        responsibleUserId: '',
        status: input.status ?? 'Pendiente',
        fileReference: null,
        uploadedAt: null,
        version: 1,
      };
    };
    const response = await app(repo).request('/items/1001/backgrounds', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        backgroundId: '21',
        parentBackgroundId: '10',
        level: 'N3',
        name: 'Certificado',
        category: 'requerido',
        required: true,
      }),
    });

    expect(response.status).toBe(201);
    expect(received).toMatchObject({ level: 'N3', parentBackgroundId: '10' });
    expect(
      (
        await app(repo).request('/items/1001/backgrounds', {
          method: 'POST',
          headers: { ...auth, 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Sin nivel',
            category: 'requerido',
            required: true,
          }),
        })
      ).status,
    ).toBe(400);
  });
});
