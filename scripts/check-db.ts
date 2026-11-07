import { withDatabase } from '../src/infrastructure/persistence/postgres/connection';

try {
  await withDatabase(process.env, async (database) => {
    const result = await database.query<{ connected: number }>(
      'SELECT $1::integer AS connected',
      [1],
    );
    if (result.rows[0]?.connected !== 1) throw new Error('Unexpected result');
  });
  console.info('Conexión PostgreSQL correcta. Consulta parametrizada ejecutada.');
} catch {
  // pg errors may contain connection details; do not print them or the DATABASE_URL.
  console.error(
    'No se pudo verificar PostgreSQL. Revisa DATABASE_URL, TLS/CA, acceso de red y disponibilidad de la base.',
  );
  process.exitCode = 1;
}
