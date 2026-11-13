export interface SpecificManagementBackground {
  id: string;
  name: string;
  level: 'N2' | 'N3' | 'N4';
  parentBackgroundId: string | null;
}

export interface SpecificManagement {
  id: string;
  managementTypeId: string;
  code: string;
  name: string;
  level: 'N2';
  active: boolean;
  backgrounds: SpecificManagementBackground[];
}
