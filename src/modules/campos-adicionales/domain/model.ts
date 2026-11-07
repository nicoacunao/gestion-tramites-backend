export interface AdditionalField {
  id: string;
  managementTypeId: string;
  code: string;
  label: string;
  controlType: 'text' | 'select';
  required: boolean;
  options: { value: string; order: number }[];
}
