import type { AppBindings } from '../../../shared/config/bindings';
import { AppError } from '../../../shared/errors/app-error';
import type { EtapasRepository } from '../application/ports';
import { EtapasService } from '../application/service';

export interface EtapasDependencies {
  repository: EtapasRepository;
  authorize: (request: Request, requiredRole: string) => boolean | Promise<boolean>;
}
export type EtapasDependenciesFactory = (env: AppBindings) => EtapasDependencies;

export class EtapasController {
  constructor(private readonly dependencies: EtapasDependencies) {}
  async list(request: Request) {
    if (!(await this.dependencies.authorize(request, 'indagación')))
      throw new AppError('FORBIDDEN', 'No tienes permisos para administrar catálogos.', 403);
    return new EtapasService(this.dependencies.repository).list();
  }
}
