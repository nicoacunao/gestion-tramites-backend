export type LogEntryType = 'inicio' | 'novedad' | 'seguimiento' | 'contacto';

export interface LogEntry {
  id: string;
  managementId: string;
  userId: string | null;
  registeredOn: string;
  registeredAt: string;
  title: string;
  comment: string;
  type: LogEntryType | null;
}

export type LogEntryInput = Omit<LogEntry, 'id' | 'registeredOn' | 'registeredAt'> & {
  registeredOn?: string;
  registeredAt?: string;
};
