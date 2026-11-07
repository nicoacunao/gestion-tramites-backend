import type { AppBindings } from '../../../shared/config/bindings';
import { AppError } from '../../../shared/errors/app-error';
import type { TiposGestionRepository } from '../application/ports';
import { TiposGestionService } from '../application/service';

export interface TiposGestionDependencies {
  repository: TiposGestionRepository;
  authorize: (request: Request, requiredRole: string) => boolean | Promise<boolean>;
}
export type TiposGestionDependenciesFactory = (env: AppBindings) => TiposGestionDependencies;

export class TiposGestionController {
  constructor(private readonly dependencies: TiposGestionDependencies) {}
  async list(request: Request) {
    if (!(await this.dependencies.authorize(request, 'indagación')))
      throw new AppError('FORBIDDEN', 'No tienes permisos para administrar catálogos.', 403);
    return new TiposGestionService(this.dependencies.repository).list();
  }
}
