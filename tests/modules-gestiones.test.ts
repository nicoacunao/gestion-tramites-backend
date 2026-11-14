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
    list: async (responsibleUserId) =>
      responsibleUserId === undefined
        ? items
        : items.filter((item) => item.responsibleUserId === responsibleUserId),
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
    authenticate: async (request) => ({
      id: request.headers.get('x-user-id') ?? 'u-1',
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
      version: 1,
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

  it('devuelve la gestión específica N2 y sus antecedentes requeridos N3', async () => {
    const specific = {
      ...management,
      specificManagementId: '4',
      specificManagementName: 'Solicitud de patente PRONTO',
      managementTypeName: 'Patente comercial',
      managementTypeCode: 'patente-comercial',
      creationMode: 'subtramite' as const,
      level: 'N2' as const,
    };
    const background = {
      id: '20',
      managementId: '1001',
      parentManagementBackgroundId: null,
      managementTypeId: 'patente-comercial',
      backgroundId: '30',
      level: 'N3' as const,
      required: true,
      responsibleUserId: null,
      status: 'Pendiente',
      fileReference: null,
      uploadedAt: null,
      version: 1,
    };
    const router = app(repository([specific], [background]));
    const detail = await router.request('/items/1001', { headers: auth });
    const backgrounds = await router.request('/items/1001/backgrounds', { headers: auth });

    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({
      data: {
        level: 'N2',
        specificManagementId: '4',
        specificManagementName: 'Solicitud de patente PRONTO',
        managementTypeId: 'patente-comercial',
        managementTypeName: 'Patente comercial',
        managementTypeCode: 'patente-comercial',
        descripcion: 'Solicitud de patente PRONTO',
      },
    });
    expect(backgrounds.status).toBe(200);
    expect(await backgrounds.json()).toMatchObject({
      data: [{ backgroundId: '30', level: 'N3', parentManagementBackgroundId: null }],
    });
  });

  it('preserva el vínculo N2 al crear automáticamente antecedentes y etapas', async () => {
    const repo = repository([]);
    let received: Record<string, unknown> | undefined;
    repo.createComplete = async (input) => {
      received = input as unknown as Record<string, unknown>;
      return {
        ...management,
        id: input.id,
        level: 'N2',
        creationMode: input.creationMode,
        specificManagementId: input.specificManagementId,
        specificManagementName: 'Solicitud de patente PRONTO',
        managementTypeName: 'Patente comercial',
        managementTypeCode: 'patente-comercial',
        version: 1,
      };
    };
    const input = { ...management, id: 'BACKEND-N2-N3-001', level: 'N2' as const };
    delete (input as Partial<Management>).version;
    const response = await app(repo).request('/items', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        ...input,
        stationId: '00000',
        scopeCode: 'DOM',
        sequence: 1200,
        priority: 'Media',
        requesterName: 'Prueba N2 N3',
        status: 'Borrador',
        creationMode: 'subtramite',
        specificManagementId: '4',
      }),
    });

    expect(response.status).toBe(201);
    expect(received).toMatchObject({
      id: 'BACKEND-N2-N3-001',
      creationMode: 'subtramite',
      specificManagementId: '4',
    });
    expect(received?.requiredBackgrounds).toBeUndefined();
    expect(received?.complementaryBackgrounds).toBeUndefined();
    expect(received?.stages).toBeUndefined();
    expect(await response.json()).toMatchObject({
      data: {
        level: 'N2',
        specificManagementId: '4',
        specificManagementName: 'Solicitud de patente PRONTO',
      },
    });
  });

  it('filtra por el usuario autenticado y no por un userId enviado', async () => {
    const otherManagement = { ...management, id: '1002', responsibleUserId: 'u-2' };
    const router = app(repository([management, otherManagement]));
    const response = await router.request('/items?assignedToMe=true&userId=u-2', {
      headers: { ...auth, 'x-user-id': 'u-1' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: [{ id: '1001' }] });

    const all = await router.request('/items', { headers: auth });
    expect(all.status).toBe(200);
    expect(await all.json()).toMatchObject({ data: [{ id: '1001' }, { id: '1002' }] });
  });

  it('devuelve una lista vacía si el usuario autenticado no tiene gestiones', async () => {
    const response = await app(repository([management])).request('/items?assignedToMe=true', {
      headers: { ...auth, 'x-user-id': 'u-without-management' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: [] });
  });

  it('rechaza el listado asignado si el usuario no tiene permisos', async () => {
    const response = await app(repository()).request('/items?assignedToMe=true', {
      headers: { 'x-user-id': 'u-1' },
    });

    expect(response.status).toBe(403);
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

  it('actualiza la fecha de carga, permite responsable nulo y conserva la versión', async () => {
    const background: ManagementBackground = {
      id: '10',
      managementId: '1001',
      parentManagementBackgroundId: null,
      managementTypeId: 'patente-comercial',
      backgroundId: '20',
      level: 'N2',
      required: true,
      responsibleUserId: null,
      status: 'Pendiente',
      fileReference: null,
      uploadedAt: null,
      version: 0,
    };
    const repo = repository([management], [background]);
    repo.updateBackground = async (id, input, expectedVersion) => ({
      ...background,
      ...input,
      id,
      version: expectedVersion + 1,
    });
    const response = await app(repo).request('/backgrounds/10', {
      method: 'PUT',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        responsibleUserId: null,
        status: 'Recibido',
        fileReference: 'storage://file-1',
        uploadedAt: '2026-11-13',
        version: 0,
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { responsibleUserId: null, uploadedAt: '2026-11-13', version: 1 },
    });
  });

  it('permite completar una etapa después de creada y mantiene completedOn nullable', async () => {
    const stage = {
      id: '30',
      managementId: '1001',
      stageId: '40',
      stageName: 'Revisión',
      percentage: 50,
      status: 'En curso',
      estimatedOn: '2026-11-20',
      completedOn: null,
      responsible: null,
      notes: null,
      version: 0,
    };
    const repo = repository();
    repo.findStage = async (id) => (id === stage.id ? stage : null);
    repo.updateStage = async (id, input, expectedVersion) => ({
      ...stage,
      ...input,
      id,
      version: expectedVersion + 1,
    });
    const response = await app(repo).request('/stages/30', {
      method: 'PUT',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'Completado',
        estimatedOn: '2026-11-20',
        completedOn: '2026-11-21',
        responsibleUserId: null,
        notes: 'Validada',
        version: 0,
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { completedOn: '2026-11-21', responsible: '', version: 1 },
    });
  });
});
