import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from '../config/bindings';

export const requestContextMiddleware: MiddlewareHandler<AppEnv> = async (context, next) => {
  const requestId = context.req.header('x-request-id') ?? crypto.randomUUID();

  context.set('requestId', requestId);
  context.header('x-request-id', requestId);

  await next();
};
