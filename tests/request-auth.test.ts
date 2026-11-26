import { describe, expect, it } from 'vitest';
import { authorizeRequest } from '../src/shared/auth/request-auth';

describe('authorizeRequest', () => {
  it('propaga 401 cuando falta el bearer token', async () => {
    await expect(
      authorizeRequest(
        new Request('https://api.test/resource'),
        { AUTH_TOKEN_SECRET: 'secret', database: {} } as never,
        'gestiones',
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
  });

  it('propaga 503 cuando la autenticación no está configurada', async () => {
    await expect(
      authorizeRequest(new Request('https://api.test/resource'), {} as never, 'gestiones'),
    ).rejects.toMatchObject({ code: 'IDENTITY_NOT_CONFIGURED', status: 503 });
  });
});
