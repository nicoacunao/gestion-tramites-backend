import { describe, expect, it, vi } from 'vitest';
import type { SqlExecutor } from '../src/infrastructure/persistence/postgres/connection';
import { PostgresStationRepository } from '../src/modules/estaciones';
import { PostgresGestionesEspecificasRepository } from '../src/modules/gestiones-especificas';
import { StationService } from '../src/modules/estaciones/application/service';
import { createGestionesEspecificasModule } from '../src/modules/gestiones-especificas';
import { createCatalogosModule } from '../src/modules/catalogos';

const stationRow = {
  id_estacion: '60001',
  direccion: 'Dirección',
  comuna: 'Comuna',
  razon_social: 'Sociedad',
  jefe_zona: null,
  jefe_comercial: null,
  rut_sociedad: null,
  nombre_representante_legal: null,
  rut_representante_legal: null,
  estado: 'No',
};
function database(rows: unknown[] = [stationRow]) {
  const query = vi.fn().mockResolvedValue({ rows });
  return { query, executor: { query } as unknown as SqlExecutor };
}

describe('repositorios PostgreSQL de catálogos', () => {
  it('parametriza el identificador sin convertir BIGINT a number', async () => {
    const db = database();
    const id = "60001' OR 1=1 --";
    const item = await new PostgresStationRepository(db.executor).findStationById(id);
    expect(db.query.mock.calls[0]?.[0]).toContain('WHERE id_estacion = $1');
    expect(db.query.mock.calls[0]?.[0]).not.toContain(id);
    expect(db.query.mock.calls[0]?.[1]).toEqual([id]);
    expect(item).toMatchObject({
      id: '60001',
      estado: 'No',
      zoneManager: null,
      commercialManager: null,
      companyRut: null,
      legalRepresentative: null,
    });
  });

  it('consulta una página de estaciones y calcula el total', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ total: '248' }] })
      .mockResolvedValueOnce({ rows: [stationRow] });
    const result = await new PostgresStationRepository({ query } as unknown as SqlExecutor)
      .listStationsPage!(2, 5);

    expect(result).toMatchObject({ page: 2, pageSize: 5, total: 248, totalPages: 50 });
    expect(result.stations).toHaveLength(1);
    expect(query.mock.calls[1]?.[0]).toContain('LIMIT $1 OFFSET $2');
    expect(query.mock.calls[1]?.[1]).toEqual([5, 5]);
  });

  it('escribe sólo columnas existentes', async () => {
    const db = database();
    const repository = new PostgresStationRepository(db.executor);
    const current = (await repository.findStationById('60001'))!;
    const updated = await new StationService(repository).update(current);
    expect(updated.estado).toBe('No');
    const call = db.query.mock.calls.at(-1)!;
    expect(call[0]).toContain('ON CONFLICT (id_estacion) DO UPDATE');
    expect(call[1]).toEqual([
      '60001',
      'Dirección',
      'Comuna',
      'Sociedad',
      null,
      null,
      null,
      null,
      null,
      'No',
    ]);
    expect(call[0]).not.toMatch(/SET[\s\S]*\bversion\s*=/);
  });

  it('filtra gestiones específicas por gestión y deja IDs BIGINT como strings', async () => {
    const rows = [
      {
        id: '9007199254740993',
        managementId: '1001',
        managementTypeId: '2',
        managementTypeName: 'Solicitud de permiso',
        level: 2,
        responsibleUserId: '7',
        responsibleName: 'Ana Pérez',
        status: 'Pendiente',
        fileUrl: null,
        uploadedAt: '2026-11-20T12:00:00.000Z',
      },
    ];
    const db = database(rows);
    const result = await new PostgresGestionesEspecificasRepository(db.executor).list('1001');
    expect(result[0]?.id).toBe('9007199254740993');
    expect(db.query.mock.calls[0]?.[1]).toEqual(['1001']);
    expect(db.query.mock.calls[0]?.[0]).toContain('id_gestion_especifica::text');
    expect(db.query.mock.calls[0]?.[0]).toContain('WHERE ge.id_gestion = $1::bigint');
    expect(db.query.mock.calls[0]?.[0]).not.toContain('gestion_especifica_antecedente');
    expect(result[0]?.responsibleName).toBe('Ana Pérez');
  });
});

describe('rutas de catálogos separados', () => {
  it('expone las gestiones específicas de una gestión con un filtro explícito', async () => {
    const list = vi.fn().mockResolvedValue([
      {
        id: '1',
        managementId: '1001',
        managementTypeId: '2',
        managementTypeName: 'Solicitud de permiso',
        level: 2,
        responsibleUserId: '7',
        responsibleName: 'Ana Pérez',
        status: 'Pendiente',
        fileUrl: null,
        uploadedAt: '2026-11-20T12:00:00.000Z',
      },
    ]);
    const app = createGestionesEspecificasModule({ repository: { list }, authorize: () => true });
    const response = await app.request('/items?managementId=1001');
    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith('1001');
    expect(await response.json()).toMatchObject({
      exito: true,
      mensaje: [{ id: '1', managementId: '1001', managementTypeId: '2' }],
    });
    expect((await app.request('/items')).status).toBe(400);
  });

  it('retira type-relations de la fachada legada sin afectar health', async () => {
    const app = createCatalogosModule({
      repository: {
        listStations: async () => [],
        findStationById: async () => null,
        saveStation: async () => {},
        listScopes: async () => [],
        listManagementTypes: async () => [],
        listStages: async () => [],
      },
      authorize: () => true,
    });
    expect((await app.request('/type-relations')).status).toBe(404);
    expect((await app.request('/health')).status).toBe(200);
    expect((await app.request('/items')).status).toBe(200);
  });
});
