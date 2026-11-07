import type { AuthSession } from '../domain/user';
import type { SessionIssuer } from '../application/ports';

const SESSION_TTL_SECONDS = 8 * 60 * 60;

function encode(value: string): string {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export class HmacSessionIssuer implements SessionIssuer {
  constructor(
    private readonly secret: string,
    private readonly now = () => Date.now(),
  ) {}

  async issue(userId: string): Promise<AuthSession> {
    if (!this.secret) throw new Error('AUTH_TOKEN_SECRET no está configurado.');
    const expiresAt = new Date(this.now() + SESSION_TTL_SECONDS * 1000).toISOString();
    const payload = encode(JSON.stringify({ sub: userId, exp: expiresAt }));
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = encode(
      String.fromCharCode(
        ...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))),
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
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const expected = encode(
      String.fromCharCode(
        ...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))),
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
