import { AppError } from '../../../shared/errors/app-error';

/** Traduce SQLSTATE sin devolver SQL, parámetros, credenciales o detalles de filas. */
export function translateDatabaseError(error: unknown): AppError | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  const code = String(error.code);
  if (code === '23505')
    return new AppError('RESOURCE_CONFLICT', 'Ya existe un registro con esos datos únicos.', 409);
  if (['23503', '23502', '23514', '22001', '22003', '22007', '22008', '22P02'].includes(code))
    return new AppError(
      'INVALID_DATABASE_VALUE',
      'Los datos no cumplen las restricciones del esquema.',
      422,
    );
  if (
    code.startsWith('08') ||
    ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', '28P01', '53300', '57P01'].includes(
      code,
    )
  )
    return new AppError('DATABASE_UNAVAILABLE', 'La base de datos no está disponible.', 503);
  return null;
}
