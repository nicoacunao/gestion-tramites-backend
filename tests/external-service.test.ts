import { describe, expect, it } from 'vitest';
import { fetchExternal, readExternalJson } from '../src/shared/http/external-service';

describe('errores de servicios externos', () => {
  it('convierte fallos de red a un error seguro de indisponibilidad', async () => {
    const fetcher: typeof fetch = async () => {
      throw new Error('network detail with sensitive information');
    };

    await expect(
      fetchExternal(
        fetcher,
        'https://service.invalid',
        {},
        'REMOTE_UNAVAILABLE',
        'Servicio no disponible.',
      ),
    ).rejects.toMatchObject({
      code: 'REMOTE_UNAVAILABLE',
      message: 'Servicio no disponible.',
      status: 503,
    });
  });

  it('convierte JSON externo mal formado a error de indisponibilidad', async () => {
    await expect(
      readExternalJson(new Response('{invalid'), 'REMOTE_UNAVAILABLE', 'Respuesta inválida.'),
    ).rejects.toMatchObject({
      code: 'REMOTE_UNAVAILABLE',
      message: 'Respuesta inválida.',
      status: 503,
    });
  });
});
