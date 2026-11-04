import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('errores HTTP', () => {
  it('usa el contrato estándar para rutas inexistentes', async () => {
    const response = await exports.default.fetch('http://localhost/no-existe', {
      headers: { 'x-request-id': 'test-not-found' },
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: 'El recurso solicitado no existe.',
      },
      meta: { requestId: 'test-not-found' },
    });
  });
});
