import { AppError } from '../../../shared/errors/app-error';
import type { ManagementInput, ManagementPriority, ManagementStatus } from '../domain/management';
import type { ManagementRepository } from './ports';

const priorities: readonly ManagementPriority[] = ['Alta', 'Media', 'Baja'];
const statuses: readonly ManagementStatus[] = [
  'Borrador',
  'Pendiente',
  'Ingresado',
  'En tramitación',
  'Observado',
  'Reingresado',
  'Rechazado',
  'Terminado aprobado',
  'Terminado desfavorable',
];

function assertInput(input: ManagementInput): void {
  if (!/^[1-9]\d*$/.test(input.stationId) || !/^[1-9]\d*$/.test(input.responsibleUserId))
    throw new AppError(
      'INVALID_MANAGEMENT_REFERENCE',
      'La estación y el responsable deben ser IDs numéricos.',
      422,
    );
  if (!priorities.includes(input.priority))
    throw new AppError('INVALID_PRIORITY', 'La prioridad no es válida.', 422);
  if (!statuses.includes(input.status))
    throw new AppError('INVALID_STATUS', 'El estado no es válido.', 422);
  for (const value of [input.openedOn, input.estimatedCompletionOn, input.lastReviewedOn]) {
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new AppError('INVALID_DATE', 'La fecha debe usar el formato YYYY-MM-DD.', 422);
  }
  if (input.estimatedCompletionOn && input.estimatedCompletionOn < input.openedOn)
    throw new AppError(
      'INVALID_DATE_RANGE',
      'La fecha estimada no puede ser anterior a la apertura.',
      422,
    );
  if (input.lastReviewedOn && input.lastReviewedOn < input.openedOn)
    throw new AppError(
      'INVALID_DATE_RANGE',
      'La última revisión no puede ser anterior a la apertura.',
      422,
    );
}

export class ManagementService {
  constructor(private readonly repository: ManagementRepository) {}
  list(responsibleUserId?: string) {
    return this.repository.list(responsibleUserId);
  }
  async find(id: string) {
    const item = await this.repository.findById(id);
    if (!item) throw new AppError('RESOURCE_NOT_FOUND', 'La gestión solicitada no existe.', 404);
    return item;
  }
  async create(input: ManagementInput) {
    assertInput(input);
    return this.repository.save(input);
  }
  async update(id: string, input: ManagementInput) {
    assertInput({ ...input, id });
    if (!(await this.repository.findById(id)))
      throw new AppError('RESOURCE_NOT_FOUND', 'La gestión solicitada no existe.', 404);
    return this.repository.save({ ...input, id });
  }
}
