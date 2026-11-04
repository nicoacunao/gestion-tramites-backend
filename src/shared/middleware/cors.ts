import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';

import type { AppEnv } from '../config/bindings';
import { readRuntimeConfig } from '../config/runtime-config';

export const corsMiddleware: MiddlewareHandler<AppEnv> = async (context, next) => {
  const config = readRuntimeConfig(context.env);

  return cors({
    origin: (origin) => (config.corsOrigins.includes(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    exposeHeaders: ['X-Request-Id'],
    credentials: false,
    maxAge: 86_400,
  })(context, next);
};
