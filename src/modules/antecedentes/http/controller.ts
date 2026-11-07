import type { AppBindings } from '../../../shared/config/bindings';
import { AppError } from '../../../shared/errors/app-error';
import type { AntecedentesRepository } from '../application/ports';
import { AntecedentesService } from '../application/service';

export interface AntecedentesDependencies {
  repository: AntecedentesRepository;
  authorize: (request: Request, requiredRole: string) => boolean | Promise<boolean>;
}
export type AntecedentesDependenciesFactory = (env: AppBindings) => AntecedentesDependencies;

export class AntecedentesController {
  constructor(private readonly dependencies: AntecedentesDependencies) {}
  async list(request: Request) {
    if (!(await this.dependencies.authorize(request, 'indagación')))
      throw new AppError('FORBIDDEN', 'No tienes permisos para administrar catálogos.', 403);
    return new AntecedentesService(this.dependencies.repository).list();
  }
}
