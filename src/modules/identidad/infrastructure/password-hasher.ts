const ITERATIONS = 310_000;
const encoder = new TextEncoder();

function encode(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function decode(value: string): Uint8Array {
  const normalized =
    value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}

export class Pbkdf2PasswordHasher {
  async hash(plainText: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await this.derive(plainText, salt, ITERATIONS);
    return `pbkdf2-sha256$${ITERATIONS}$${encode(salt.buffer)}$${encode(key)}`;
  }

  isHash(passwordHash: string): boolean {
    return this.parse(passwordHash) !== null;
  }

  async verify(plainText: string, passwordHash: string): Promise<boolean> {
    const parsed = this.parse(passwordHash);
    if (!parsed) return false;
    const { iterations, salt, expected } = parsed;
    const actual = new Uint8Array(await this.derive(plainText, salt, iterations));
    if (actual.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < actual.length; index += 1)
      difference |= (actual[index] ?? 0) ^ (expected[index] ?? 0);
    return difference === 0;
  }

  private parse(passwordHash: string): {
    iterations: number;
    salt: Uint8Array;
    expected: Uint8Array;
  } | null {
    const [algorithm, iterationText, saltText, expectedText] = passwordHash.split('$');
    if (algorithm !== 'pbkdf2-sha256' || !iterationText || !saltText || !expectedText) return null;
    const iterations = Number(iterationText);
    if (!Number.isSafeInteger(iterations) || iterations < 100_000) return null;
    try {
      const salt = decode(saltText);
      const expected = decode(expectedText);
      if (salt.length === 0 || expected.length === 0) return null;
      return { iterations, salt, expected };
    } catch {
      return null;
    }
  }

  private async derive(
    plainText: string,
    salt: Uint8Array,
    iterations: number,
  ): Promise<ArrayBuffer> {
    const material = await crypto.subtle.importKey(
      'raw',
      encoder.encode(plainText),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    return crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
      material,
      256,
    );
  }
}
