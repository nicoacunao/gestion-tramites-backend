import { describe, expect, it, vi } from 'vitest';
import { PostgresFileRepository } from '../src/modules/archivos/infrastructure/postgres-file-repository';

describe('PostgresFileRepository', () => {
  it('informa cuando no existe la gestión específica al guardar metadatos', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new PostgresFileRepository({ query } as never);

    await expect(
      repository.saveMetadata({
        id: '15',
        managementSpecificId: '15',
        storageReference: 'drive/item',
        uploadedAt: '2026-11-26T12:00:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', status: 404 });
  });
});
