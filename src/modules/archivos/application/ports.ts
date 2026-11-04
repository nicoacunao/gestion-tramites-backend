import type { FileRecord } from '../domain/file-record';

export interface FileRepository {
  listByManagement(managementId: string): Promise<readonly FileRecord[]>;
  findById(id: string): Promise<FileRecord | null>;
  saveMetadata(record: FileRecord, expectedVersion?: number): Promise<void>;
}

export interface FileStorage {
  put(key: string, content: ReadableStream, mediaType: string): Promise<string>;
  get(reference: string): Promise<ReadableStream | null>;
}
