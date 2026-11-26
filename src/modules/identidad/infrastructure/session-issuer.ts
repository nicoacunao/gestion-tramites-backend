import type { AuthSession } from '../domain/user';
import type { SessionIssuer } from '../application/ports';
import { AppError } from '../../../shared/errors/app-error';

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const HMAC_IMPORT_ALGORITHM = { name: 'HMAC', hash: { name: 'SHA-256' } } as const;
const HMAC_SIGN_ALGORITHM = { name: 'HMAC' } as const;

function encode(value: string): string {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export class HmacSessionIssuer implements SessionIssuer {
  constructor(
    private readonly secret: string,
    private readonly now = () => Date.now(),
  ) {}

  async issue(userId: string): Promise<AuthSession> {
    if (!this.secret)
      throw new AppError('IDENTITY_NOT_CONFIGURED', 'La autenticación no está configurada.', 503);
    const expiresAt = new Date(this.now() + SESSION_TTL_SECONDS * 1000).toISOString();
    const payload = encode(JSON.stringify({ sub: userId, exp: expiresAt }));
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.secret),
      HMAC_IMPORT_ALGORITHM,
      false,
      ['sign'],
    );
    const signature = encode(
      String.fromCharCode(
        ...new Uint8Array(
          await crypto.subtle.sign(HMAC_SIGN_ALGORITHM, key, new TextEncoder().encode(payload)),
        ),
      ),
    );
    return { userId, token: `${payload}.${signature}`, expiresAt };
  }
}

export class HmacSessionVerifier {
  constructor(
    private readonly secret: string,
    private readonly now = () => Date.now(),
  ) {}

  async verify(token: string): Promise<string | null> {
    const [payload, suppliedSignature] = token.split('.');
    if (!payload || !suppliedSignature || !this.secret) return null;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.secret),
      HMAC_IMPORT_ALGORITHM,
      false,
      ['sign'],
    );
    const expected = encode(
      String.fromCharCode(
        ...new Uint8Array(
          await crypto.subtle.sign(HMAC_SIGN_ALGORITHM, key, new TextEncoder().encode(payload)),
        ),
      ),
    );
    if (expected !== suppliedSignature) return null;
    try {
      const decoded = JSON.parse(
        atob(
          payload.replaceAll('-', '+').replaceAll('_', '/') +
            '='.repeat((4 - (payload.length % 4)) % 4),
        ),
      ) as { sub?: string; exp?: string };
      if (!decoded.sub || !decoded.exp || Date.parse(decoded.exp) <= this.now()) return null;
      return decoded.sub;
    } catch {
      return null;
    }
  }
}
