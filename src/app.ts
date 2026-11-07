import { OpenAPIHono } from '@hono/zod-openapi';

import { archivosModule, createArchivosRouter } from './modules/archivos';
import { createBitacoraModule, postgresBitacoraDependencies } from './modules/bitacora';
import { createCatalogosModule, postgresCatalogosDependencies } from './modules/catalogos';
import { createConsultasModule, postgresConsultasDependencies } from './modules/consultas';
import { createGestionesModule, postgresGestionesDependencies } from './modules/gestiones';
import { createIdentidadModule, postgresIdentityDependencies } from './modules/identidad';
import { createEstacionesModule, postgresEstacionesDependencies } from './modules/estaciones';
import { createAmbitosModule, postgresAmbitosDependencies } from './modules/ambitos';
import {
  createTiposGestionModule,
  postgresTiposGestionDependencies,
} from './modules/tipos-gestion';
import { createAntecedentesModule, postgresAntecedentesDependencies } from './modules/antecedentes';
import { createEtapasModule, postgresEtapasDependencies } from './modules/etapas';
import {
  createGestionesEspecificasModule,
  postgresGestionesEspecificasDependencies,
} from './modules/gestiones-especificas';
import {
  createCamposAdicionalesModule,
  postgresCamposAdicionalesDependencies,
} from './modules/campos-adicionales';
import { AppError } from './shared/errors/app-error';
import type { AppEnv } from './shared/config/bindings';
import { corsMiddleware } from './shared/middleware/cors';
import { requestContextMiddleware } from './shared/middleware/request-context';
import { structuredLoggerMiddleware } from './shared/middleware/structured-logger';
import { databaseMiddleware } from './shared/middleware/database';
import { translateDatabaseError } from './infrastructure/persistence/postgres/errors';

export function createApp(): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();

  app.use('*', requestContextMiddleware);
  app.use('*', corsMiddleware);
  app.use('*', structuredLoggerMiddleware);
  app.use('*', databaseMiddleware);

  app.route('/api/v1/identidad', createIdentidadModule(postgresIdentityDependencies));
  app.route('/api/v1/catalogos', createCatalogosModule(postgresCatalogosDependencies));
  app.route('/api/v1/gestiones', createGestionesModule(postgresGestionesDependencies));
  app.route('/api/v1/estaciones', createEstacionesModule(postgresEstacionesDependencies));
  app.route('/api/v1/ambitos', createAmbitosModule(postgresAmbitosDependencies));
  app.route('/api/v1/tipos-gestion', createTiposGestionModule(postgresTiposGestionDependencies));
  app.route('/api/v1/antecedentes', createAntecedentesModule(postgresAntecedentesDependencies));
  app.route('/api/v1/etapas', createEtapasModule(postgresEtapasDependencies));
  app.route(
    '/api/v1/gestiones-especificas',
    createGestionesEspecificasModule(postgresGestionesEspecificasDependencies),
  );
  app.route(
    '/api/v1/campos-adicionales',
    createCamposAdicionalesModule(postgresCamposAdicionalesDependencies),
  );
  app.route('/api/v1/archivos', archivosModule);
  app.route('/api/v1/archivos', createArchivosRouter());
  app.route('/api/v1/bitacora', createBitacoraModule(postgresBitacoraDependencies));
  app.route('/api/v1/consultas', createConsultasModule(postgresConsultasDependencies));

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
        : (translateDatabaseError(error) ??
          new AppError('INTERNAL_ERROR', 'Ocurrió un error inesperado.', 500));

    console.error(
      JSON.stringify({
        level: 'error',
        event: 'http_request_failed',
        requestId: context.get('requestId'),
        code: appError.code,
        message: appError.message,
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
