import type { PoolConfig } from 'pg';
import { AppError } from '../../../shared/errors/app-error';

export interface DatabaseEnvironment {
  HYPERDRIVE?: { connectionString: string };
  DATABASE_URL?: string;
  DATABASE_SSL_MODE?: string;
  DATABASE_SSL_CA?: string;
  DATABASE_POOL_MAX?: string;
  DATABASE_CONNECTION_TIMEOUT_MS?: string;
  DATABASE_IDLE_TIMEOUT_MS?: string;
  APP_ENV?: string;
}

function invalidConfiguration(): never {
  throw new AppError(
    'DATABASE_NOT_CONFIGURED',
    'Revisa DATABASE_URL y las variables DATABASE_* según .env.example.',
    503,
  );
}

function positiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(value)) return invalidConfiguration();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum)
    return invalidConfiguration();
  return parsed;
}

/** Never include input values in validation errors: the URL contains credentials. */
export function readDatabaseConfig(env: DatabaseEnvironment): PoolConfig {
  if (!env.DATABASE_URL) return invalidConfiguration();
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    return invalidConfiguration();
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname)
    return invalidConfiguration();

  const sslMode = env.DATABASE_SSL_MODE || 'verify-full';
  if (sslMode !== 'verify-full' && sslMode !== 'disable') return invalidConfiguration();
  if (
    env.DATABASE_SSL_CA &&
    (!env.DATABASE_SSL_CA.includes('BEGIN CERTIFICATE') ||
      !env.DATABASE_SSL_CA.includes('END CERTIFICATE'))
  )
    return invalidConfiguration();
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (sslMode === 'disable' && (!local || env.APP_ENV === 'production'))
    return invalidConfiguration();

  // pg connection-string SSL options override the explicit ssl object. Accept only an
  // equivalent sslmode, then remove it so a configured CA remains effective.
  for (const key of url.searchParams.keys()) {
    if (key === 'sslmode' && url.searchParams.getAll(key).every((value) => value === sslMode))
      continue;
    if (
      key.startsWith('ssl') ||
      [
        'uselibpqcompat',
        'host',
        'hostaddr',
        'port',
        'user',
        'password',
        'database',
        'dbname',
      ].includes(key)
    )
      return invalidConfiguration();
  }
  url.searchParams.delete('sslmode');

  return {
    connectionString: url.toString(),
    ssl:
      sslMode === 'disable'
        ? false
        : {
            rejectUnauthorized: true,
            ...(env.DATABASE_SSL_CA ? { ca: env.DATABASE_SSL_CA.replaceAll('\\n', '\n') } : {}),
          },
    max: positiveInteger(env.DATABASE_POOL_MAX, 5, 100),
    connectionTimeoutMillis: positiveInteger(env.DATABASE_CONNECTION_TIMEOUT_MS, 10_000, 120_000),
    idleTimeoutMillis: positiveInteger(env.DATABASE_IDLE_TIMEOUT_MS, 30_000, 600_000),
    application_name: 'gestion-tramites-backend',
  };
}
