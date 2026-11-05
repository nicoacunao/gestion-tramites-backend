import { describe, expect, it } from 'vitest';
import { createCatalogosRouter } from '../src/modules/catalogos/http/router';
import type { CatalogRepository } from '../src/modules/catalogos/application/ports';
import type { Station } from '../src/modules/catalogos/domain/catalog';
import { AppError } from '../src/shared/errors/app-error';

const station: Station = {
  id: '60001',
  name: null,
  address: 'Huechuraba',
  commune: 'Huechuraba',
  legalName: 'Comercial y Servicios Soar Limitada',
  zoneManager: 'Zona Norte',
  commercialManager: 'Área Comercial',
  companyRut: '77.618.579-5',
  legalRepresentative: 'Ana Pérez',
  legalRepresentativeRut: null,
  status: 'active',
  version: 1,
};

function repository(initial: Station[] = [station]): CatalogRepository {
  const items = [...initial];
  return {
    listStations: async () => items,
    findStationById: async (id) => items.find((item) => item.id === id) ?? null,
    saveStation: async (value, expectedVersion) => {
      const index = items.findIndex((item) => item.id === value.id);
      if (index >= 0 && expectedVersion !== undefined && items[index]?.version !== expectedVersion)
        throw new AppError('VERSION_CONFLICT', 'conflicto', 409);
      if (index >= 0) items[index] = value;
      else items.push(value);
    },
    listScopes: async () => [],
    listManagementTypes: async () => [],
    listTypeRelations: async () => [],
    listBackgrounds: async () => [],
    listStages: async () => [],
  };
}

function app(repo: CatalogRepository) {
  const router = createCatalogosRouter({
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

const auth = { 'x-role': 'indagación' };

describe('catálogos de estaciones', () => {
  it('lista estaciones con el envelope estándar', async () => {
    const response = await app(repository()).request('/items', { headers: auth });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [{ id: '60001', legalName: station.legalName }],
      meta: {},
    });
  });

  it('crea una estación', async () => {
    const response = await app(repository([])).request('/items', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ ...station }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ data: { version: 1, id: '60001' } });
  });

  it('rechaza un body inválido y una solicitud sin autorización', async () => {
    const invalid = await app(repository([])).request('/items', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ id: '' }),
    });
    expect(invalid.status).toBe(400);
    const unauthorized = await app(repository()).request('/items');
    expect(unauthorized.status).toBe(403);
  });

  it('devuelve no encontrado y detecta conflicto de versión', async () => {
    const missing = await app(repository()).request('/items/missing', { headers: auth });
    expect(missing.status).toBe(404);
    const conflict = await app(repository()).request('/items/60001', {
      method: 'PUT',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ ...station, version: 9 }),
    });
    expect(conflict.status).toBe(409);
  });
});
