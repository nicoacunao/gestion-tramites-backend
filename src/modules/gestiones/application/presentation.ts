import type { Management } from '../domain/management';

export function presentManagement(management: Management): Management {
  return {
    ...management,
    codigo: management.code ?? null,
    nivel: management.level ?? null,
    ambito: management.scopeName ?? null,
    codigoAmbito: management.scopeCode ?? null,
    correlativo: management.sequence ?? null,
    semaforo: management.trafficLight ?? 'al-dia',
    semaforoEtiqueta: management.trafficLightLabel ?? 'Al día',
  };
}
