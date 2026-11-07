import type { z } from '@hono/zod-openapi';
import type { AppBindings } from '../../../shared/config/bindings';
import { AppError } from '../../../shared/errors/app-error';
import type { StationRepository } from '../application/ports';
import { StationService, type StationFilters } from '../application/service';
import type { StationUpdateSchema, StationWriteSchema } from './schemas';

export interface EstacionesDependencies {
  repository: StationRepository;
  authorize: (request: Request, requiredRole: string) => boolean | Promise<boolean>;
}
export type EstacionesDependenciesFactory = (env: AppBindings) => EstacionesDependencies;

export class StationController {
  private readonly service: StationService;
  constructor(private readonly dependencies: EstacionesDependencies) {
    this.service = new StationService(dependencies.repository);
  }
  private async authorize(request: Request): Promise<void> {
    if (!(await this.dependencies.authorize(request, 'indagación')))
      throw new AppError('FORBIDDEN', 'No tienes permisos para administrar catálogos.', 403);
  }
  async list(request: Request, filters: StationFilters) {
    await this.authorize(request);
    return this.service.list(filters);
  }
  async get(request: Request, id: string) {
    await this.authorize(request);
    return this.service.get(id);
  }
  async create(request: Request, input: z.infer<typeof StationWriteSchema>) {
    await this.authorize(request);
    return this.service.create({
      ...input,
      name: input.name ?? null,
      legalRepresentativeRut: input.legalRepresentativeRut ?? null,
      version: 1,
    });
  }
  async update(request: Request, id: string, input: z.infer<typeof StationUpdateSchema>) {
    await this.authorize(request);
    return this.service.update({
      ...input,
      id,
      name: input.name ?? null,
      legalRepresentativeRut: input.legalRepresentativeRut ?? null,
    });
  }
}
