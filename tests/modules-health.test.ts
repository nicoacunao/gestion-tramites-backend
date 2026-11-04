import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

const modules = ['identidad', 'catalogos', 'gestiones', 'archivos', 'bitacora', 'consultas'];

describe('health checks por módulo', () => {
  it.each(modules)('responde para %s', async (moduleName) => {
    const response = await exports.default.fetch(`http://localhost/api/v1/${moduleName}/health`, {
      headers: { 'x-request-id': `test-${moduleName}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { module: moduleName, status: 'ok' },
      meta: { requestId: `test-${moduleName}` },
    });
  });
});
