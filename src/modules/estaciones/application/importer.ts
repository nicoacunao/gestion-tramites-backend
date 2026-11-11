import * as XLSX from 'xlsx';
import { AppError } from '../../../shared/errors/app-error';
import type { Station } from '../domain/station';

export const MAX_STATION_IMPORT_BYTES = 10 * 1024 * 1024;
const HEADERS = [
  'EDS',
  'RAZON SOCIAL',
  'DIRECCION',
  'COMUNA',
  'JEFE DE ZONA',
  'JEFE COMERCIAL',
  'RUT SOCIEDAD',
  'Socio 1 Representante Legal',
  'RUT REPRESENTANTE LEGAL',
  'STATUS',
] as const;

const FIELD_LIMITS = [
  { index: 0, name: 'EDS', max: 20 },
  { index: 1, name: 'RAZON SOCIAL', max: 150 },
  { index: 2, name: 'DIRECCION', max: 250 },
  { index: 3, name: 'COMUNA', max: 100 },
  { index: 4, name: 'JEFE DE ZONA', max: 150 },
  { index: 5, name: 'JEFE COMERCIAL', max: 150 },
  { index: 6, name: 'RUT SOCIEDAD', max: 12 },
  { index: 7, name: 'Socio 1 Representante Legal', max: 150 },
  { index: 8, name: 'RUT REPRESENTANTE LEGAL', max: 12 },
  { index: 9, name: 'STATUS', max: 30 },
] as const;

export interface StationImportParseResult {
  stations: readonly Station[];
  errors: readonly { row: number; message: string }[];
}

function cell(value: unknown): string {
  return String(value ?? '').trim();
}

function rowErrorMessage(errors: readonly { row: number; message: string }[]): string {
  const preview = errors
    .slice(0, 5)
    .map((error) => `Fila ${error.row}: ${error.message}`)
    .join(' ');
  const remaining = errors.length - Math.min(errors.length, 5);
  return `El archivo no fue importado. ${preview}${remaining > 0 ? ` Hay ${remaining} errores adicionales.` : ''}`;
}

export async function parseStationImport(file: File): Promise<StationImportParseResult> {
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension !== 'xlsx' && extension !== 'csv')
    throw new AppError('INVALID_FILE_TYPE', 'El archivo debe tener extensión .xlsx o .csv.', 422);
  if (file.size === 0 || file.size > MAX_STATION_IMPORT_BYTES)
    throw new AppError('INVALID_FILE_SIZE', 'El archivo debe pesar entre 1 byte y 10 MB.', 422);

  let rows: unknown[][];
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: false });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0] ?? ''];
    rows = firstSheet
      ? (XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) as unknown[][])
      : [];
  } catch {
    throw new AppError('INVALID_FILE', 'No se pudo leer el archivo importado.', 422);
  }
  const header = (rows[0] ?? []).map(cell);
  if (
    header.length !== HEADERS.length ||
    HEADERS.some((expected, index) => header[index] !== expected)
  )
    throw new AppError(
      'INVALID_IMPORT_COLUMNS',
      'Las columnas del archivo no coinciden con las requeridas.',
      422,
      {
        expected: HEADERS,
        received: header,
      },
    );

  const errors: Array<{ row: number; message: string }> = [];
  const stations: Station[] = [];
  const ids = new Set<string>();
  rows.slice(1).forEach((row, index) => {
    const values = HEADERS.map((_, column) => cell(row[column]));
    if (values.every((value) => value === '')) return;
    const value = (column: number) => values[column] ?? '';
    const id = value(0);
    const legalName = value(1);
    const address = value(2);
    const commune = value(3);
    const zoneManager = value(4);
    const commercialManager = value(5);
    const companyRut = value(6);
    const legalRepresentative = value(7);
    const legalRepresentativeRut = value(8);
    const status = value(9);
    const rowErrors: Array<{ row: number; message: string }> = [];
    if (!id) rowErrors.push({ row: index + 2, message: 'EDS es obligatorio.' });
    else if (ids.has(id)) rowErrors.push({ row: index + 2, message: `EDS duplicado: ${id}.` });
    if (!legalName || !address || !commune)
      rowErrors.push({
        row: index + 2,
        message: 'RAZON SOCIAL, DIRECCION y COMUNA son obligatorios.',
      });
    for (const field of FIELD_LIMITS) {
      if ((values[field.index] ?? '').length > field.max)
        rowErrors.push({
          row: index + 2,
          message: `${field.name} supera el máximo de ${field.max} caracteres.`,
        });
    }
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }
    ids.add(id);
    stations.push({
      id,
      name: null,
      legalName,
      address,
      commune,
      zoneManager,
      commercialManager,
      companyRut,
      legalRepresentative,
      legalRepresentativeRut: legalRepresentativeRut || null,
      // La fuente histórica deja STATUS vacío en muchas filas. El contrato de
      // estaciones usa active como estado derivado por defecto.
      status: status || 'active',
      version: 1,
    });
  });
  if (stations.length === 0 && errors.length > 0)
    throw new AppError('INVALID_IMPORT_ROWS', rowErrorMessage(errors), 422, {
      errors,
      totalErrors: errors.length,
    });
  return { stations, errors };
}
