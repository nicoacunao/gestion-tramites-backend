import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { PostgresManagementRepository } from '../src/modules/gestiones/infrastructure/postgres-management-repository';
import type { ManagementBackgroundCreateInput } from '../src/modules/gestiones/domain/management';
import type { SqlExecutor } from '../src/infrastructure/persistence/postgres/connection';

function createRepository(catalog?: {
  level: 'N2' | 'N3' | 'N4';
  parentBackgroundId: string | null;
}) {
  const client = {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.startsWith('SELECT')) return { rows: catalog ? [catalog] : [] };
      return {
        rows: [
          {
            id: '2',
            managementId: 'N1-PAT-001',
            parentManagementBackgroundId: values?.[1] ?? null,
            managementTypeId: 'patente-comercial',
            backgroundId: String(values?.[2] ?? ''),
            level: values?.[4],
            required: values?.[6],
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
  it.each(['N2', 'N3', 'N4'] as const)('persiste el nivel %s recibido', async (level) => {
    const { repository, client } = createRepository();
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
    ).insertBackground(client as unknown as PoolClient, 'N1-PAT-001', input, new Map());

    expect(result.level).toBe(level);
    const insertCall = client.query.mock.calls.find(([sql]: [unknown, ...unknown[]]) =>
      String(sql).includes('INSERT'),
    );
    expect(insertCall?.[0]).toContain('$5::varchar');
    expect(insertCall?.[0]).not.toContain("'N2'");
    expect(insertCall?.[1]).toEqual([
      'N1-PAT-001',
      null,
      '100',
      `Antecedente ${level}`,
      level,
      'requerido',
      true,
      null,
      '',
      '',
      'Pendiente',
      null,
      null,
      null,
    ]);
  });

  it('conserva el padre de un antecedente hijo', async () => {
    const { repository, client } = createRepository();
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
    const { repository, client } = createRepository({ level: 'N3', parentBackgroundId: null });
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
    ).insertBackground(client as unknown as PoolClient, 'N1-PAT-001', input, new Map());

    expect(result.level).toBe('N3');
    const insertCall = client.query.mock.calls.find(([sql]: [unknown, ...unknown[]]) =>
      String(sql).includes('INSERT'),
    );
    expect(insertCall?.[1]).toEqual(expect.arrayContaining(['N3']));
  });
});
