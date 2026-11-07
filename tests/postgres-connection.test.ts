import { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { readDatabaseConfig } from '../src/infrastructure/persistence/postgres/config';
import {
  createDatabaseSession,
  withDatabase,
} from '../src/infrastructure/persistence/postgres/connection';

const env = { DATABASE_URL: 'postgresql://example:secret@db.example.invalid:5432/postgres' };

describe('configuración PostgreSQL', () => {
  it('verifica TLS por defecto y limita el pool', () => {
    expect(readDatabaseConfig(env)).toMatchObject({
      ssl: { rejectUnauthorized: true },
      max: 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    });
  });

  it('normaliza sslmode equivalente sin perder el certificado CA explícito', () => {
    const config = readDatabaseConfig({
      DATABASE_URL: `${env.DATABASE_URL}?sslmode=verify-full`,
      DATABASE_SSL_CA: '-----BEGIN CERTIFICATE-----\\ncertificate\\n-----END CERTIFICATE-----',
    });
    expect(config.ssl).toEqual({
      rejectUnauthorized: true,
      ca: '-----BEGIN CERTIFICATE-----\ncertificate\n-----END CERTIFICATE-----',
    });
    expect(config.connectionString).not.toContain('sslmode');
  });

  it.each(['sslmode=require', 'sslmode=no-verify', 'ssl=true', 'sslrootcert=file.pem'])(
    'rechaza opciones de la URL que anularían TLS: %s',
    (option) => {
      expect(() => readDatabaseConfig({ DATABASE_URL: `${env.DATABASE_URL}?${option}` })).toThrow();
    },
  );

  it('permite TLS desactivado solo para loopback fuera de producción', () => {
    const local = {
      DATABASE_URL: 'postgresql://example:secret@localhost:5432/postgres',
      DATABASE_SSL_MODE: 'disable',
    };
    expect(readDatabaseConfig(local).ssl).toBe(false);
    expect(() => readDatabaseConfig({ ...local, APP_ENV: 'production' })).toThrow();
    expect(() => readDatabaseConfig({ ...env, DATABASE_SSL_MODE: 'disable' })).toThrow();
  });

  it.each(['0', '-1', '1.5', 'abc', '101'])('rechaza tamaño de pool inválido: %s', (value) => {
    expect(() => readDatabaseConfig({ ...env, DATABASE_POOL_MAX: value })).toThrow();
  });

  it('no permite que parámetros URL cambien el host validado para TLS local', () => {
    expect(() =>
      readDatabaseConfig({
        DATABASE_URL: 'postgresql://example:secret@localhost/postgres?host=remote.example.invalid',
        DATABASE_SSL_MODE: 'disable',
      }),
    ).toThrow();
  });

  it('no incluye credenciales en errores de configuración', () => {
    expect(() => readDatabaseConfig({ ...env, DATABASE_CONNECTION_TIMEOUT_MS: 'invalid' })).toThrow(
      /^Revisa DATABASE_URL y las variables DATABASE_\* según \.env\.example\.$/,
    );
  });
});

describe('pool por solicitud de Cloudflare Workers', () => {
  it('no exige configuración de BD para rutas que no la usan', async () => {
    const session = createDatabaseSession({});
    await expect(session.close()).resolves.toBeUndefined();
  });

  it('comparte pool dentro de una solicitud y lo aísla entre solicitudes', async () => {
    const first = createDatabaseSession(env);
    const second = createDatabaseSession(env);
    try {
      expect(first.getPool()).toBe(first.getPool());
      expect(first.getPool()).not.toBe(second.getPool());
    } finally {
      await Promise.all([first.close(), second.close()]);
    }
    expect(() => first.getPool()).toThrow('La solicitud ya finalizó.');
  });

  it('cierra el pool una sola vez', async () => {
    const session = createDatabaseSession(env);
    const close = vi.spyOn(session.getPool(), 'end');
    await Promise.all([session.close(), session.close()]);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('cierra el pool aunque la operación falle', async () => {
    const close = vi.spyOn(Pool.prototype, 'end');
    const failure = new Error('failed operation');
    try {
      await expect(
        withDatabase(env, async () => {
          throw failure;
        }),
      ).rejects.toBe(failure);
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      close.mockRestore();
    }
  });
});
