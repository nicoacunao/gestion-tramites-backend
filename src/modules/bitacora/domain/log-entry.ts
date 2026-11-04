export interface LogEntry {
  id: string;
  managementId: string;
  userId: string;
  occurredAt: string;
  authorName: string;
  authorInitials: string;
  type: 'inicio' | 'novedad' | 'seguimiento' | 'contacto' | null;
  title: string;
  comment: string;
  automatic: boolean;
  version: number;
}
