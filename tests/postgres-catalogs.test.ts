import { describe, expect, it, vi } from 'vitest';
import type { SqlExecutor } from '../src/infrastructure/persistence/postgres/connection';
import { PostgresStationRepository } from '../src/modules/estaciones';
import { PostgresGestionesEspecificasRepository } from '../src/modules/gestiones-especificas';
import { PostgresCamposAdicionalesRepository } from '../src/modules/campos-adicionales';
import { StationService } from '../src/modules/estaciones/application/service';
import { createGestionesEspecificasModule } from '../src/modules/gestiones-especificas';
import { createCamposAdicionalesModule } from '../src/modules/campos-adicionales';
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
  version: '456',
};
function database(rows: unknown[] = [stationRow]) {
  const query = vi.fn().mockResolvedValue({ rows });
  return { query, executor: { query } as unknown as SqlExecutor };
}

describe('repositorios PostgreSQL de catálogos', () => {
  it('parametriza el identificador y conserva xmin sin convertir BIGINT a number', async () => {
    const db = database();
    const id = "60001' OR 1=1 --";
    const item = await new PostgresStationRepository(db.executor).findStationById(id);
    expect(db.query.mock.calls[0]?.[0]).toContain('WHERE id_estacion = $1');
    expect(db.query.mock.calls[0]?.[0]).not.toContain(id);
    expect(db.query.mock.calls[0]?.[1]).toEqual([id]);
    expect(item).toMatchObject({
      id: '60001',
      name: null,
      status: 'active',
      version: 456,
      zoneManager: '',
      commercialManager: '',
      companyRut: '',
      legalRepresentative: '',
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

  it('escribe sólo columnas existentes y devuelve la versión real de PostgreSQL', async () => {
    const db = database();
    const repository = new PostgresStationRepository(db.executor);
    const current = (await repository.findStationById('60001'))!;
    const updated = await new StationService(repository).update(current);
    expect(updated.version).toBe(456);
    const call = db.query.mock.calls.at(-1)!;
    expect(call[0]).toContain('AND xmin::text = $10');
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
      '456',
    ]);
    expect(call[0]).not.toMatch(/SET[\s\S]*\bversion\s*=/);
  });

  it('detecta una actualización concurrente en el UPDATE, incluso después de la lectura', async () => {
    const db = database();
    const repository = new PostgresStationRepository(db.executor);
    const current = (await repository.findStationById('60001'))!;
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(repository.saveStation(current, 456)).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
      status: 409,
    });
  });

  it.each([{ name: 'No persistible' }, { status: 'inactive' }])(
    'rechaza campos sin almacenamiento: %o',
    async (change) => {
      const db = database();
      const repository = new PostgresStationRepository(db.executor);
      const current = (await repository.findStationById('60001'))!;
      db.query.mockClear();
      await expect(repository.saveStation({ ...current, ...change })).rejects.toMatchObject({
        code: 'UNSUPPORTED_STATION_FIELDS',
        status: 422,
      });
      expect(db.query).not.toHaveBeenCalled();
    },
  );

  it('parametriza filtros en los nuevos catálogos y deja IDs BIGINT como strings', async () => {
    const rows = [
      {
        id: '9007199254740993',
        managementTypeId: 'patentes',
        code: 'PROV',
        name: 'Provisoria',
        active: true,
        backgrounds: [
          { id: '1', name: 'Formulario de ingreso' },
          { id: '2', name: 'Certificado' },
        ],
      },
    ];
    const db = database(rows);
    const result = await new PostgresGestionesEspecificasRepository(db.executor).list(
      "' OR true --",
    );
    expect(result[0]?.id).toBe('9007199254740993');
    expect(db.query.mock.calls[0]?.[1]).toEqual(["' OR true --"]);
    expect(db.query.mock.calls[0]?.[0]).toContain('id_gestion_especifica::text');
    expect(db.query.mock.calls[0]?.[0]).toContain('gestion_especifica_antecedente');
    expect(db.query.mock.calls[0]?.[0]).toContain('ORDER BY gea.orden');
    expect(result[0]?.backgrounds).toEqual([
      { id: '1', name: 'Formulario de ingreso' },
      { id: '2', name: 'Certificado' },
    ]);
    const fields = database([]);
    await new PostgresCamposAdicionalesRepository(fields.executor).list();
    expect(fields.query.mock.calls[0]?.[1]).toEqual([null]);
    expect(fields.query.mock.calls[0]?.[0]).toContain('opcion_campo_adicional');
    expect(fields.query.mock.calls[0]?.[0]).toContain('ORDER BY o.orden');
  });
});

describe('rutas de catálogos separados', () => {
  it('expone el reemplazo de type-relations con un filtro y contrato explícitos', async () => {
    const list = vi.fn().mockResolvedValue([
      {
        id: '1',
        managementTypeId: 'patentes',
        code: 'PROV',
        name: 'Provisoria',
        active: true,
        backgrounds: [{ id: '2', name: 'Formulario de ingreso' }],
      },
    ]);
    const app = createGestionesEspecificasModule({ repository: { list }, authorize: () => true });
    const response = await app.request('/items?managementTypeId=patentes');
    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith('patentes');
    expect(await response.json()).toMatchObject({
      data: [{ id: '1', active: true, managementTypeId: 'patentes' }],
    });
    expect((await app.request('/items?managementTypeId=')).status).toBe(400);
  });

  it('expone las opciones de campos como parte del catálogo, respetando el orden', async () => {
    const item = {
      id: '2',
      managementTypeId: 'patentes',
      code: 'municipio',
      label: 'Municipio',
      controlType: 'select' as const,
      required: true,
      options: [{ value: 'Santiago', order: 1 }],
    };
    const app = createCamposAdicionalesModule({
      repository: { list: async () => [item] },
      authorize: () => true,
    });
    expect(await (await app.request('/items')).json()).toMatchObject({ data: [item] });
  });

  it('retira type-relations de la fachada legada sin afectar health', async () => {
    const app = createCatalogosModule({
      repository: {
        listStations: async () => [],
        findStationById: async () => null,
        saveStation: async () => {},
        listScopes: async () => [],
        listManagementTypes: async () => [],
        listBackgrounds: async () => [],
        listStages: async () => [],
      },
      authorize: () => true,
    });
    expect((await app.request('/type-relations')).status).toBe(404);
    expect((await app.request('/health')).status).toBe(200);
    expect((await app.request('/items')).status).toBe(200);
  });
});
