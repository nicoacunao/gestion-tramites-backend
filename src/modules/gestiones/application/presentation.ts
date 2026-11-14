import type { Management } from '../domain/management';

export type ManagementTrafficStatus = 'al-dia' | 'proximo-vencer' | 'atrasado';

export interface ManagementPresentation {
  codigo: string;
  nivel: Management['level'];
  ambito: string;
  codigoAmbito: string;
  correlativo: number;
  semaforo: ManagementTrafficStatus;
  semaforoEtiqueta: string;
  fechaInicio: string;
  fechaIngreso: string;
  fechaIngresoOrden: string;
  fechaEstimadaTermino: string;
  responsableInterno: string;
  idEstacion: string;
  estacionServicio: string;
  direccion: string;
  comuna: string;
  rutRazonSocial: string;
  razonSocial: string;
  representanteLegal: string;
  rutRepresentanteLegal: string;
  concesionario: string;
  descripcion: string;
}

const TRAFFIC_LABELS: Record<ManagementTrafficStatus, string> = {
  'al-dia': 'Al día',
  'proximo-vencer': 'Próximo a vencer',
  atrasado: 'Requiere atención',
};

function displayDate(value: string | null | undefined): string {
  if (!value) return 'Sin especificar';
  const [year, month, day] = value.slice(0, 10).split('-');
  return day && month && year ? `${day}-${month}-${year}` : 'Sin especificar';
}

function orderDate(value: string): string {
  const [day, month, year] = value.split('-');
  return `${year}-${month}-${day}`;
}

function companyDisplayName(value: string | null | undefined): string {
  return (value ?? 'Sin registrar').replace(/\s+(SpA|Ltda\.)$/i, '');
}

export function presentManagement(management: Management): Management & ManagementPresentation {
  const status: ManagementTrafficStatus =
    management.status === 'Observado' || management.status === 'Rechazado' ? 'atrasado' : 'al-dia';
  const openedOn = displayDate(management.openedOn);
  const legalName = management.legalName ?? 'Sin registrar';
  const representative = management.legalRepresentative ?? 'Sin registrar';
  const responsible = management.responsibleName ?? management.responsibleUserId;
  const station = management.stationName ?? management.stationId;

  return {
    ...management,
    codigo: management.id,
    nivel: management.level,
    ambito: management.scopeName ?? management.scopeCode,
    codigoAmbito: management.scopeCode,
    correlativo: management.sequence,
    semaforo: status,
    semaforoEtiqueta: TRAFFIC_LABELS[status],
    fechaInicio: openedOn,
    fechaIngreso: openedOn,
    fechaIngresoOrden: orderDate(openedOn),
    fechaEstimadaTermino: displayDate(management.estimatedCompletionOn),
    responsableInterno: responsible,
    idEstacion: management.stationId,
    estacionServicio: station,
    direccion: management.address ?? 'Sin registrar',
    comuna: management.commune ?? 'Sin registrar',
    rutRazonSocial: management.legalRut ?? 'Sin registrar',
    razonSocial: legalName,
    representanteLegal: representative,
    rutRepresentanteLegal: management.legalRepresentativeRut ?? 'Sin registrar',
    concesionario: companyDisplayName(legalName),
    descripcion:
      management.specificManagementName ??
      management.managementTypeName ??
      management.managementTypeId,
  };
}
