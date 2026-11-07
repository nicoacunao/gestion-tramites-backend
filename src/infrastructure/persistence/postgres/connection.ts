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
export function createDatabasePool(env: DatabaseEnvironment): Pool {
  const pool = new Pool(readDatabaseConfig(env));
  // Idle connections may fail asynchronously. Do not expose credentials or SQL values.
  pool.on('error', () => {
    console.error(JSON.stringify({ level: 'error', event: 'postgres_idle_connection_failed' }));
  });
  return pool;
}

/** Share one lazy pool across the modules handling the same request, then close it. */
export function createDatabaseSession(env: DatabaseEnvironment): DatabaseSession {
  let pool: Pool | undefined;
  let closed = false;
  let closePromise: Promise<void> | undefined;
  return {
    getPool() {
      if (closed) throw new AppError('DATABASE_SESSION_CLOSED', 'La solicitud ya finalizó.', 500);
      pool ??= createDatabasePool(env);
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
