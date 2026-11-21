import { AppError } from '../../../shared/errors/app-error';
import type { LogEntry, LogEntryInput } from '../domain/log-entry';
import type { LogRepository } from './ports';

export class BitacoraService {
  constructor(private readonly repository: LogRepository) {}

  list(managementId: string): Promise<readonly LogEntry[]> {
    this.assertId(
      managementId,
      'INVALID_MANAGEMENT_ID',
      'La gestión debe tener un ID BIGINT positivo.',
    );
    return this.repository.listByManagement(managementId);
  }

  async get(id: string): Promise<LogEntry> {
    this.assertId(id, 'INVALID_LOG_ID', 'La entrada debe tener un ID numérico positivo.');
    const entry = await this.repository.findById(id);
    if (!entry) throw new AppError('RESOURCE_NOT_FOUND', 'La entrada solicitada no existe.', 404);
    return entry;
  }

  async create(input: LogEntryInput): Promise<LogEntry> {
    this.assertId(
      input.managementId,
      'INVALID_MANAGEMENT_ID',
      'La gestión debe tener un ID BIGINT positivo.',
    );
    if (input.userId !== null && input.userId !== undefined)
      this.assertId(
        input.userId,
        'INVALID_USER_ID',
        'El usuario debe tener un ID BIGINT positivo.',
      );
    if (
      !input.title.trim() ||
      input.title.length > 80 ||
      !input.comment.trim() ||
      input.comment.length > 1000
    )
      throw new AppError('INVALID_LOG_CONTENT', 'El título o comentario no es válido.', 422);
    if (
      input.type !== null &&
      input.type !== undefined &&
      !['inicio', 'novedad', 'seguimiento', 'contacto'].includes(input.type)
    )
      throw new AppError('INVALID_LOG_TYPE', 'El tipo de entrada no es válido.', 422);
    const registeredOn = input.registeredOn ?? new Date().toISOString().slice(0, 10);
    const registeredAt = input.registeredAt ?? new Date().toISOString().slice(11, 19);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(registeredOn) ||
      !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(registeredAt)
    )
      throw new AppError(
        'INVALID_LOG_TIMESTAMP',
        'La fecha y hora de la entrada no son válidas.',
        422,
      );
    return this.repository.append({ ...input, registeredOn, registeredAt });
  }

  private assertId(value: string, code: string, message: string): void {
    if (!/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n)
      throw new AppError(code, message, 422);
  }
}
