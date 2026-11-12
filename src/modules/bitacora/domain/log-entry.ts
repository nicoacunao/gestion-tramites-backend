export interface LogEntry {
  id: string;
  managementId: string;
  userId: string | null;
  registeredOn: string;
  registeredAt: string;
  title: string;
  comment: string;
  authorName?: string | null;
  authorInitials?: string | null;
  type?: 'inicio' | 'novedad' | 'seguimiento' | 'contacto' | null;
  automatic?: boolean;
  version: number;
}

export type LogEntryInput = Omit<
  LogEntry,
  'id' | 'version' | 'authorName' | 'authorInitials' | 'type' | 'automatic'
> & {
  id?: string | undefined;
  type: 'inicio' | 'novedad' | 'seguimiento' | 'contacto' | null;
  automatic: boolean;
};
