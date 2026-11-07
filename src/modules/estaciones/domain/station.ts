export interface Station {
  id: string;
  /** Nombre de presentación opcional; no reemplaza la razón social persistida. */
  name: string | null;
  address: string;
  commune: string;
  legalName: string;
  zoneManager: string;
  commercialManager: string;
  companyRut: string;
  legalRepresentative: string;
  legalRepresentativeRut: string | null;
  status: string;
  version: number;
}
