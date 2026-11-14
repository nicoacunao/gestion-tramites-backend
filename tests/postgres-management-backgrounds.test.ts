import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { PostgresManagementRepository } from '../src/modules/gestiones/infrastructure/postgres-management-repository';
import type {
  CompleteManagementInput,
  ManagementBackgroundCreateInput,
} from '../src/modules/gestiones/domain/management';
import type { SqlExecutor } from '../src/infrastructure/persistence/postgres/connection';

type CatalogFixture = {
  level: 'N2' | 'N3' | 'N4';
  parentBackgroundId: string | null;
  parentLevel?: 'N2' | 'N3' | 'N4' | null;
  backgroundId?: string;
  name?: string;
  category?: 'requerido' | 'complementario';
};

function createRepository(catalog?: CatalogFixture, parentCatalog?: CatalogFixture) {
  const client = {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.startsWith('SELECT')) {
        if (sql.includes('FROM antecedente_gestion')) return { rows: [] };
        if (
          parentCatalog &&
          values?.[1] === parentCatalog.backgroundId &&
          sql.includes('NULLIF($2::text,')
        )
          return { rows: [parentCatalog] };
        if (parentCatalog && sql.includes('gea.id_antecedente::text = $2'))
          return { rows: [parentCatalog] };
        if (sql.includes('FROM gestion g') && sql.includes('gestion_especifica_antecedente'))
          return { rows: catalog ? [catalog] : [] };
        return { rows: catalog ? [catalog] : [] };
      }
      return {
        rows: [
          {
            id: '2',
            managementId: 'N1-PAT-001',
            parentManagementBackgroundId: values?.[2] ?? null,
            managementTypeId: 'patente-comercial',
            specificManagementId: values?.[1] ?? null,
            backgroundId: String(values?.[3] ?? ''),
            level: values?.[5],
            required: values?.[7],
            responsibleUserId: '',
            status: 'Pendiente',
            fileReference: null,
            uploadedAt: null,
            version: '1',
          },
        ],
      };
    }),
    release: vi.fn(),
  };
  const database = {
    query: vi.fn(),
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as SqlExecutor;
  return { repository: new PostgresManagementRepository(database), client };
}

describe('PostgresManagementRepository antecedentes', () => {
  it('devuelve antecedentes N2 y N3 con su relación específica', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: '20',
          managementId: 'PRUEBA-N1-FRONT-001',
          parentManagementBackgroundId: null,
          managementTypeId: 'patente-comercial',
          specificManagementId: '4',
          backgroundId: '4',
          level: 'N2',
          required: true,
          responsibleUserId: null,
          status: 'Pendiente',
          fileReference: null,
          uploadedAt: null,
          version: '1',
        },
        {
          id: '21',
          managementId: 'PRUEBA-N1-FRONT-001',
          parentManagementBackgroundId: '20',
          managementTypeId: 'patente-comercial',
          specificManagementId: '4',
          backgroundId: '30',
          level: 'N3',
          required: true,
          responsibleUserId: null,
          status: 'Pendiente',
          fileReference: null,
          uploadedAt: null,
          version: '1',
        },
      ],
    });
    const repository = new PostgresManagementRepository({ query } as unknown as SqlExecutor);

    const backgrounds = await repository.listBackgrounds('PRUEBA-N1-FRONT-001');

    expect(backgrounds.map((background) => background.level)).toEqual(['N2', 'N3']);
    expect(backgrounds[1]).toMatchObject({
      specificManagementId: '4',
      parentManagementBackgroundId: '20',
    });
    expect(query.mock.calls[0]?.[0]).not.toContain("a.nivel IN ('N3', 'N4')");
  });

  it('persiste subtrámites N2 y genera sus antecedentes N3', async () => {
    const client = {
      query: vi.fn(async (sql: string, _values?: unknown[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
        if (sql.startsWith('SELECT (COALESCE')) return { rows: [{ next_sequence: '1' }] };
        if (sql.startsWith('INSERT INTO gestion '))
          return {
            rows: [
              {
                id: 'PRUEBA-N1-FRONT-001',
                responsibleUserId: '2',
                specificManagementId: null,
                version: '1',
              },
            ],
          };
        if (sql.startsWith('SELECT id_gestion_especifica::text AS id'))
          return { rows: [{ id: '4' }] };
        if (sql.startsWith('SELECT gea.id_antecedente::text AS "backgroundId"'))
          return {
            rows: [
              {
                backgroundId: '30',
                level: 'N3',
                name: 'Informe de Bomberos',
                category: 'requerido',
                required: true,
                specificManagementId: '4',
              },
            ],
          };
        if (sql.startsWith('SELECT gea.id_gestion_especifica::text AS "specificManagementId"'))
          return {
            rows: [
              {
                specificManagementId: '4',
                level: 'N3',
                parentBackgroundId: null,
                parentLevel: null,
              },
            ],
          };
        if (sql.startsWith('INSERT INTO antecedente_gestion'))
          return {
            rows: [
              {
                id: '25',
                managementId: 'PRUEBA-N1-FRONT-001',
                specificManagementId: '4',
                parentManagementBackgroundId: null,
                managementTypeId: 'patente-comercial',
                backgroundId: '30',
                level: 'N3',
                required: true,
                responsibleUserId: null,
                status: 'Pendiente',
                fileReference: null,
                uploadedAt: null,
                version: '1',
              },
            ],
          };
        if (sql.startsWith('SELECT nombre AS name FROM etapa'))
          return { rows: [{ name: 'Inicio' }] };
        if (sql.startsWith('INSERT INTO etapa_gestion'))
          return {
            rows: [
              {
                id: '40',
                managementId: 'PRUEBA-N1-FRONT-001',
                stageId: '1',
                stageName: 'Inicio',
                percentage: 0,
                status: 'Pendiente',
                estimatedOn: null,
                completedOn: null,
                responsible: null,
                notes: null,
                version: '1',
              },
            ],
          };
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const database = {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as SqlExecutor;
    const repository = new PostgresManagementRepository(database);
    const input = {
      id: 'PRUEBA-N1-FRONT-001',
      stationId: '00000',
      managementTypeId: 'patente-comercial',
      scopeCode: 'DOM',
      responsibleUserId: '2',
      level: 'N1',
      sequence: 1200,
      openedOn: '2026-11-13',
      estimatedCompletionOn: null,
      lastReviewedOn: null,
      priority: 'Media',
      requesterName: 'Prueba N1 N2 N3',
      status: 'Borrador',
      creationMode: 'principal',
      associatedSpecificManagementIds: ['4'],
    } as CompleteManagementInput;

    await repository.createComplete(input);

    const relationCall = client.query.mock.calls.find(([sql]) =>
      String(sql).startsWith('INSERT INTO gestion_subtramite'),
    );
    expect(relationCall?.[1]).toEqual(['PRUEBA-N1-FRONT-001', '4']);
    const backgroundCall = client.query.mock.calls.find(([sql]) =>
      String(sql).startsWith('INSERT INTO antecedente_gestion'),
    );
    expect(backgroundCall?.[1]).toEqual(expect.arrayContaining(['4', 'N3', 'requerido', true]));
    expect(
      client.query.mock.calls.filter(([sql]) =>
        String(sql).startsWith('INSERT INTO etapa_gestion'),
      ),
    ).toHaveLength(1);
  });

  it('persiste la relación N2 con la gestión específica sin crear un antecedente N2', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ next_sequence: '1200' }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'BACKEND-N2-N3-001', responsibleUserId: '2', version: '1' }],
      });
    const database = { query } as unknown as SqlExecutor;
    const repository = new PostgresManagementRepository(database);
    const client = { query } as unknown as PoolClient;
    const input = {
      id: 'BACKEND-N2-N3-001',
      stationId: '00000',
      managementTypeId: 'patente-comercial',
      scopeCode: 'DOM',
      responsibleUserId: '2',
      level: 'N2',
      sequence: 1200,
      openedOn: '2026-11-13',
      estimatedCompletionOn: null,
      lastReviewedOn: null,
      priority: 'Media',
      requesterName: 'Prueba N2 N3',
      status: 'Borrador',
      creationMode: 'subtramite',
      specificManagementId: '4',
    } as CompleteManagementInput;

    await (
      repository as unknown as {
        insertManagement: (client: PoolClient, input: CompleteManagementInput) => Promise<unknown>;
      }
    ).insertManagement(client, input);

    const [sql, values] = query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('id_gestion_especifica');
    expect(sql).toContain('modalidad_creacion');
    expect(values).toContain('4');
    expect(values).toContain('N2');
    expect(values).toContain('subtramite');
    expect(sql).not.toContain('INSERT INTO antecedente_gestion');
  });

  it('hace rollback si falla la generación automática de antecedentes', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
        if (sql.startsWith('SELECT (COALESCE')) return { rows: [{ next_sequence: '1' }] };
        if (sql.startsWith('INSERT INTO gestion '))
          return {
            rows: [
              {
                id: 'BACKEND-N2-N3-001',
                responsibleUserId: '2',
                specificManagementId: '4',
                version: '1',
              },
            ],
          };
        if (
          sql.includes('SELECT gea.id_antecedente::text AS "backgroundId"') ||
          sql.includes('SELECT gea.id_gestion_especifica::text AS "specificManagementId"')
        )
          return {
            rows: [
              {
                backgroundId: '30',
                level: 'N3',
                parentBackgroundId: null,
                parentLevel: null,
                name: 'Documento requerido',
                category: 'requerido',
                required: true,
              },
            ],
          };
        if (sql.includes('SELECT gea.nivel AS level'))
          return { rows: [{ level: 'N3', parentBackgroundId: null, parentLevel: null }] };
        if (sql.startsWith('INSERT INTO antecedente_gestion')) return { rows: [] };
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const database = {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as SqlExecutor;
    const repository = new PostgresManagementRepository(database);
    const input = {
      id: 'BACKEND-N2-N3-001',
      stationId: '00000',
      managementTypeId: 'patente-comercial',
      scopeCode: 'DOM',
      responsibleUserId: '2',
      level: 'N2',
      sequence: 1200,
      openedOn: '2026-11-13',
      estimatedCompletionOn: null,
      lastReviewedOn: null,
      priority: 'Media',
      requesterName: 'Prueba N2 N3',
      status: 'Borrador',
      creationMode: 'subtramite',
      specificManagementId: '4',
    } as CompleteManagementInput;

    await expect(repository.createComplete(input)).rejects.toThrow(
      'El antecedente no pudo ser creado.',
    );
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
  });

  it('usa un parámetro separado para uploadedAt y la versión al actualizar', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: '74',
          managementId: 'N1-PAT-001',
          parentManagementBackgroundId: null,
          managementTypeId: 'patente-comercial',
          backgroundId: '100',
          level: 'N2',
          required: true,
          responsibleUserId: null,
          status: 'Recibido',
          fileReference: null,
          uploadedAt: '2026-11-13',
          version: '2',
        },
      ],
    });
    const database = { query } as unknown as SqlExecutor;
    const repository = new PostgresManagementRepository(database);
    await repository.updateBackground(
      '74',
      {
        managementId: 'N1-PAT-001',
        parentManagementBackgroundId: null,
        managementTypeId: 'patente-comercial',
        backgroundId: '100',
        level: 'N2',
        required: true,
        responsibleUserId: null,
        status: 'Recibido',
        fileReference: null,
        uploadedAt: '2026-11-13',
      },
      1,
    );
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('fecha_carga =');
    expect(sql).toContain('a.xmin = $4::text::xid');
    expect(values).toEqual(['74', null, 'Recibido', 1]);
  });

  it.each(['N2', 'N3', 'N4'] as const)('persiste el nivel %s recibido', async (level) => {
    const parentBackgroundId = level === 'N2' ? null : '10';
    const { repository, client } = createRepository({
      level,
      parentBackgroundId,
      parentLevel: level === 'N3' ? 'N2' : level === 'N4' ? 'N3' : null,
      backgroundId: '100',
      name: `Antecedente ${level}`,
    });
    const input: ManagementBackgroundCreateInput = {
      backgroundId: '100',
      level,
      name: `Antecedente ${level}`,
      category: 'requerido',
      required: true,
    };

    const result = await (
      repository as unknown as {
        insertBackground: (
          client: PoolClient,
          managementId: string,
          input: ManagementBackgroundCreateInput,
          parentIds: Map<string, string>,
        ) => Promise<{ level: string }>;
      }
    ).insertBackground(
      client as unknown as PoolClient,
      'N1-PAT-001',
      input,
      new Map(parentBackgroundId ? [[parentBackgroundId, '1']] : []),
    );

    expect(result.level).toBe(level);
    const insertCall = client.query.mock.calls.find(([sql]: [unknown, ...unknown[]]) =>
      String(sql).includes('INSERT'),
    );
    expect(insertCall?.[0]).toContain('$6::varchar');
    expect(insertCall?.[0]).not.toContain("'N2'");
    expect(insertCall?.[1]).toEqual([
      'N1-PAT-001',
      '',
      parentBackgroundId ? '1' : null,
      '100',
      `Antecedente ${level}`,
      level,
      'requerido',
      true,
      '',
      'Pendiente',
      null,
    ]);
  });

  it('conserva el padre de un antecedente hijo', async () => {
    const { repository, client } = createRepository({
      level: 'N3',
      parentBackgroundId: '100',
      parentLevel: 'N2',
      backgroundId: '101',
      name: 'Hijo N3',
    });
    const input: ManagementBackgroundCreateInput = {
      backgroundId: '101',
      parentBackgroundId: '100',
      level: 'N3',
      name: 'Hijo N3',
      category: 'requerido',
      required: true,
    };

    const result = await (
      repository as unknown as {
        insertBackground: (
          client: PoolClient,
          managementId: string,
          input: ManagementBackgroundCreateInput,
          parentIds: Map<string, string>,
        ) => Promise<{ parentManagementBackgroundId: string }>;
      }
    ).insertBackground(
      client as unknown as PoolClient,
      'N1-PAT-001',
      input,
      new Map([['100', '1']]),
    );

    expect(result.parentManagementBackgroundId).toBe('1');
    const insertCall = client.query.mock.calls.find(([sql]: [unknown, ...unknown[]]) =>
      String(sql).includes('INSERT'),
    );
    expect(insertCall?.[1]).toEqual(expect.arrayContaining(['1', 'N3']));
  });

  it('usa el nivel del catálogo aunque el payload informe otro nivel', async () => {
    const { repository, client } = createRepository({
      level: 'N3',
      parentBackgroundId: '10',
      parentLevel: 'N2',
    });
    const input: ManagementBackgroundCreateInput = {
      backgroundId: '100',
      level: 'N2',
      name: 'Formulario de ingreso',
      category: 'requerido',
      required: true,
    };

    const result = await (
      repository as unknown as {
        insertBackground: (
          client: PoolClient,
          managementId: string,
          input: ManagementBackgroundCreateInput,
          parentIds: Map<string, string>,
        ) => Promise<{ level: string }>;
      }
    ).insertBackground(
      client as unknown as PoolClient,
      'N1-PAT-001',
      input,
      new Map([['10', '1']]),
    );

    expect(result.level).toBe('N3');
    const insertCall = client.query.mock.calls.find(([sql]: [unknown, ...unknown[]]) =>
      String(sql).includes('INSERT'),
    );
    expect(insertCall?.[1]).toEqual(expect.arrayContaining(['N3']));
  });

  it('crea automáticamente el padre catalogado que no venía en el payload', async () => {
    const { repository, client } = createRepository(
      {
        level: 'N3',
        parentBackgroundId: '117',
        parentLevel: 'N2',
        backgroundId: '118',
        name: 'Hijo N3',
      },
      { level: 'N2', parentBackgroundId: null, backgroundId: '117', name: 'Padre N2' },
    );
    const input: ManagementBackgroundCreateInput = {
      backgroundId: '118',
      level: 'N3',
      name: 'Hijo N3',
      category: 'requerido',
      required: true,
    };

    const result = await (
      repository as unknown as {
        insertBackground: (
          client: PoolClient,
          managementId: string,
          input: ManagementBackgroundCreateInput,
          parentIds: Map<string, string>,
        ) => Promise<{ parentManagementBackgroundId: string }>;
      }
    ).insertBackground(client as unknown as PoolClient, 'N1-PAT-001', input, new Map());

    expect(result.parentManagementBackgroundId).toBe('2');
    expect(client.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT'))).toHaveLength(
      2,
    );
  });
});
