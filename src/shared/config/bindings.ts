import type { DatabaseSession } from '../../infrastructure/persistence/postgres/connection';

export interface SecretBindings {
  DATABASE_URL?: string;
  DATABASE_SSL_MODE?: string;
  DATABASE_SSL_CA?: string;
  DATABASE_POOL_MAX?: string;
  DATABASE_CONNECTION_TIMEOUT_MS?: string;
  DATABASE_IDLE_TIMEOUT_MS?: string;
  /** Sesión de pool inyectada por request; nunca es un secret de despliegue. */
  database?: DatabaseSession;
  AUTH_TOKEN_SECRET?: string;
  GRAPH_CLIENT_SECRET?: string;
  GRAPH_REFRESH_TOKEN?: string;
  GRAPH_TENANT_ID?: string;
  GRAPH_CLIENT_ID?: string;
  GRAPH_DRIVE_ID?: string;
  GRAPH_WORKBOOK_ITEM_ID?: string;
}

export type AppBindings = CloudflareBindings & SecretBindings;

export interface AppVariables {
  requestId: string;
}

export interface AppEnv {
  Bindings: AppBindings;
  Variables: AppVariables;
}
