import type { LogEntry } from '../domain/log-entry';

export interface LogRepository {
  listByManagement(managementId: string): Promise<readonly LogEntry[]>;
  append(entry: LogEntry): Promise<void>;
}
