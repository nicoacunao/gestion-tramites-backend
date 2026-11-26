import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/shared/errors/app-error';
import { PostgresStationRepository } from '../src/modules/estaciones/infrastructure/postgres-station-repository';

afterEach(() => vi.restoreAllMocks());

describe('PostgresStationRepository', () => {
  it('preserva el error original si también falla el rollback', async () => {
    const originalError = new AppError('RESOURCE_CONFLICT', 'Conflicto.', 409);
    const query = vi
      .fn()
      .mockRejectedValueOnce(originalError)
      .mockRejectedValueOnce(new Error('detalle interno del rollback'));
    const release = vi.fn();
    const connect = vi.fn().mockResolvedValue({ query, release });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const repository = new PostgresStationRepository({ connect } as never);

    await expect(repository.importStations([])).rejects.toBe(originalError);
    expect(query.mock.calls.map(([statement]) => statement)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(release).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0]?.[0]).not.toContain('detalle interno del rollback');
  });
});
