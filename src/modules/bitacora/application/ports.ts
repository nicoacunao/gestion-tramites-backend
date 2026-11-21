import type { LogEntry, LogEntryInput } from '../domain/log-entry';

export interface LogRepository {
  listByManagement(managementId: string): Promise<readonly LogEntry[]>;
  findById(id: string): Promise<LogEntry | null>;
  append(entry: LogEntryInput): Promise<LogEntry>;
}
