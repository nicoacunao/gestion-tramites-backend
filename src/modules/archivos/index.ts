export type { FileRepository, FileStorage } from './application/ports';
export type { FileRecord } from './domain/file-record';
export { archivosModule } from './health/router';
export { createArchivosRouter } from './http/router';
export { postgresArchivosDependencies } from './factory';
