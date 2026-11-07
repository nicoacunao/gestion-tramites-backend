import type { AppBindings } from '../../../shared/config/bindings';
import { AppError } from '../../../shared/errors/app-error';
import type { AmbitosRepository } from '../application/ports';
import { AmbitosService } from '../application/service';

export interface AmbitosDependencies {
  repository: AmbitosRepository;
  authorize: (request: Request, requiredRole: string) => boolean | Promise<boolean>;
}
export type AmbitosDependenciesFactory = (env: AppBindings) => AmbitosDependencies;

export class AmbitosController {
  constructor(private readonly dependencies: AmbitosDependencies) {}
  async list(request: Request) {
    if (!(await this.dependencies.authorize(request, 'indagación')))
      throw new AppError('FORBIDDEN', 'No tienes permisos para administrar catálogos.', 403);
    return new AmbitosService(this.dependencies.repository).list();
  }
}
