import { AppError } from '../../../shared/errors/app-error';
import type { ManagementRepository } from './ports';
import type { ManagementInput } from '../domain/management';

function assertInput(input: ManagementInput): void {
  if (input.id.length > 30 || input.scopeCode.length > 10 || input.sequence > 2147483647)
    throw new AppError(
      'INVALID_DATABASE_VALUE',
      'Código, ámbito o correlativo exceden los límites del esquema.',
      422,
    );
  if (
    !/^[1-9]\d*$/.test(input.responsibleUserId) ||
    BigInt(input.responsibleUserId) > 9223372036854775807n
  )
    throw new AppError(
      'INVALID_RESPONSIBLE',
      'El responsable debe ser un ID BIGINT positivo.',
      422,
    );
  if (input.status === null)
    throw new AppError('MANAGEMENT_STATUS_REQUIRED', 'La gestión requiere un estado.', 422);
  for (const value of [input.openedOn, input.estimatedCompletionOn, input.lastReviewedOn]) {
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        Number.isNaN(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      throw new AppError('INVALID_DATE', 'La fecha debe ser una fecha válida YYYY-MM-DD.', 422);
  }
  if (
    (input.estimatedCompletionOn && input.estimatedCompletionOn < input.openedOn) ||
    (input.lastReviewedOn && input.lastReviewedOn < input.openedOn)
  )
    throw new AppError(
      'INVALID_DATE_RANGE',
      'Las fechas no pueden ser anteriores a la apertura.',
      422,
    );
}

export class ManagementService {
  constructor(private readonly repository: ManagementRepository) {}
  list() {
    return this.repository.list();
  }
  async find(id: string) {
    const item = await this.repository.findById(id);
    if (!item) throw new AppError('RESOURCE_NOT_FOUND', 'La gestión solicitada no existe.', 404);
    return item;
  }
  async create(input: ManagementInput) {
    assertInput(input);
    if (await this.repository.findById(input.id))
      throw new AppError('RESOURCE_CONFLICT', 'Ya existe una gestión con ese identificador.', 409);
    const item = { ...input, version: 1 };
    await this.repository.save(item);
    return item;
  }
  async update(id: string, input: ManagementInput, version: number) {
    assertInput({ ...input, id });
    const current = await this.find(id);
    if (version !== current.version)
      throw new AppError('VERSION_CONFLICT', 'La gestión fue modificada por otro usuario.', 409, {
        expectedVersion: current.version,
      });
    const item = { ...input, id, version: current.version + 1 };
    await this.repository.save(item, version);
    return item;
  }
}
