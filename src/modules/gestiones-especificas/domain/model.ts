export interface SpecificManagementBackground {
  id: string;
  name: string;
}

export interface SpecificManagement {
  id: string;
  managementTypeId: string;
  code: string;
  name: string;
  active: boolean;
  backgrounds: SpecificManagementBackground[];
}
