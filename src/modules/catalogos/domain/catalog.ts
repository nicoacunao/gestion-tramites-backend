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

export interface ManagementScope {
  code: string;
  name: string;
  version: number;
}

export interface ManagementType {
  id: string;
  name: string;
  version: number;
}

export interface ManagementTypeRelation {
  parentTypeId: string;
  childTypeId: string;
  order: number;
  version: number;
}

export interface BackgroundCatalogItem {
  id: string;
  name: string;
  version: number;
}

export interface StageCatalogItem {
  id: string;
  name: string;
  percentage: number;
  order: number;
  version: number;
}
