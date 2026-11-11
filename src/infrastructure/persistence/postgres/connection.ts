import { Pool } from 'pg';
import { AppError } from '../../../shared/errors/app-error';
import { readDatabaseConfig, type DatabaseEnvironment } from './config';

export type SqlExecutor = Pick<Pool, 'query'>;

export interface DatabaseSession {
  getPool(): Pool;
  close(): Promise<void>;
}

/** Construct inside a request; Workers sockets must not be shared between requests.
 * https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/#considerations
 */
export function createDatabasePool(
  env: DatabaseEnvironment,
  onIdleConnectionError?: () => void,
): Pool {
  // Hyperdrive terminates and manages the upstream database connection for the
  // Worker. Its generated connection string must be passed through unchanged;
  // applying pg's SSL options here would make workerd validate Supabase's
  // shared-pooler certificate again and reproduce the TLS handshake failure.
  const config = env.HYPERDRIVE
    ? {
        connectionString: env.HYPERDRIVE.connectionString,
        max: positivePoolValue(env.DATABASE_POOL_MAX, 5, 100),
        connectionTimeoutMillis: positivePoolValue(
          env.DATABASE_CONNECTION_TIMEOUT_MS,
          10_000,
          120_000,
        ),
        idleTimeoutMillis: positivePoolValue(env.DATABASE_IDLE_TIMEOUT_MS, 30_000, 600_000),
        application_name: 'gestion-tramites-backend',
      }
    : readDatabaseConfig(env);
  const pool = new Pool(config);
  // Idle connections may fail asynchronously. Do not expose credentials or SQL values.
  pool.on(
    'error',
    onIdleConnectionError ??
      (() => {
        console.error(JSON.stringify({ level: 'error', event: 'postgres_idle_connection_failed' }));
      }),
  );
  return pool;
}

function positivePoolValue(value: string | undefined, fallback: number, maximum: number): number {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(value))
    throw new AppError('DATABASE_NOT_CONFIGURED', 'Configuración de base de datos inválida.', 503);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum)
    throw new AppError('DATABASE_NOT_CONFIGURED', 'Configuración de base de datos inválida.', 503);
  return parsed;
}

/** Share one lazy pool across the modules handling the same request, then close it. */
export function createDatabaseSession(env: DatabaseEnvironment): DatabaseSession {
  let pool: Pool | undefined;
  let closed = false;
  let closePromise: Promise<void> | undefined;
  return {
    getPool() {
      if (closed) throw new AppError('DATABASE_SESSION_CLOSED', 'La solicitud ya finalizó.', 500);
      pool ??= createDatabasePool(env, () => {
        if (!closed)
          console.error(
            JSON.stringify({ level: 'error', event: 'postgres_idle_connection_failed' }),
          );
      });
      return pool;
    },
    close() {
      if (!closePromise) {
        closed = true;
        closePromise = pool ? pool.end() : Promise.resolve();
      }
      return closePromise;
    },
  };
}

/** Useful for scripts or a complete operation outside the HTTP middleware. */
export async function withDatabase<T>(
  env: DatabaseEnvironment,
  operation: (database: SqlExecutor) => Promise<T>,
): Promise<T> {
  const session = createDatabaseSession(env);
  try {
    return await operation(session.getPool());
  } finally {
    await session.close();
  }
}
