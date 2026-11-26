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
        '/api/v1/archivos/health',
        '/api/v1/archivos/items',
        '/api/v1/archivos/items/{id}',
        '/api/v1/archivos/items/{id}/download',
        '/api/v1/bitacora/health',
        '/api/v1/bitacora/items',
        '/api/v1/bitacora/items/{id}',
        '/api/v1/catalogos/health',
        '/api/v1/catalogos/items',
        '/api/v1/catalogos/items/{id}',
        '/api/v1/catalogos/management-types',
        '/api/v1/catalogos/scopes',
        '/api/v1/catalogos/stages',
        '/api/v1/consultas/health',
        '/api/v1/consultas/stations',
        '/api/v1/consultas/stations/import',
        '/api/v1/consultas/stations/summary',
        '/api/v1/estaciones/items',
        '/api/v1/estaciones/items/{id}',
        '/api/v1/etapas/items',
        '/api/v1/gestiones-especificas/items',
        '/api/v1/gestiones/health',
        '/api/v1/gestiones/items',
        '/api/v1/gestiones/items/{id}',
        '/api/v1/gestiones/items/{id}/stages',
        '/api/v1/identidad/health',
        '/api/v1/identidad/login',
        '/api/v1/identidad/profile',
        '/api/v1/identidad/users',
        '/api/v1/tipos-gestion/items',
      ].sort(),
    );
  }, 15_000);

  it('documenta las respuestas de error del módulo de archivos con el contrato común', async () => {
    const response = await exports.default.fetch('http://localhost/openapi.json');
    const document = (await response.json()) as {
      paths: Record<
        string,
        { get?: { responses?: Record<string, { content?: Record<string, { schema?: unknown }> }> } }
      >;
    };
    const operation = document.paths['/api/v1/archivos/items/{id}']?.get;
    const notFound = operation?.responses?.['404'];
    const internalError = operation?.responses?.['500'];
    const badRequest = operation?.responses?.['400'];
    const unavailable = operation?.responses?.['503'];

    expect(notFound?.content?.['application/json']?.schema).toBeDefined();
    expect(internalError?.content?.['application/json']?.schema).toBeDefined();
    expect(badRequest?.content?.['application/json']?.schema).toBeDefined();
    expect(unavailable?.content?.['application/json']?.schema).toBeDefined();
    expect(operation?.responses?.['401']).toBeDefined();
  });

  it('documenta autenticación y autorización en las operaciones de gestiones', async () => {
    const response = await exports.default.fetch('http://localhost/openapi.json');
    const document = (await response.json()) as {
      paths: Record<string, { get?: { responses?: Record<string, unknown> } }>;
    };
    const operation = document.paths['/api/v1/gestiones/items']?.get;

    expect(operation?.responses?.['401']).toBeDefined();
    expect(operation?.responses?.['403']).toBeDefined();
  });

  it('documenta validaciones semánticas de la bitácora como HTTP 422', async () => {
    const response = await exports.default.fetch('http://localhost/openapi.json');
    const document = (await response.json()) as {
      paths: Record<string, { post?: { responses?: Record<string, unknown> } }>;
    };
    const operation = document.paths['/api/v1/bitacora/items']?.post;

    expect(operation?.responses?.['422']).toBeDefined();
    expect(operation?.responses?.['503']).toBeDefined();
  });

  it('documenta recursos ausentes en etapas, archivos y perfil', async () => {
    const response = await exports.default.fetch('http://localhost/openapi.json');
    const document = (await response.json()) as {
      paths: Record<
        string,
        {
          get?: { responses?: Record<string, unknown> };
          post?: { responses?: Record<string, unknown> };
          put?: { responses?: Record<string, unknown> };
        }
      >;
    };

    expect(
      document.paths['/api/v1/gestiones/items/{id}/stages']?.get?.responses?.['404'],
    ).toBeDefined();
    expect(document.paths['/api/v1/archivos/items']?.post?.responses?.['404']).toBeDefined();
    expect(document.paths['/api/v1/identidad/profile']?.put?.responses?.['404']).toBeDefined();
  });

  it('documenta conflictos por datos únicos al actualizar el perfil', async () => {
    const response = await exports.default.fetch('http://localhost/openapi.json');
    const document = (await response.json()) as {
      paths: Record<string, { put?: { responses?: Record<string, unknown> } }>;
    };

    expect(document.paths['/api/v1/identidad/profile']?.put?.responses?.['409']).toBeDefined();
  });
});
