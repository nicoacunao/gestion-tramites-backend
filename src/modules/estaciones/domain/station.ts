export interface Station {
  id: string;
  address: string;
  commune: string;
  legalName: string;
  zoneManager: string | null;
  commercialManager: string | null;
  companyRut: string | null;
  legalRepresentative: string | null;
  legalRepresentativeRut: string | null;
  estado: string;
}
