import { OpenAPIHono } from '@hono/zod-openapi';

import { archivosModule } from './modules/archivos';
import { bitacoraModule } from './modules/bitacora';
import { createCatalogosModule, excelCatalogosDependencies } from './modules/catalogos';
import { consultasModule } from './modules/consultas';
import { gestionesModule } from './modules/gestiones';
import { createIdentidadModule, excelIdentityDependencies } from './modules/identidad';
import { AppError } from './shared/errors/app-error';
import type { AppEnv } from './shared/config/bindings';
import { corsMiddleware } from './shared/middleware/cors';
import { requestContextMiddleware } from './shared/middleware/request-context';
import { structuredLoggerMiddleware } from './shared/middleware/structured-logger';

export function createApp(): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();

  app.use('*', requestContextMiddleware);
  app.use('*', corsMiddleware);
  app.use('*', structuredLoggerMiddleware);

  app.route('/api/v1/identidad', createIdentidadModule(excelIdentityDependencies));
  app.route('/api/v1/catalogos', createCatalogosModule(excelCatalogosDependencies));
  app.route('/api/v1/gestiones', gestionesModule);
  app.route('/api/v1/archivos', archivosModule);
  app.route('/api/v1/bitacora', bitacoraModule);
  app.route('/api/v1/consultas', consultasModule);

  app.doc('/openapi.json', {
    openapi: '3.0.3',
    info: {
      title: 'API Gestión de Trámites',
      version: '0.1.0',
      description: 'Contrato inicial. Solo contiene health checks por módulo.',
    },
    servers: [
      { url: 'http://localhost:8787', description: 'Desarrollo local' },
      { url: 'https://replace-with-staging-domain.invalid', description: 'Staging' },
      { url: 'https://replace-with-production-domain.invalid', description: 'Producción' },
    ],
  });

  app.notFound((context) =>
    context.json(
      {
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'El recurso solicitado no existe.',
        },
        meta: { requestId: context.get('requestId') },
      },
      404,
    ),
  );

  app.onError((error, context) => {
    const appError =
      error instanceof AppError
        ? error
        : new AppError('INTERNAL_ERROR', 'Ocurrió un error inesperado.', 500);

    console.error(
      JSON.stringify({
        level: 'error',
        event: 'http_request_failed',
        requestId: context.get('requestId'),
        code: appError.code,
        message: error.message,
      }),
    );

    return context.json(
      {
        error: {
          code: appError.code,
          message: appError.message,
          ...(appError.details === undefined ? {} : { details: appError.details }),
        },
        meta: { requestId: context.get('requestId') },
      },
      appError.status,
    );
  });

  return app;
}

export const app = createApp();
