export interface SecretBindings {
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
