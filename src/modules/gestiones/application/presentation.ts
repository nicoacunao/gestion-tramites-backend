import type { Management } from '../domain/management';

export function presentManagement(management: Management): Management {
  return { ...management };
}
