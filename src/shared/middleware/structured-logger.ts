import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from '../config/bindings';

export const structuredLoggerMiddleware: MiddlewareHandler<AppEnv> = async (context, next) => {
  const startedAt = Date.now();

  await next();

  console.log(
    JSON.stringify({
      level: 'info',
      event: 'http_request_completed',
      requestId: context.get('requestId'),
      method: context.req.method,
      path: new URL(context.req.url).pathname,
      status: context.res.status,
      durationMs: Date.now() - startedAt,
    }),
  );
};
