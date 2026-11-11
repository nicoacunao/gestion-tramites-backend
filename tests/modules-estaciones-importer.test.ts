import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseStationImport } from '../src/modules/estaciones/application/importer';

const headers = [
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
];

function workbookFile(rows: unknown[][], name = 'stations.xlsx'): File {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'INFO PAGINA WEB');
  return new File([XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })], name);
}

describe('parseStationImport', () => {
  it('accepts blank STATUS and applies the default station status', async () => {
    const stations = await parseStationImport(
      workbookFile([
        [
          '60000',
          'Comercial Válida Limitada',
          'Pedro Fontova 100',
          'Huechuraba',
          '',
          '',
          '',
          '',
          '',
          '',
        ],
        [
          '60001',
          'Comercial Soar Limitada',
          'Pedro Fontova 6789',
          'Huechuraba',
          '',
          '',
          '',
          '',
          '',
          '',
        ],
      ]),
    );

    expect(stations.stations).toHaveLength(1);
    expect(stations.stations[0]?.status).toBe('active');
  });

  it('skips incomplete rows and reports them separately', async () => {
    const result = await parseStationImport(
      workbookFile([
        [
          '60001',
          'Comercial Soar Limitada',
          'Pedro Fontova 6789',
          'Huechuraba',
          '',
          '',
          '',
          '',
          '',
          '',
        ],
        [
          '40525',
          'Sandro Schiappacasse S.A.',
          'Carr.Panam Norte Km.455',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ],
      ]),
    );

    expect(result.stations).toHaveLength(1);
    expect(result.errors).toEqual([
      { row: 3, message: 'RAZON SOCIAL, DIRECCION y COMUNA son obligatorios.' },
    ]);
  });

  it('accepts CSV files with the same header contract', async () => {
    const csv = `${headers.join(',')}\n60003,Servicios Focacci,Av. Gabriela 3950,Puente Alto,,,,,,NO\n`;
    const stations = await parseStationImport(new File([csv], 'stations.csv'));

    expect(stations.stations[0]).toMatchObject({
      id: '60003',
      commune: 'Puente Alto',
      status: 'NO',
    });
  });

  it('skips values that exceed database column limits', async () => {
    const result = await parseStationImport(
      workbookFile([
        [
          '60001',
          'Comercial Soar Limitada',
          'Pedro Fontova 6789',
          'Huechuraba',
          '',
          '',
          '76.109.281-2,',
          '',
          '',
          '',
        ],
      ]),
    );

    expect(result.stations).toHaveLength(1);
    expect(result.errors).toEqual([
      { row: 2, message: 'RUT SOCIEDAD supera el máximo de 12 caracteres.' },
    ]);
  });
});
