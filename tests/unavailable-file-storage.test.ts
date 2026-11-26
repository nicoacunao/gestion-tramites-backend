import { describe, expect, it } from 'vitest';
import { UnavailableFileStorage } from '../src/modules/archivos/infrastructure/unavailable-file-storage';

describe('UnavailableFileStorage', () => {
  it('rechaza cargas mientras el servidor propio no esté disponible', async () => {
    await expect(
      new UnavailableFileStorage().put('15/documento.pdf', new ReadableStream(), 'application/pdf'),
    ).rejects.toMatchObject({
      code: 'FILE_STORAGE_UNAVAILABLE',
      message: 'El servidor de almacenamiento de archivos aún no está disponible.',
      status: 503,
    });
  });

  it('rechaza descargas mientras el servidor propio no esté disponible', async () => {
    await expect(new UnavailableFileStorage().get('15/documento.pdf')).rejects.toMatchObject({
      code: 'FILE_STORAGE_UNAVAILABLE',
      status: 503,
    });
  });
});
