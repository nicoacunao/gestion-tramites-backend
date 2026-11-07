import type { AppBindings } from '../../../shared/config/bindings';
import { AppError } from '../../../shared/errors/app-error';
import type { GestionesEspecificasRepository } from '../application/ports';
import { GestionesEspecificasService } from '../application/service';
export interface GestionesEspecificasDependencies {
  repository: GestionesEspecificasRepository;
  authorize: (request: Request, requiredRole: string) => boolean | Promise<boolean>;
}
export type GestionesEspecificasDependenciesFactory = (
  env: AppBindings,
) => GestionesEspecificasDependencies;
export class GestionesEspecificasController {
  constructor(private readonly dependencies: GestionesEspecificasDependencies) {}
  async list(request: Request, managementTypeId?: string) {
    if (!(await this.dependencies.authorize(request, 'indagación')))
      throw new AppError('FORBIDDEN', 'No tienes permisos para administrar catálogos.', 403);
    return new GestionesEspecificasService(this.dependencies.repository).list(managementTypeId);
  }
}
