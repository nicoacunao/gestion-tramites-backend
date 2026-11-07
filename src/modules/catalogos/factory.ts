import type { AppBindings } from '../../shared/config/bindings';
import { postgresEstacionesDependencies } from '../estaciones';
import { postgresAmbitosDependencies } from '../ambitos';
import { postgresTiposGestionDependencies } from '../tipos-gestion';
import { postgresAntecedentesDependencies } from '../antecedentes';
import { postgresEtapasDependencies } from '../etapas';
import type { CatalogosDependencies } from './http/router';

/** Sólo compone adaptadores para las rutas antiguas; no contiene SQL ni lógica de catálogo. */
export function postgresCatalogosDependencies(env: AppBindings): CatalogosDependencies {
  const stations = postgresEstacionesDependencies(env);
  const scopes = postgresAmbitosDependencies(env).repository;
  const types = postgresTiposGestionDependencies(env).repository;
  const backgrounds = postgresAntecedentesDependencies(env).repository;
  const stages = postgresEtapasDependencies(env).repository;
  return {
    authorize: stations.authorize,
    repository: {
      listStations: () => stations.repository.listStations(),
      findStationById: (id) => stations.repository.findStationById(id),
      saveStation: (station, version) => stations.repository.saveStation(station, version),
      listScopes: () => scopes.listScopes(),
      listManagementTypes: () => types.listManagementTypes(),
      listBackgrounds: () => backgrounds.listBackgrounds(),
      listStages: () => stages.listStages(),
    },
  };
}
