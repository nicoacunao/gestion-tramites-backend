export interface SecretBindings {
  AUTH_TOKEN_SECRET?: string;
  GRAPH_CLIENT_SECRET?: string;
  GRAPH_REFRESH_TOKEN?: string;
}

export type AppBindings = CloudflareBindings & SecretBindings;

export interface AppVariables {
  requestId: string;
}

export interface AppEnv {
  Bindings: AppBindings;
  Variables: AppVariables;
}
