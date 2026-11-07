import type { MiddlewareHandler } from 'hono';
import { createDatabaseSession } from '../../infrastructure/persistence/postgres/connection';
import type { AppEnv } from '../config/bindings';

export const databaseMiddleware: MiddlewareHandler<AppEnv> = async (context, next) => {
  const session = createDatabaseSession(context.env);
  // No modificar los bindings compartidos por el runtime entre solicitudes.
  context.env = { ...context.env, database: session };
  try {
    await next();
  } finally {
    // Cerrar antes de finalizar el handler también funciona con app.request en Node.
    await session.close();
  }
};
