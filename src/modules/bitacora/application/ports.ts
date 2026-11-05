import type { LogEntry } from '../domain/log-entry';

export interface LogRepository {
  listByManagement(managementId: string): Promise<readonly LogEntry[]>;
  findById(id: string): Promise<LogEntry | null>;
  append(entry: LogEntry): Promise<void>;
}
