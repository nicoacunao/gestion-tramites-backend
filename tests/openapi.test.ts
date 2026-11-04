import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('contrato OpenAPI', () => {
  it('publica exclusivamente health checks en esta fase', async () => {
    const response = await exports.default.fetch('http://localhost/openapi.json');
    const document = (await response.json()) as { paths: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(Object.keys(document.paths).sort()).toEqual(
      [
        '/api/v1/archivos/health',
        '/api/v1/bitacora/health',
        '/api/v1/catalogos/health',
        '/api/v1/consultas/health',
        '/api/v1/gestiones/health',
        '/api/v1/identidad/health',
      ].sort(),
    );
  });
});
