import type { StationImportSummary, StationRepository } from './ports';
import type { Station } from '../domain/station';
import { AppError } from '../../../shared/errors/app-error';

export interface StationFilters {
  eds?: string | undefined;
  commune?: string | undefined;
  status?: string | undefined;
  legalName?: string | undefined;
}

export class StationService {
  constructor(private readonly repository: StationRepository) {}

  async list(query: StationFilters): Promise<readonly Station[]> {
    return (await this.repository.listStations()).filter(
      (item) =>
        (!query.eds || item.id === query.eds) &&
        (!query.commune ||
          item.commune.toLocaleLowerCase().includes(query.commune.toLocaleLowerCase())) &&
        (!query.status || item.status === query.status) &&
        (!query.legalName ||
          item.legalName.toLocaleLowerCase().includes(query.legalName.toLocaleLowerCase())),
    );
  }

  async get(id: string): Promise<Station> {
    const station = await this.repository.findStationById(id);
    if (!station)
      throw new AppError('RESOURCE_NOT_FOUND', 'La estación solicitada no existe.', 404);
    return station;
  }

  async create(station: Station): Promise<Station> {
    if (await this.repository.findStationById(station.id))
      throw new AppError('RESOURCE_CONFLICT', 'Ya existe una estación con ese EDS.', 409);
    return (await this.repository.saveStation(station)) ?? station;
  }

  async update(station: Station): Promise<Station> {
    const current = await this.get(station.id);
    if (station.version !== current.version)
      throw new AppError('VERSION_CONFLICT', 'La estación fue modificada por otro usuario.', 409, {
        expectedVersion: current.version,
      });
    const updated = { ...station, version: current.version + 1 };
    return (await this.repository.saveStation(updated, current.version)) ?? updated;
  }

  async import(stations: readonly Station[], rejected = 0): Promise<StationImportSummary> {
    if (stations.length === 0)
      throw new AppError('INVALID_IMPORT', 'El archivo no contiene filas para importar.', 422);
    if (!this.repository.importStations)
      throw new AppError(
        'CAPABILITY_NOT_CONFIGURED',
        'La importación de estaciones no está configurada.',
        503,
      );
    const result = await this.repository.importStations(stations);
    return { ...result, rejected: result.rejected + rejected };
  }
}
