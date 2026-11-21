import type { CatalogRepository } from '../application/ports';
import type {
  BackgroundCatalogItem,
  ManagementScope,
  ManagementType,
  StageCatalogItem,
  Station,
} from '../domain/catalog';
import type { TabularDataSource, TabularRow } from '../../../shared/persistence/tabular-repository';

function text(row: TabularRow, key: string): string {
  return typeof row[key] === 'string' ? String(row[key]).trim() : String(row[key] ?? '').trim();
}
function nullableText(row: TabularRow, key: string): string | null {
  const value = text(row, key);
  return value || null;
}
function numberValue(row: TabularRow, key: string): number {
  return typeof row[key] === 'number' ? (row[key] as number) : Number(row[key] ?? 0);
}

function stationFromRow(row: TabularRow): Station {
  return {
    id: text(row, 'id_estacion') || text(row, 'eds'),
    address: text(row, 'direccion'),
    commune: text(row, 'comuna'),
    legalName: text(row, 'razon_social'),
    zoneManager: text(row, 'jefe_zona'),
    commercialManager: text(row, 'jefe_comercial'),
    companyRut: text(row, 'rut_sociedad'),
    legalRepresentative: text(row, 'representante_legal'),
    legalRepresentativeRut: nullableText(row, 'rut_representante_legal'),
    estado: text(row, 'estado'),
  };
}

function stationToRow(station: Station): TabularRow {
  return {
    id_estacion: station.id,
    direccion: station.address,
    comuna: station.commune,
    razon_social: station.legalName,
    jefe_zona: station.zoneManager,
    jefe_comercial: station.commercialManager,
    rut_sociedad: station.companyRut,
    representante_legal: station.legalRepresentative,
    rut_representante_legal: station.legalRepresentativeRut,
    estado: station.estado,
  };
}

export class ExcelCatalogRepository implements CatalogRepository {
  constructor(private readonly source: TabularDataSource) {}

  async listStations(): Promise<readonly Station[]> {
    return (await this.source.readTable('tbl_estaciones')).map(stationFromRow);
  }
  async findStationById(id: string): Promise<Station | null> {
    const row = await this.source.findRow('tbl_estaciones', id);
    return row ? stationFromRow(row) : null;
  }
  async saveStation(station: Station): Promise<void> {
    await this.source.upsertRow('tbl_estaciones', stationToRow(station));
  }

  async listScopes(): Promise<readonly ManagementScope[]> {
    return (await this.source.readTable('tbl_ambitos_gestion')).map((row) => ({
      id: text(row, 'id_ambito_gestion'),
      code: text(row, 'codigo'),
      name: text(row, 'nombre'),
    }));
  }
  async listManagementTypes(): Promise<readonly ManagementType[]> {
    return (await this.source.readTable('tbl_tipos_gestion')).map((row) => ({
      id: text(row, 'id_tipo_gestion'),
      parentId: nullableText(row, 'id_gestion_padre'),
      scopeId: nullableText(row, 'id_ambito_gestion'),
      name: text(row, 'nombre'),
      level: numberValue(row, 'nivel'),
      required: row.flag_requerida === true || text(row, 'flag_requerida').toUpperCase() === 'TRUE',
    }));
  }
  async listBackgrounds(): Promise<readonly BackgroundCatalogItem[]> {
    return (await this.source.readTable('tbl_antecedentes')).map((row) => ({
      id: text(row, 'id_antecedente'),
      name: text(row, 'nombre'),
      version: numberValue(row, 'version'),
    }));
  }
  async listStages(): Promise<readonly StageCatalogItem[]> {
    return (await this.source.readTable('tbl_etapas')).map((row) => ({
      id: text(row, 'id_etapa'),
      name: text(row, 'nombre'),
      percentage: numberValue(row, 'porcentaje'),
      order: numberValue(row, 'orden'),
      version: numberValue(row, 'version'),
    }));
  }
}
