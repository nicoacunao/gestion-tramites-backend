import type { AppBindings } from '../../../shared/config/bindings';
import { AppError } from '../../../shared/errors/app-error';
import type { CamposAdicionalesRepository } from '../application/ports';
import { CamposAdicionalesService } from '../application/service';
export interface CamposAdicionalesDependencies {
  repository: CamposAdicionalesRepository;
  authorize: (request: Request, requiredRole: string) => boolean | Promise<boolean>;
}
export type CamposAdicionalesDependenciesFactory = (
  env: AppBindings,
) => CamposAdicionalesDependencies;
export class CamposAdicionalesController {
  constructor(private readonly dependencies: CamposAdicionalesDependencies) {}
  async list(request: Request, managementTypeId?: string) {
    if (!(await this.dependencies.authorize(request, 'indagación')))
      throw new AppError('FORBIDDEN', 'No tienes permisos para administrar catálogos.', 403);
    return new CamposAdicionalesService(this.dependencies.repository).list(managementTypeId);
  }
}
