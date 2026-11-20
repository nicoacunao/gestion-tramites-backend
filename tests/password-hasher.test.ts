import { describe, expect, it } from 'vitest';
import { Pbkdf2PasswordHasher } from '../src/modules/identidad/infrastructure/password-hasher';

describe('Pbkdf2PasswordHasher', () => {
  it('trata valores nulos o formatos inválidos como no hash', () => {
    const hasher = new Pbkdf2PasswordHasher();

    expect(hasher.isHash(null)).toBe(false);
    expect(hasher.isHash(undefined)).toBe(false);
    expect(hasher.isHash('formato-invalido')).toBe(false);
  });

  it('no lanza una excepción al verificar un valor no válido', async () => {
    const hasher = new Pbkdf2PasswordHasher();

    await expect(hasher.verify('password', null)).resolves.toBe(false);
  });

  it('genera y verifica hashes PBKDF2 con las iteraciones del sistema', async () => {
    const hasher = new Pbkdf2PasswordHasher();
    const hash = await hasher.hash('password-de-prueba');

    expect(hash.startsWith('pbkdf2-sha256$100000$')).toBe(true);
    await expect(hasher.verify('password-de-prueba', hash)).resolves.toBe(true);
    await expect(hasher.verify('otra-password', hash)).resolves.toBe(false);
  });

  it('no trata un hash legado de 310000 iteraciones como contraseña plana', () => {
    const hasher = new Pbkdf2PasswordHasher();

    expect(hasher.isHash('pbkdf2-sha256$310000$legacy-salt$legacy-digest')).toBe(true);
  });
});
