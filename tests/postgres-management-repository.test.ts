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
    expect(query.mock.calls[0]?.[0]).toContain('row_number() OVER');
    expect(query.mock.calls[0]?.[0]).toContain('ORDER BY g.fecha_apertura, g.id_gestion');
    expect(query.mock.calls[0]?.[0]).toContain("'Próximo a vencer'");
  });

  it('crea una gestión específica asignando al responsable de la gestión por defecto', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ level: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '51',
            managementId: '10',
            managementTypeId: '4',
            managementTypeName: 'Patente comercial',
            level: 1,
            required: true,
            responsibleUserId: '1',
            responsibleName: 'Ana Pérez',
            status: 'Pendiente',
            fileUrl: null,
            uploadedAt: '2026-11-26T12:00:00Z',
          },
        ],
      });
    const repository = new PostgresManagementRepository({ query } as never);
    const result = await repository.createSpecific('10', { managementTypeId: '4' });

    expect(result.id).toBe('51');
    expect(query.mock.calls[1]?.[0]).toContain('INSERT INTO gestion_especifica');
    expect(query.mock.calls[1]?.[0]).toContain(
      "COALESCE(NULLIF($3, '')::bigint, g.id_usuario_responsable)",
    );
    expect(query.mock.calls[1]?.[1]).toEqual(['10', '4', null, 'Pendiente', null]);
  });

  it('permite crear una instancia N2 pendiente sin archivo', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ level: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: '52', status: 'Pendiente', fileUrl: null }] });
    const repository = new PostgresManagementRepository({ query } as never);
    await repository.createSpecific('10', { managementTypeId: '4' });

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]?.[0]).toContain('INSERT INTO gestion_especifica');
    expect(query.mock.calls[1]?.[1]).toEqual(['10', '4', null, 'Pendiente', null]);
  });

  it('exige archivo al marcar como recibido una gestión específica N2+', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ level: 2 }] });
    const repository = new PostgresManagementRepository({ query } as never);

    await expect(
      repository.createSpecific('10', { managementTypeId: '4', status: 'Recibido' }),
    ).rejects.toMatchObject({
      code: 'SPECIFIC_MANAGEMENT_FILE_REQUIRED',
      status: 422,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('actualiza la instancia específica y registra cuándo cambia el archivo', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: '51', status: 'Recibido' }] });
    const repository = new PostgresManagementRepository({ query } as never);
    await repository.updateSpecific('51', {
      responsibleUserId: null,
      status: 'Recibido',
      fileReference: 'documento.pdf',
    });

    expect(query.mock.calls[0]?.[0]).toContain('UPDATE gestion_especifica SET');
    expect(query.mock.calls[0]?.[0]).toContain('url_archivo IS DISTINCT FROM $4');
    expect(query.mock.calls[0]?.[1]).toEqual(['51', null, 'Recibido', 'documento.pdf']);
  });

  it('actualiza una etapa sin usar una columna de versión que no existe en el esquema', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: '12', status: 'Completado' }] });
    const repository = new PostgresManagementRepository({ query } as never);
    await repository.updateStage('12', {
      status: 'Completado',
      estimatedOn: '2026-11-20',
      completedOn: '2026-11-25',
      responsibleUserId: null,
      notes: null,
    });

    expect(query.mock.calls[0]?.[0]).toContain('UPDATE etapa_gestion SET');
    expect(query.mock.calls[0]?.[0]).not.toContain('version');
    expect(query.mock.calls[0]?.[1]).toEqual([
      '12',
      'Completado',
      '2026-11-20',
      '2026-11-25',
      null,
      null,
    ]);
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
