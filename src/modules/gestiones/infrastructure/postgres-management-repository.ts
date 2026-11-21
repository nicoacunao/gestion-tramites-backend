import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import type { ManagementRepository } from '../application/ports';
import type {
  Management,
  ManagementInput,
  ManagementStage,
  ManagementStageCreateInput,
} from '../domain/management';

const projection = `g.id_gestion::text AS id, g.id_estacion::text AS "stationId",
  g.id_usuario_responsable::text AS "responsibleUserId", g.fecha_creacion::text AS "createdAt",
  g.fecha_apertura::text AS "openedOn", g.fecha_estimada_termino::text AS "estimatedCompletionOn",
  g.fecha_ultima_revision::text AS "lastReviewedOn", g.prioridad AS priority, g.estado AS status,
  g.nombre_solicitante AS "requesterName", e.razon_social AS "stationName", e.razon_social AS "legalName",
  e.comuna, e.direccion AS address, e.rut_sociedad AS "legalRut",
  e.nombre_representante_legal AS "legalRepresentative", e.rut_representante_legal AS "legalRepresentativeRut",
  concat_ws(' ', u.nombres, u.primer_apellido, u.segundo_apellido) AS "responsibleName"`;

export class PostgresManagementRepository implements ManagementRepository {
  constructor(private readonly database: SqlExecutor) {}

  async list(responsibleUserId?: string): Promise<readonly Management[]> {
    const where =
      responsibleUserId === undefined ? '' : ' WHERE g.id_usuario_responsable = $1::bigint';
    const result = await this.database.query<Management>(
      `SELECT ${projection} FROM gestion g
       JOIN estacion e ON e.id_estacion = g.id_estacion
       JOIN usuario u ON u.id_usuario = g.id_usuario_responsable${where}
       ORDER BY g.id_gestion`,
      responsibleUserId === undefined ? [] : [responsibleUserId],
    );
    return result.rows;
  }

  async findById(id: string): Promise<Management | null> {
    const result = await this.database.query<Management>(
      `SELECT ${projection} FROM gestion g
       JOIN estacion e ON e.id_estacion = g.id_estacion
       JOIN usuario u ON u.id_usuario = g.id_usuario_responsable
       WHERE g.id_gestion = $1::bigint`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async save(input: ManagementInput): Promise<Management> {
    const values = [
      input.stationId,
      input.responsibleUserId,
      input.openedOn,
      input.estimatedCompletionOn,
      input.lastReviewedOn,
      input.priority,
      input.status,
      input.requesterName,
    ];
    const result = input.id
      ? await this.database.query<Management>(
          `UPDATE gestion SET id_estacion = $2::bigint, id_usuario_responsable = $3::bigint,
             fecha_apertura = $4::date, fecha_estimada_termino = $5::date,
             fecha_ultima_revision = $6::date, prioridad = $7, estado = $8,
             nombre_solicitante = $9
           WHERE id_gestion = $1::bigint
           RETURNING ${projection}`,
          [input.id, ...values],
        )
      : await this.database.query<Management>(
          `INSERT INTO gestion (id_estacion, id_usuario_responsable, fecha_apertura,
             fecha_estimada_termino, fecha_ultima_revision, prioridad, estado, nombre_solicitante)
           VALUES ($1::bigint, $2::bigint, $3::date, $4::date, $5::date, $6, $7, $8)
           RETURNING ${projection}`,
          values,
        );
    if (!result.rows[0]) throw new Error('La gestión no pudo ser guardada.');
    return result.rows[0];
  }

  async listStages(managementId: string): Promise<readonly ManagementStage[]> {
    const result = await this.database.query<ManagementStage>(
      `SELECT eg.id_etapa_gestion::text AS id, eg.id_gestion::text AS "managementId",
         eg.id_etapa::text AS "stageId", e.nombre AS "stageName", e.porcentaje AS percentage,
         eg.estado AS status, eg.fecha_estimada::text AS "estimatedOn", eg.fecha_real::text AS "completedOn",
         eg.responsable::text AS "responsibleUserId",
         concat_ws(' ', u.nombres, u.primer_apellido, u.segundo_apellido) AS responsible,
         eg.observaciones AS notes
       FROM etapa_gestion eg JOIN etapa e ON e.id_etapa = eg.id_etapa
       LEFT JOIN usuario u ON u.id_usuario = eg.responsable
       WHERE eg.id_gestion = $1::bigint ORDER BY e.orden`,
      [managementId],
    );
    return result.rows;
  }

  async findStage(id: string): Promise<ManagementStage | null> {
    const rows = await this.database.query<ManagementStage>(
      `SELECT eg.id_etapa_gestion::text AS id, eg.id_gestion::text AS "managementId",
         eg.id_etapa::text AS "stageId", e.nombre AS "stageName", e.porcentaje AS percentage,
         eg.estado AS status, eg.fecha_estimada::text AS "estimatedOn", eg.fecha_real::text AS "completedOn",
         eg.responsable::text AS "responsibleUserId",
         concat_ws(' ', u.nombres, u.primer_apellido, u.segundo_apellido) AS responsible,
         eg.observaciones AS notes
       FROM etapa_gestion eg JOIN etapa e ON e.id_etapa = eg.id_etapa
       LEFT JOIN usuario u ON u.id_usuario = eg.responsable
       WHERE eg.id_etapa_gestion = $1::bigint`,
      [id],
    );
    return rows.rows[0] ?? null;
  }

  async createStage(
    managementId: string,
    input: ManagementStageCreateInput,
  ): Promise<ManagementStage> {
    const result = await this.database.query<ManagementStage>(
      `INSERT INTO etapa_gestion (id_gestion, id_etapa, estado, fecha_estimada, fecha_real, responsable, observaciones)
       VALUES ($1::bigint,
         COALESCE(NULLIF($2, '')::bigint, (SELECT id_etapa FROM etapa WHERE nombre = $3 LIMIT 1)),
         COALESCE($4, 'Pendiente'), $5::date, $6::date, NULLIF($7, '')::bigint, $8)
       RETURNING id_etapa_gestion::text AS id, id_gestion::text AS "managementId",
         id_etapa::text AS "stageId", (SELECT nombre FROM etapa WHERE id_etapa = etapa_gestion.id_etapa) AS "stageName",
         (SELECT porcentaje FROM etapa WHERE id_etapa = etapa_gestion.id_etapa) AS percentage,
         estado AS status, fecha_estimada::text AS "estimatedOn", fecha_real::text AS "completedOn",
         responsable::text AS "responsibleUserId", observaciones AS notes`,
      [
        managementId,
        input.stageId ?? '',
        input.name,
        input.status ?? 'Pendiente',
        input.estimatedOn ?? null,
        input.completedOn ?? null,
        input.responsibleUserId ?? null,
        input.notes ?? null,
      ],
    );
    if (!result.rows[0]) throw new Error('La etapa no pudo ser creada.');
    return result.rows[0];
  }
}
