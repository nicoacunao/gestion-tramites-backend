export interface Station {
  id: string;
  name: string;
  address: string;
  commune: string;
  concessionaire: string;
  concessionaireRut: string | null;
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
