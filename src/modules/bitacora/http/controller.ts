import type { AppEnv } from '../../../shared/config/bindings';
import type { LogRepository } from '../application/ports';
import { BitacoraService } from '../application/service';
import type { LogEntryInput } from '../domain/log-entry';

export interface BitacoraDependencies {
  repository: LogRepository;
}
export type BitacoraDependenciesFactory = (env: AppEnv['Bindings']) => BitacoraDependencies;

export class BitacoraController {
  constructor(private readonly dependencies: BitacoraDependencies | BitacoraDependenciesFactory) {}

  list(env: AppEnv['Bindings'], managementId: string) {
    return this.service(env).list(managementId);
  }

  get(env: AppEnv['Bindings'], id: string) {
    return this.service(env).get(id);
  }

  create(env: AppEnv['Bindings'], input: LogEntryInput) {
    return this.service(env).create(input);
  }

  private service(env: AppEnv['Bindings']): BitacoraService {
    const deps =
      typeof this.dependencies === 'function' ? this.dependencies(env) : this.dependencies;
    return new BitacoraService(deps.repository);
  }
}
