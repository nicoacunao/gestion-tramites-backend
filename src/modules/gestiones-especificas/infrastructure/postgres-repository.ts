import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import type { GestionesEspecificasRepository } from '../application/ports';
import type { SpecificManagement } from '../domain/model';
export class PostgresGestionesEspecificasRepository implements GestionesEspecificasRepository {
  constructor(private readonly database: SqlExecutor) {}
  async list(managementId: string): Promise<readonly SpecificManagement[]> {
    const result = await this.database.query<SpecificManagement>(
      `SELECT ge.id_gestion_especifica::text AS id,
        ge.id_gestion::text AS "managementId",
        ge.id_tipo_gestion::text AS "managementTypeId",
        tg.nombre AS "managementTypeName",
        tg.nivel AS level,
        ge.responsable::text AS "responsibleUserId",
        concat_ws(' ', u.nombres, u.primer_apellido, u.segundo_apellido) AS "responsibleName",
        ge.estado AS status,
        ge.url_archivo AS "fileUrl",
        ge.fecha_carga::text AS "uploadedAt"
      FROM gestion_especifica ge
      JOIN tipo_gestion tg ON tg.id_tipo_gestion = ge.id_tipo_gestion
      JOIN usuario u ON u.id_usuario = ge.responsable
      WHERE ge.id_gestion = $1::bigint
      ORDER BY tg.nivel, tg.nombre, ge.id_gestion_especifica`,
      [managementId],
    );
    return result.rows;
  }
}
