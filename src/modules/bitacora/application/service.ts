import { AppError } from '../../../shared/errors/app-error';
import type { LogEntry, LogEntryInput } from '../domain/log-entry';
import type { LogRepository } from './ports';

export class BitacoraService {
  constructor(private readonly repository: LogRepository) {}

  list(managementId: string): Promise<readonly LogEntry[]> {
    this.assertManagementCode(managementId);
    return this.repository.listByManagement(managementId);
  }

  async get(id: string): Promise<LogEntry> {
    const entry = await this.repository.findById(id);
    if (!entry) throw new AppError('RESOURCE_NOT_FOUND', 'La entrada solicitada no existe.', 404);
    return entry;
  }

  async create(input: LogEntryInput): Promise<LogEntry> {
    this.assertManagementCode(input.managementId);
    if (input.automatic && input.type !== 'inicio')
      throw new AppError(
        'INVALID_AUTOMATIC_LOG_TYPE',
        'Las entradas automáticas deben tener tipo inicio.',
        422,
      );
    if (!input.id && (!input.automatic || input.type !== 'inicio'))
      throw new AppError(
        'BITACORA_ID_REQUIRED',
        'Debes indicar un identificador para la entrada manual.',
        422,
      );
    if (input.userId === null)
      throw new AppError(
        'BITACORA_AUTHOR_REQUIRED',
        'Debes indicar un usuario para obtener el nombre y las iniciales del autor.',
        422,
      );
    if (!/^[1-9]\d{0,18}$/.test(input.userId) || BigInt(input.userId) > 9223372036854775807n)
      throw new AppError(
        'INVALID_USER_ID',
        'El usuario debe tener un identificador BIGINT positivo.',
        422,
      );

    const date = new Date(`${input.registeredOn}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.registeredOn) ||
      input.registeredOn.startsWith('0000-') ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== input.registeredOn ||
      !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(input.registeredAt)
    )
      throw new AppError(
        'INVALID_LOG_TIMESTAMP',
        'La fecha y hora de la entrada no son válidas.',
        422,
      );

    const id = input.id ?? this.automaticEntryId(input);
    if (await this.repository.findById(id))
      throw new AppError('RESOURCE_CONFLICT', 'Ya existe una entrada con ese identificador.', 409);
    const entry = { ...input, id, version: 1 };
    await this.repository.append(entry);
    return (await this.repository.findById(id)) ?? entry;
  }

  private automaticEntryId(input: LogEntryInput): string {
    return `AUTO-${input.managementId}-${input.registeredOn}-${input.registeredAt.replaceAll(':', '')}`;
  }

  private assertManagementCode(code: string): void {
    if (!code.trim() || Array.from(code).length > 30)
      throw new AppError(
        'INVALID_MANAGEMENT_CODE',
        'El código de gestión debe tener entre 1 y 30 caracteres.',
        422,
      );
  }
}
