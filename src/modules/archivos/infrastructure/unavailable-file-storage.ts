import { AppError } from '../../../shared/errors/app-error';
import type { FileStorage } from '../application/ports';

export class UnavailableFileStorage implements FileStorage {
  async put(_key: string, _content: ReadableStream, _mediaType: string): Promise<string> {
    throw new AppError(
      'FILE_STORAGE_UNAVAILABLE',
      'El servidor de almacenamiento de archivos aún no está disponible.',
      503,
    );
  }

  async get(_reference: string): Promise<ReadableStream | null> {
    throw new AppError(
      'FILE_STORAGE_UNAVAILABLE',
      'El servidor de almacenamiento de archivos aún no está disponible.',
      503,
    );
  }
}
