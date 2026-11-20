import { pbkdf2, timingSafeEqual } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Pbkdf2PasswordHasher } from '../src/modules/identidad/infrastructure/password-hasher';
import { withDatabase } from '../src/infrastructure/persistence/postgres/connection';

const hasher = new Pbkdf2PasswordHasher();

function decode(value: string): Uint8Array {
  const normalized =
    value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(Buffer.from(normalized, 'base64'));
}

function verifyLegacyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, iterationText, saltText, digestText] = storedHash.split('$');
  if (algorithm !== 'pbkdf2-sha256' || !iterationText || !saltText || !digestText) {
    return Promise.resolve(password === storedHash);
  }

  const iterations = Number(iterationText);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000) return Promise.resolve(false);

  return new Promise((resolve, reject) => {
    pbkdf2(password, decode(saltText), iterations, 32, 'sha256', (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      const expected = Buffer.from(decode(digestText));
      resolve(expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey));
    });
  });
}

async function promptSecret(question: string): Promise<string> {
  const terminal = input;
  if (!terminal.isTTY || !terminal.setRawMode) {
    throw new Error('La migración requiere una terminal interactiva para ocultar la contraseña.');
  }

  output.write(question);
  terminal.setRawMode(true);

  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString()) {
        if (character === '\u0003') {
          cleanup();
          reject(new Error('Migración cancelada.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          output.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u007f') {
          value = value.slice(0, -1);
          continue;
        }
        value += character;
      }
    };
    const cleanup = () => {
      terminal.setRawMode?.(false);
      terminal.off('data', onData);
    };
    terminal.on('data', onData);
  });
}

const readline = createInterface({ input, output });

try {
  await withDatabase(process.env, async (database) => {
    console.info('Migración local de contraseñas a PBKDF2-SHA256/100000.');
    console.info('No se imprimirán contraseñas ni hashes. Deja el RUT vacío para terminar.');

    while (true) {
      const rut = (await readline.question('RUT a migrar: ')).trim();
      if (!rut) break;

      const result = await database.query<{
        id: string;
        rut: string;
        passwordHash: string;
        version: string;
      }>(
        `SELECT id_usuario::text AS id, rut, contrasena_hash AS "passwordHash", xmin::text AS version
         FROM usuario
         WHERE regexp_replace(upper(btrim(rut)), '[^0-9K]', '', 'g') =
               regexp_replace(upper($1), '[^0-9K]', '', 'g')`,
        [rut],
      );

      const user = result.rows[0];
      if (!user) {
        console.error('No se encontró un usuario con ese RUT.');
        continue;
      }

      const password = await promptSecret(`Contraseña actual de ${user.rut}: `);
      const valid = await verifyLegacyPassword(password, user.passwordHash);
      if (!valid) {
        console.error('La contraseña no coincide; no se modificó el usuario.');
        continue;
      }

      const upgradedHash = await hasher.hash(password);
      const updated = await database.query(
        `UPDATE usuario SET contrasena_hash = $2
         WHERE id_usuario = $1::bigint AND xmin::text = $3
         RETURNING id_usuario`,
        [user.id, upgradedHash, user.version],
      );

      if (!updated.rows[0]) {
        console.error('El usuario cambió durante la migración; no se actualizó.');
        continue;
      }

      console.info(`Usuario ${user.rut} migrado correctamente.`);
    }
  });
} finally {
  readline.close();
}
