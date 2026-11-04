import { mkdir, writeFile } from 'node:fs/promises';

import { app } from '../src/app';
import type { AppBindings } from '../src/shared/config/bindings';

const bindings = {
  APP_ENV: 'development',
  LOG_LEVEL: 'debug',
  CORS_ORIGINS: 'http://localhost:4200',
  DATA_ADAPTER: 'placeholder',
  GRAPH_AUTH_MODE: 'disabled',
} as unknown as AppBindings;

const response = await app.request('/openapi.json', {}, bindings);

if (!response.ok) {
  throw new Error(`No fue posible generar OpenAPI: HTTP ${response.status}`);
}

await mkdir('openapi', { recursive: true });
await writeFile('openapi/openapi.json', `${JSON.stringify(await response.json(), null, 2)}\n`);
