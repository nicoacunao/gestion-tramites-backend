import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('contrato OpenAPI', () => {
  it('publica las rutas declaradas por los módulos', async () => {
    const response = await exports.default.fetch('http://localhost/openapi.json');
    const document = (await response.json()) as { paths: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(Object.keys(document.paths).sort()).toEqual(
      [
        '/api/v1/ambitos/items',
        '/api/v1/antecedentes/items',
        '/api/v1/archivos/health',
        '/api/v1/bitacora/health',
        '/api/v1/bitacora/items',
        '/api/v1/bitacora/items/{id}',
        '/api/v1/campos-adicionales/items',
        '/api/v1/catalogos/backgrounds',
        '/api/v1/catalogos/health',
        '/api/v1/catalogos/items',
        '/api/v1/catalogos/items/{id}',
        '/api/v1/catalogos/management-types',
        '/api/v1/catalogos/scopes',
        '/api/v1/catalogos/stages',
        '/api/v1/consultas/health',
        '/api/v1/consultas/stations/summary',
        '/api/v1/estaciones/items',
        '/api/v1/estaciones/items/{id}',
        '/api/v1/etapas/items',
        '/api/v1/gestiones-especificas/items',
        '/api/v1/gestiones/backgrounds/{id}',
        '/api/v1/gestiones/health',
        '/api/v1/gestiones/items',
        '/api/v1/gestiones/items/{id}',
        '/api/v1/gestiones/items/{id}/backgrounds',
        '/api/v1/gestiones/items/{id}/stages',
        '/api/v1/gestiones/stages/{id}',
        '/api/v1/identidad/health',
        '/api/v1/identidad/login',
        '/api/v1/identidad/profile',
        '/api/v1/identidad/users',
        '/api/v1/tipos-gestion/items',
      ].sort(),
    );
  });
});
