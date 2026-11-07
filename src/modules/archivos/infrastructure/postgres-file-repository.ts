import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import type { FileRecord } from '../domain/file-record';
import type { FileRepository } from '../application/ports';
export class PostgresFileRepository implements FileRepository {
  constructor(private readonly database: SqlExecutor) {}
  async listByManagement(managementId: string): Promise<readonly FileRecord[]> {
    const r = await this.database.query<FileRecord>(
      `SELECT a.id_archivo AS id, g.codigo AS "managementId", a.id_antecedente_gestion::text AS "managementBackgroundId", a.proveedor AS "storageProvider", a.referencia_almacenamiento AS "storageReference", a.nombre_archivo AS "fileName", a.tipo_mime AS "mediaType", a.tamano_bytes::bigint AS "sizeBytes", a.id_usuario_carga::text AS "uploadedByUserId", a.fecha_carga::text AS "uploadedAt", 1 AS version FROM archivo_gestion a JOIN gestion g ON g.id_gestion = a.id_gestion WHERE g.codigo = $1 ORDER BY a.fecha_carga DESC`,
      [managementId],
    );
    return r.rows;
  }
  async findById(id: string): Promise<FileRecord | null> {
    const r = await this.database.query<FileRecord>(
      `SELECT a.id_archivo AS id, g.codigo AS "managementId", a.id_antecedente_gestion::text AS "managementBackgroundId", a.proveedor AS "storageProvider", a.referencia_almacenamiento AS "storageReference", a.nombre_archivo AS "fileName", a.tipo_mime AS "mediaType", a.tamano_bytes::bigint AS "sizeBytes", a.id_usuario_carga::text AS "uploadedByUserId", a.fecha_carga::text AS "uploadedAt", 1 AS version FROM archivo_gestion a JOIN gestion g ON g.id_gestion = a.id_gestion WHERE a.id_archivo = $1`,
      [id],
    );
    return r.rows[0] ?? null;
  }
  async saveMetadata(record: FileRecord): Promise<void> {
    await this.database.query(
      `INSERT INTO archivo_gestion (id_archivo,id_gestion,id_antecedente_gestion,proveedor,referencia_almacenamiento,nombre_archivo,tipo_mime,tamano_bytes,id_usuario_carga) VALUES ($1,(SELECT id_gestion FROM gestion WHERE codigo=$2),$3,$4,$5,$6,$7,$8,$9)`,
      [
        record.id,
        record.managementId,
        record.managementBackgroundId,
        record.storageProvider,
        record.storageReference,
        record.fileName,
        record.mediaType,
        record.sizeBytes,
        record.uploadedByUserId,
      ],
    );
  }
}
