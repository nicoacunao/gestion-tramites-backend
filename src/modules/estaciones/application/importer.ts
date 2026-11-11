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

function cell(value: unknown): string {
  return String(value ?? '').trim();
}

export async function parseStationImport(file: File): Promise<readonly Station[]> {
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
    if (!id) errors.push({ row: index + 2, message: 'EDS es obligatorio.' });
    else if (ids.has(id)) errors.push({ row: index + 2, message: `EDS duplicado: ${id}.` });
    else ids.add(id);
    if (!legalName || !address || !commune || !status)
      errors.push({
        row: index + 2,
        message: 'RAZON SOCIAL, DIRECCION, COMUNA y STATUS son obligatorios.',
      });
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
      status,
      version: 1,
    });
  });
  if (errors.length > 0)
    throw new AppError(
      'INVALID_IMPORT_ROWS',
      'El archivo contiene filas inválidas y no fue importado.',
      422,
      { errors },
    );
  return stations;
}
