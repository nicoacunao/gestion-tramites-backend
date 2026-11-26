import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import { AppError } from '../../../shared/errors/app-error';
import type { FileRepository } from '../application/ports';
import type { FileRecord } from '../domain/file-record';

export class PostgresFileRepository implements FileRepository {
  constructor(private readonly database: SqlExecutor) {}

  async listByManagementSpecific(managementSpecificId: string): Promise<readonly FileRecord[]> {
    const result = await this.database.query<FileRecord>(
      `SELECT ge.id_gestion_especifica::text AS "managementSpecificId",
         ge.id_gestion_especifica::text AS id, ge.url_archivo AS "storageReference",
         ge.fecha_carga::text AS "uploadedAt"
       FROM gestion_especifica ge
       WHERE ge.id_gestion_especifica = $1::bigint AND ge.url_archivo IS NOT NULL`,
      [managementSpecificId],
    );
    return result.rows;
  }

  async findById(id: string): Promise<FileRecord | null> {
    const result = await this.database.query<FileRecord>(
      `SELECT ge.id_gestion_especifica::text AS "managementSpecificId",
         ge.id_gestion_especifica::text AS id, ge.url_archivo AS "storageReference",
         ge.fecha_carga::text AS "uploadedAt"
       FROM gestion_especifica ge
       WHERE ge.id_gestion_especifica = $1::bigint AND ge.url_archivo IS NOT NULL`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async saveMetadata(record: FileRecord): Promise<FileRecord> {
    const result = await this.database.query<FileRecord>(
      `UPDATE gestion_especifica
       SET url_archivo = $2, fecha_carga = now()
       WHERE id_gestion_especifica = $1::bigint
       RETURNING id_gestion_especifica::text AS "managementSpecificId",
         id_gestion_especifica::text AS id, url_archivo AS "storageReference",
         fecha_carga::text AS "uploadedAt"`,
      [record.managementSpecificId, record.storageReference],
    );
    if (!result.rows[0])
      throw new AppError('RESOURCE_NOT_FOUND', 'La gestión específica no existe.', 404);
    return result.rows[0];
  }
}
