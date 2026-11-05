import { describe, expect, it } from 'vitest';
import { createLoginRouter } from '../src/modules/identidad/http/router';
import type { LoginDependencies } from '../src/modules/identidad/application/login';
import { AppError } from '../src/shared/errors/app-error';

const dependencies: LoginDependencies = {
  users: {
    findById: async () => null,
    findByRut: async (rut) =>
      rut === '12.345.678-9'
        ? {
            id: 'u-1',
            rut,
            passwordHash: 'hash',
            names: 'Ana',
            firstSurname: 'Pérez',
            secondSurname: null,
            email: 'ana@example.com',
            phone: null,
            description: null,
            role: 'analista',
            organization: null,
            active: true,
            version: 1,
          }
        : null,
    save: async () => undefined,
  },
  passwords: {
    hash: async (value) => value,
    verify: async (value, hash) => value === 'correcta' && hash === 'hash',
  },
  sessions: {
    issue: async (userId) => ({
      userId,
      token: 'signed-token',
      expiresAt: '2026-11-05T20:00:00.000Z',
    }),
  },
};

const app = createLoginRouter(() => dependencies);
app.onError((error, context) => {
  const appError = error instanceof AppError ? error : new AppError('INTERNAL_ERROR', 'Error', 500);
  return context.json(
    { error: { code: appError.code, message: appError.message }, meta: { requestId: 'test' } },
    appError.status,
  );
});

describe('POST /login de identidad', () => {
  it('autentica y devuelve sesión y perfil público', async () => {
    const response = await app.request('/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rut: '12.345.678-9', password: 'correcta' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { accessToken: 'signed-token', user: { id: 'u-1', role: 'analista' } },
    });
  });

  it('rechaza credenciales inválidas sin revelar la causa', async () => {
    const response = await app.request('/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rut: '12.345.678-9', password: 'incorrecta' }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'INVALID_CREDENTIALS' } });
  });

  it('rechaza un body inválido', async () => {
    const response = await app.request('/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rut: '', password: '' }),
    });
    expect(response.status).toBe(400);
  });
});
