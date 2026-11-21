import type { FileRecord } from '../domain/file-record';

export interface FileRepository {
  listByManagementSpecific(managementSpecificId: string): Promise<readonly FileRecord[]>;
  findById(id: string): Promise<FileRecord | null>;
  saveMetadata(record: FileRecord): Promise<FileRecord>;
}

export interface FileStorage {
  put(key: string, content: ReadableStream, mediaType: string): Promise<string>;
  get(reference: string): Promise<ReadableStream | null>;
}
