import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import { AppError } from '../../../shared/errors/app-error';
import type { ManagementRepository } from '../application/ports';
import type {
  Management,
  ManagementInput,
  ManagementStage,
  ManagementStageCreateInput,
  ManagementStageUpdateInput,
  ManagementSpecific,
  ManagementSpecificCreateInput,
  ManagementSpecificUpdateInput,
} from '../domain/management';

const managementCtes = `WITH RECURSIVE type_chain AS (
    SELECT t.id_tipo_gestion AS source_type_id, t.id_tipo_gestion, t.id_gestion_padre,
           t.id_ambito_gestion, t.nivel, ARRAY[t.id_tipo_gestion] AS path
    FROM tipo_gestion t
    UNION ALL
    SELECT chain.source_type_id, parent.id_tipo_gestion, parent.id_gestion_padre,
           parent.id_ambito_gestion, parent.nivel, chain.path || parent.id_tipo_gestion
    FROM type_chain chain
    JOIN tipo_gestion parent ON parent.id_tipo_gestion = chain.id_gestion_padre
    WHERE NOT parent.id_tipo_gestion = ANY(chain.path)
  ), scope_by_management AS (
    SELECT ge.id_gestion,
           string_agg(DISTINCT tg.nombre, ', ' ORDER BY tg.nombre) AS management_type_name,
           'N' || min(tg.nivel)::text AS level,
           CASE WHEN count(DISTINCT a.codigo) = 1 THEN min(a.codigo) END AS scope_code,
           CASE WHEN count(DISTINCT a.nombre) = 1 THEN min(a.nombre) END AS scope_name
    FROM gestion_especifica ge
    JOIN tipo_gestion tg ON tg.id_tipo_gestion = ge.id_tipo_gestion
    JOIN type_chain chain ON chain.source_type_id = tg.id_tipo_gestion AND chain.nivel = 1
    JOIN ambito_gestion a ON a.id_ambito_gestion = chain.id_ambito_gestion
    GROUP BY ge.id_gestion
  ), numbered_gestiones AS (
    SELECT g.*, scope.management_type_name, scope.level, scope.scope_code, scope.scope_name,
           CASE WHEN scope.scope_code IS NOT NULL
             THEN row_number() OVER (PARTITION BY scope.scope_code ORDER BY g.fecha_apertura, g.id_gestion)
           END AS sequence
    FROM gestion g
    LEFT JOIN scope_by_management scope ON scope.id_gestion = g.id_gestion
    WHERE g.flag_eliminado = FALSE
  )`;

const projection = `g.id_gestion::text AS id, g.id_estacion::text AS "stationId",
  g.id_usuario_responsable::text AS "responsibleUserId", g.fecha_creacion::text AS "createdAt",
  g.fecha_apertura::text AS "openedOn", g.fecha_estimada_termino::text AS "estimatedCompletionOn",
  g.fecha_ultima_revision::text AS "lastReviewedOn", g.prioridad AS priority, g.estado AS status,
  g.nombre_solicitante AS "requesterName", e.razon_social AS "stationName", e.razon_social AS "legalName",
  e.comuna, e.direccion AS address, e.rut_sociedad AS "legalRut",
  e.nombre_representante_legal AS "legalRepresentative", e.rut_representante_legal AS "legalRepresentativeRut",
  concat_ws(' ', u.nombres, u.primer_apellido, u.segundo_apellido) AS "responsibleName",
  g.management_type_name AS "managementTypeName", g.level, g.scope_code AS "scopeCode",
  g.scope_name AS "scopeName", g.sequence,
  CASE WHEN g.sequence IS NULL OR g.level IS NULL THEN NULL
       ELSE g.level || '-' || g.scope_code || '-' || lpad(g.sequence::text, 3, '0')
  END AS code,
  CASE
    WHEN g.estado IN ('Terminado aprobado', 'Terminado desfavorable') THEN 'al-dia'
    WHEN g.fecha_estimada_termino IS NULL THEN 'al-dia'
    WHEN g.fecha_estimada_termino < (now() AT TIME ZONE 'America/Santiago')::date THEN 'atrasado'
    WHEN g.fecha_estimada_termino <= (now() AT TIME ZONE 'America/Santiago')::date + 7 THEN 'proximo-vencer'
    ELSE 'al-dia'
  END AS "trafficLight",
  CASE
    WHEN g.estado IN ('Terminado aprobado', 'Terminado desfavorable') THEN 'Al día'
    WHEN g.fecha_estimada_termino IS NULL THEN 'Al día'
    WHEN g.fecha_estimada_termino < (now() AT TIME ZONE 'America/Santiago')::date THEN 'Atrasado'
    WHEN g.fecha_estimada_termino <= (now() AT TIME ZONE 'America/Santiago')::date + 7 THEN 'Próximo a vencer'
    ELSE 'Al día'
  END AS "trafficLightLabel"`;

export class PostgresManagementRepository implements ManagementRepository {
  constructor(private readonly database: SqlExecutor) {}

  async list(responsibleUserId?: string): Promise<readonly Management[]> {
    const where =
      responsibleUserId === undefined
        ? ' WHERE g.flag_eliminado = FALSE'
        : ' WHERE g.flag_eliminado = FALSE AND g.id_usuario_responsable = $1::bigint';
    const result = await this.database.query<Management>(
      `${managementCtes} SELECT ${projection} FROM numbered_gestiones g
       JOIN estacion e ON e.id_estacion = g.id_estacion
       JOIN usuario u ON u.id_usuario = g.id_usuario_responsable${where}
       ORDER BY g.fecha_apertura, g.id_gestion`,
      responsibleUserId === undefined ? [] : [responsibleUserId],
    );
    return result.rows;
  }

  async findById(id: string): Promise<Management | null> {
    const result = await this.database.query<Management>(
      `${managementCtes} SELECT ${projection} FROM numbered_gestiones g
       JOIN estacion e ON e.id_estacion = g.id_estacion
       JOIN usuario u ON u.id_usuario = g.id_usuario_responsable
       WHERE g.id_gestion = $1::bigint AND g.flag_eliminado = FALSE`,
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
    if (!result.rows[0]) {
      if (input.id)
        throw new AppError('RESOURCE_NOT_FOUND', 'La gestión solicitada no existe.', 404);
      throw new AppError('MANAGEMENT_SAVE_FAILED', 'La gestión no pudo ser guardada.', 500);
    }
    return result.rows[0];
  }

  async listSpecifics(managementId: string): Promise<readonly ManagementSpecific[]> {
    const result = await this.database.query<ManagementSpecific>(
      `SELECT ge.id_gestion_especifica::text AS id, ge.id_gestion::text AS "managementId",
         parent.id_gestion_especifica::text AS "parentSpecificManagementId",
         ge.id_tipo_gestion::text AS "managementTypeId", tg.nombre AS "managementTypeName",
         tg.nivel AS level, tg.flag_requerida AS required,
         ge.responsable::text AS "responsibleUserId",
         concat_ws(' ', u.nombres, u.primer_apellido, u.segundo_apellido) AS "responsibleName",
         ge.estado AS status, ge.url_archivo AS "fileUrl", ge.fecha_carga::text AS "uploadedAt"
       FROM gestion_especifica ge
       JOIN tipo_gestion tg ON tg.id_tipo_gestion = ge.id_tipo_gestion
       JOIN usuario u ON u.id_usuario = ge.responsable
       JOIN gestion g ON g.id_gestion = ge.id_gestion AND g.flag_eliminado = FALSE
       LEFT JOIN LATERAL (
         SELECT parent_ge.id_gestion_especifica
         FROM gestion_especifica parent_ge
         JOIN tipo_gestion parent_type ON parent_type.id_tipo_gestion = parent_ge.id_tipo_gestion
         WHERE parent_ge.id_gestion = ge.id_gestion AND parent_type.id_tipo_gestion = tg.id_gestion_padre
         ORDER BY parent_ge.id_gestion_especifica LIMIT 1
       ) parent ON TRUE
       WHERE ge.id_gestion = $1::bigint
       ORDER BY tg.nivel, tg.nombre, ge.id_gestion_especifica`,
      [managementId],
    );
    return result.rows;
  }

  async createSpecific(
    managementId: string,
    input: ManagementSpecificCreateInput,
  ): Promise<ManagementSpecific> {
    const typeResult = await this.database.query<{ level: number }>(
      'SELECT nivel AS level FROM tipo_gestion WHERE id_tipo_gestion = $1::bigint',
      [input.managementTypeId],
    );
    if (!typeResult.rows[0])
      throw new AppError('RESOURCE_NOT_FOUND', 'El tipo de gestión específica no existe.', 404);
    const status = input.status ?? 'Pendiente';
    if (
      typeResult.rows[0].level > 1 &&
      ['Recibido', 'Recibido conforme'].includes(status) &&
      !input.fileReference
    )
      throw new AppError(
        'SPECIFIC_MANAGEMENT_FILE_REQUIRED',
        'Para marcar este antecedente como recibido debes asociar un archivo.',
        422,
      );
    const result = await this.database.query<ManagementSpecific>(
      `INSERT INTO gestion_especifica
         (id_gestion, id_tipo_gestion, responsable, estado, url_archivo)
       SELECT g.id_gestion, tg.id_tipo_gestion,
              COALESCE(NULLIF($3, '')::bigint, g.id_usuario_responsable), $4, $5
       FROM gestion g CROSS JOIN tipo_gestion tg
       WHERE g.id_gestion = $1::bigint AND g.flag_eliminado = FALSE
         AND tg.id_tipo_gestion = $2::bigint
       RETURNING id_gestion_especifica::text AS id, id_gestion::text AS "managementId",
         (SELECT parent.id_gestion_especifica::text FROM gestion_especifica parent
           JOIN tipo_gestion parent_type ON parent_type.id_tipo_gestion = parent.id_tipo_gestion
           WHERE parent.id_gestion = gestion_especifica.id_gestion
             AND parent_type.id_tipo_gestion = (SELECT id_gestion_padre FROM tipo_gestion WHERE id_tipo_gestion = gestion_especifica.id_tipo_gestion)
           ORDER BY parent.id_gestion_especifica LIMIT 1) AS "parentSpecificManagementId",
         id_tipo_gestion::text AS "managementTypeId",
         (SELECT nombre FROM tipo_gestion WHERE id_tipo_gestion = gestion_especifica.id_tipo_gestion) AS "managementTypeName",
         (SELECT nivel FROM tipo_gestion WHERE id_tipo_gestion = gestion_especifica.id_tipo_gestion) AS level,
         (SELECT flag_requerida FROM tipo_gestion WHERE id_tipo_gestion = gestion_especifica.id_tipo_gestion) AS required,
         responsable::text AS "responsibleUserId",
         (SELECT concat_ws(' ', nombres, primer_apellido, segundo_apellido) FROM usuario WHERE id_usuario = gestion_especifica.responsable) AS "responsibleName",
         estado AS status, url_archivo AS "fileUrl", fecha_carga::text AS "uploadedAt"`,
      [
        managementId,
        input.managementTypeId,
        input.responsibleUserId ?? null,
        input.status ?? 'Pendiente',
        input.fileReference ?? null,
      ],
    );
    if (!result.rows[0])
      throw new AppError(
        'SPECIFIC_MANAGEMENT_REFERENCE_NOT_FOUND',
        'La gestión, el tipo o el responsable indicado no existe.',
        404,
      );
    return result.rows[0];
  }

  async findSpecific(id: string): Promise<ManagementSpecific | null> {
    const result = await this.database.query<ManagementSpecific>(
      `SELECT ge.id_gestion_especifica::text AS id, ge.id_gestion::text AS "managementId",
         (SELECT parent.id_gestion_especifica::text FROM gestion_especifica parent
           JOIN tipo_gestion parent_type ON parent_type.id_tipo_gestion = parent.id_tipo_gestion
           WHERE parent.id_gestion = ge.id_gestion AND parent_type.id_tipo_gestion = tg.id_gestion_padre
           ORDER BY parent.id_gestion_especifica LIMIT 1) AS "parentSpecificManagementId",
         ge.id_tipo_gestion::text AS "managementTypeId", tg.nombre AS "managementTypeName",
         tg.nivel AS level, tg.flag_requerida AS required,
         ge.responsable::text AS "responsibleUserId",
         concat_ws(' ', u.nombres, u.primer_apellido, u.segundo_apellido) AS "responsibleName",
         ge.estado AS status, ge.url_archivo AS "fileUrl", ge.fecha_carga::text AS "uploadedAt"
       FROM gestion_especifica ge
       JOIN tipo_gestion tg ON tg.id_tipo_gestion = ge.id_tipo_gestion
       JOIN usuario u ON u.id_usuario = ge.responsable
       JOIN gestion g ON g.id_gestion = ge.id_gestion AND g.flag_eliminado = FALSE
       WHERE ge.id_gestion_especifica = $1::bigint`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async updateSpecific(
    id: string,
    input: ManagementSpecificUpdateInput,
  ): Promise<ManagementSpecific> {
    const result = await this.database.query<ManagementSpecific>(
      `UPDATE gestion_especifica SET
         responsable = COALESCE(NULLIF($2, '')::bigint, responsable), estado = $3,
         fecha_carga = CASE WHEN url_archivo IS DISTINCT FROM $4 THEN now() ELSE fecha_carga END,
         url_archivo = $4
       WHERE id_gestion_especifica = $1::bigint
         AND EXISTS (SELECT 1 FROM gestion g WHERE g.id_gestion = gestion_especifica.id_gestion AND g.flag_eliminado = FALSE)
       RETURNING id_gestion_especifica::text AS id, id_gestion::text AS "managementId",
         (SELECT parent.id_gestion_especifica::text FROM gestion_especifica parent
           JOIN tipo_gestion parent_type ON parent_type.id_tipo_gestion = parent.id_tipo_gestion
           WHERE parent.id_gestion = gestion_especifica.id_gestion
             AND parent_type.id_tipo_gestion = (SELECT id_gestion_padre FROM tipo_gestion WHERE id_tipo_gestion = gestion_especifica.id_tipo_gestion)
           ORDER BY parent.id_gestion_especifica LIMIT 1) AS "parentSpecificManagementId",
         id_tipo_gestion::text AS "managementTypeId",
         (SELECT nombre FROM tipo_gestion WHERE id_tipo_gestion = gestion_especifica.id_tipo_gestion) AS "managementTypeName",
         (SELECT nivel FROM tipo_gestion WHERE id_tipo_gestion = gestion_especifica.id_tipo_gestion) AS level,
         (SELECT flag_requerida FROM tipo_gestion WHERE id_tipo_gestion = gestion_especifica.id_tipo_gestion) AS required,
         responsable::text AS "responsibleUserId",
         (SELECT concat_ws(' ', nombres, primer_apellido, segundo_apellido) FROM usuario WHERE id_usuario = gestion_especifica.responsable) AS "responsibleName",
         estado AS status, url_archivo AS "fileUrl", fecha_carga::text AS "uploadedAt"`,
      [id, input.responsibleUserId, input.status, input.fileReference],
    );
    if (!result.rows[0])
      throw new AppError('RESOURCE_NOT_FOUND', 'El antecedente de la gestión no existe.', 404);
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
       WHERE eg.id_etapa_gestion = $1::bigint
         AND EXISTS (SELECT 1 FROM gestion g WHERE g.id_gestion = eg.id_gestion AND g.flag_eliminado = FALSE)`,
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
         responsable::text AS "responsibleUserId",
         (SELECT concat_ws(' ', nombres, primer_apellido, segundo_apellido) FROM usuario WHERE id_usuario = etapa_gestion.responsable) AS responsible,
         observaciones AS notes`,
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
    if (!result.rows[0])
      throw new AppError('STAGE_SAVE_FAILED', 'La etapa no pudo ser creada.', 500);
    return result.rows[0];
  }

  async updateStage(id: string, input: ManagementStageUpdateInput): Promise<ManagementStage> {
    const result = await this.database.query<ManagementStage>(
      `UPDATE etapa_gestion SET estado = $2, fecha_estimada = $3::date,
         fecha_real = $4::date, responsable = NULLIF($5, '')::bigint, observaciones = $6
       WHERE id_etapa_gestion = $1::bigint
         AND EXISTS (SELECT 1 FROM gestion g WHERE g.id_gestion = etapa_gestion.id_gestion AND g.flag_eliminado = FALSE)
       RETURNING id_etapa_gestion::text AS id, id_gestion::text AS "managementId",
         id_etapa::text AS "stageId", (SELECT nombre FROM etapa WHERE id_etapa = etapa_gestion.id_etapa) AS "stageName",
         (SELECT porcentaje FROM etapa WHERE id_etapa = etapa_gestion.id_etapa) AS percentage,
         estado AS status, fecha_estimada::text AS "estimatedOn", fecha_real::text AS "completedOn",
         responsable::text AS "responsibleUserId",
         (SELECT concat_ws(' ', nombres, primer_apellido, segundo_apellido) FROM usuario WHERE id_usuario = etapa_gestion.responsable) AS responsible,
         observaciones AS notes`,
      [
        id,
        input.status,
        input.estimatedOn,
        input.completedOn,
        input.responsibleUserId,
        input.notes,
      ],
    );
    if (!result.rows[0])
      throw new AppError('RESOURCE_NOT_FOUND', 'La etapa de la gestión no existe.', 404);
    return result.rows[0];
  }
}
