import { z } from 'zod';

const RuntimeConfigSchema = z.object({
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:4200'),
  DATA_ADAPTER: z.enum(['placeholder', 'excel-graph', 'sql']).default('sql'),
  GRAPH_AUTH_MODE: z.enum(['disabled', 'delegated-refresh-token']).default('disabled'),
});

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema> & {
  corsOrigins: readonly string[];
};

export function readRuntimeConfig(bindings: unknown): RuntimeConfig {
  const parsed = RuntimeConfigSchema.parse(bindings);

  return {
    ...parsed,
    corsOrigins: parsed.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
