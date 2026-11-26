import { describe, expect, it, vi } from 'vitest';
import { PostgresManagementRepository } from '../src/modules/gestiones/infrastructure/postgres-management-repository';

describe('PostgresManagementRepository', () => {
  it('consulta una gestión por id_gestion', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: '10',
          stationId: '60001',
          responsibleUserId: '1',
          createdAt: '2026-07-02T12:00:00Z',
          openedOn: '2026-07-02',
          estimatedCompletionOn: null,
          lastReviewedOn: null,
          priority: 'Alta',
          status: 'Borrador',
          requesterName: 'Ana',
        },
      ],
    });
    const repository = new PostgresManagementRepository({ query } as never);
    await repository.findById('10');
    expect(query.mock.calls[0]?.[0]).toContain('g.id_gestion = $1::bigint');
    expect(query.mock.calls[0]?.[0]).not.toContain('g.codigo');
  });

  it('inserta la gestión sin código y retorna el id generado', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: '10',
          stationId: '60001',
          responsibleUserId: '1',
          createdAt: '2026-07-02T12:00:00Z',
          openedOn: '2026-07-02',
          estimatedCompletionOn: null,
          lastReviewedOn: null,
          priority: 'Alta',
          status: 'Borrador',
          requesterName: 'Ana',
        },
      ],
    });
    const repository = new PostgresManagementRepository({ query } as never);
    const result = await repository.save({
      stationId: '60001',
      responsibleUserId: '1',
      openedOn: '2026-07-02',
      estimatedCompletionOn: null,
      lastReviewedOn: null,
      priority: 'Alta',
      status: 'Borrador',
      requesterName: 'Ana',
    });
    expect(result.id).toBe('10');
    expect(query.mock.calls[0]?.[0]).toContain('INSERT INTO gestion');
    expect(query.mock.calls[0]?.[0]).not.toContain('codigo');
  });

  it('traduce un UPDATE sin filas afectadas a recurso no encontrado', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new PostgresManagementRepository({ query } as never);

    await expect(
      repository.save({
        id: '10',
        stationId: '60001',
        responsibleUserId: '1',
        openedOn: '2026-07-02',
        estimatedCompletionOn: null,
        lastReviewedOn: null,
        priority: 'Alta',
        status: 'Borrador',
        requesterName: 'Ana',
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', status: 404 });
  });
});
