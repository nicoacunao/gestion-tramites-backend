import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import { AppError } from '../../../shared/errors/app-error';
import type { ManagementRepository } from '../application/ports';
import type { Management, ManagementBackground, ManagementStage } from '../domain/management';

const projection = `codigo AS id, id_estacion AS "stationId", id_tipo_gestion AS "managementTypeId",
  codigo_ambito AS "scopeCode", id_usuario_responsable::text AS "responsibleUserId",
  nivel AS level, correlativo AS sequence, fecha_apertura::text AS "openedOn",
  fecha_estimada_termino::text AS "estimatedCompletionOn", fecha_ultima_revision::text AS "lastReviewedOn",
  prioridad AS priority, nombre_solicitante AS "requesterName", estado AS status, xmin::text AS version`;
type ManagementRow = Omit<Management, 'version' | 'responsibleUserId'> & {
  version: string;
  responsibleUserId: string | null;
};

function fromRow(row: ManagementRow): Management {
  if (row.responsibleUserId === null)
    throw new AppError(
      'MANAGEMENT_RESPONSIBLE_REQUIRED',
      'Esta gestión no tiene el usuario responsable exigido por el contrato actual.',
      409,
    );
  return { ...row, responsibleUserId: row.responsibleUserId, version: Number(row.version) };
}

export class PostgresManagementRepository implements ManagementRepository {
  constructor(private readonly database: SqlExecutor) {}

  async list(): Promise<readonly Management[]> {
    const result = await this.database.query<ManagementRow>(
      `SELECT ${projection} FROM gestion ORDER BY id_gestion`,
      [],
    );
    return result.rows.map(fromRow);
  }

  async findById(id: string): Promise<Management | null> {
    const result = await this.database.query<ManagementRow>(
      `SELECT ${projection} FROM gestion WHERE codigo = $1`,
      [id],
    );
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }

  async save(input: Management, expectedVersion?: number): Promise<void> {
    const values = [
      input.id,
      input.stationId,
      input.managementTypeId,
      input.scopeCode,
      input.responsibleUserId,
      input.level,
      input.sequence,
      input.status,
      input.priority,
      input.requesterName,
      input.openedOn,
      input.estimatedCompletionOn,
      input.lastReviewedOn,
    ];
    const result =
      expectedVersion === undefined
        ? await this.database.query<ManagementRow>(
            `INSERT INTO gestion (codigo, id_estacion, id_tipo_gestion, codigo_ambito, id_usuario_responsable,
          nivel, correlativo, modalidad_creacion, estado, prioridad, responsable_nombre, nombre_solicitante,
          razon_social, rut_razon_social, representante_legal, rut_representante_legal,
          fecha_apertura, fecha_estimada_termino, fecha_ultima_revision)
        VALUES ($1, $2, $3, $4, $5::bigint, $6, $7, 'principal', $8, $9,
          (SELECT concat_ws(' ', nombres, primer_apellido, segundo_apellido) FROM usuario WHERE id_usuario = $5::bigint), $10,
          (SELECT razon_social FROM estacion WHERE id_estacion = $2),
          (SELECT rut_sociedad FROM estacion WHERE id_estacion = $2),
          (SELECT nombre_representante_legal FROM estacion WHERE id_estacion = $2),
          (SELECT rut_representante_legal FROM estacion WHERE id_estacion = $2),
          $11::date, $12::date, $13::date) RETURNING ${projection}`,
            values,
          )
        : await this.database.query<ManagementRow>(
            `UPDATE gestion SET id_estacion = $2, id_tipo_gestion = $3, codigo_ambito = $4,
          id_usuario_responsable = $5::bigint, nivel = $6, correlativo = $7, estado = $8, prioridad = $9,
          nombre_solicitante = $10, fecha_apertura = $11::date, fecha_estimada_termino = $12::date,
          fecha_ultima_revision = $13::date,
          responsable_nombre = CASE WHEN id_usuario_responsable IS DISTINCT FROM $5::bigint
            THEN (SELECT concat_ws(' ', nombres, primer_apellido, segundo_apellido) FROM usuario WHERE id_usuario = $5::bigint)
            ELSE responsable_nombre END,
          razon_social = CASE WHEN id_estacion <> $2 THEN (SELECT razon_social FROM estacion WHERE id_estacion = $2) ELSE razon_social END,
          rut_razon_social = CASE WHEN id_estacion <> $2 THEN (SELECT rut_sociedad FROM estacion WHERE id_estacion = $2) ELSE rut_razon_social END,
          representante_legal = CASE WHEN id_estacion <> $2 THEN (SELECT nombre_representante_legal FROM estacion WHERE id_estacion = $2) ELSE representante_legal END,
          rut_representante_legal = CASE WHEN id_estacion <> $2 THEN (SELECT rut_representante_legal FROM estacion WHERE id_estacion = $2) ELSE rut_representante_legal END
        WHERE codigo = $1 AND xmin = $14::text::xid
          AND (id_gestion_especifica IS NULL OR id_tipo_gestion = $3)
        RETURNING ${projection}`,
            [...values, expectedVersion],
          );
    if (!result.rows[0])
      throw new AppError(
        'VERSION_CONFLICT',
        'La gestión cambió o tiene una gestión específica incompatible. Recarga antes de guardar.',
        409,
      );
  }

  async listBackgrounds(managementId: string): Promise<readonly ManagementBackground[]> {
    const result = await this.database.query<
      Omit<ManagementBackground, 'version'> & { version: string }
    >(
      `SELECT a.id_antecedente_gestion::text AS id, g.codigo AS "managementId",
        a.id_antecedente_padre::text AS "parentManagementBackgroundId", g.id_tipo_gestion AS "managementTypeId",
        COALESCE(a.id_antecedente::text, '') AS "backgroundId", a.nivel AS level, a.flag_obligatorio AS required,
        COALESCE(a.id_usuario_responsable::text, '') AS "responsibleUserId", a.estado AS status,
        a.archivo_referencia AS "fileReference", a.fecha_carga AS "uploadedAt", a.xmin::text AS version
       FROM antecedente_gestion a JOIN gestion g ON g.id_gestion = a.id_gestion
       WHERE g.codigo = $1 ORDER BY a.id_antecedente_gestion`,
      [managementId],
    );
    return result.rows.map((row) => ({ ...row, version: Number(row.version) }));
  }

  async listStages(managementId: string): Promise<readonly ManagementStage[]> {
    const result = await this.database.query<
      Omit<ManagementStage, 'version'> & { version: string }
    >(
      `SELECT e.id_etapa_gestion::text AS id, g.codigo AS "managementId", e.id_etapa::text AS "stageId",
        e.estado AS status, e.fecha_estimada::text AS "estimatedOn", e.fecha_real::text AS "completedOn",
        e.responsable_nombre AS responsible, e.observaciones AS notes, e.xmin::text AS version
       FROM etapa_gestion e JOIN gestion g ON g.id_gestion = e.id_gestion JOIN etapa t ON t.id_etapa = e.id_etapa
       WHERE g.codigo = $1 ORDER BY t.orden`,
      [managementId],
    );
    return result.rows.map((row) => ({ ...row, version: Number(row.version) }));
  }

  async updateBackground(id: string, input: Omit<ManagementBackground, 'id' | 'version'>, expectedVersion: number): Promise<ManagementBackground> {
    const result = await this.database.query<ManagementBackground & { version: string }>(
      `UPDATE antecedente_gestion a SET id_usuario_responsable = NULLIF($2, '')::bigint,
         estado = $3, observaciones = $4
       FROM gestion g WHERE a.id_antecedente_gestion = $1::bigint AND g.id_gestion = a.id_gestion
         AND a.xmin = $5::text::xid
       RETURNING a.id_antecedente_gestion::text AS id, g.codigo AS "managementId",
         a.id_antecedente_padre::text AS "parentManagementBackgroundId", g.id_tipo_gestion AS "managementTypeId",
         COALESCE(a.id_antecedente::text, '') AS "backgroundId", a.nivel AS level, a.flag_obligatorio AS required,
         COALESCE(a.id_usuario_responsable::text, '') AS "responsibleUserId", a.estado AS status,
         a.archivo_referencia AS "fileReference", a.fecha_carga AS "uploadedAt", a.xmin::text AS version`,
      [id, input.responsibleUserId, input.status, input.fileReference, expectedVersion],
    );
    const row = result.rows[0];
    if (!row) throw new AppError('VERSION_CONFLICT', 'El antecedente cambió; recarga antes de guardar.', 409);
    return { ...row, version: Number(row.version) };
  }

  async updateStage(id: string, input: Omit<ManagementStage, 'id' | 'version'>, expectedVersion: number): Promise<ManagementStage> {
    const result = await this.database.query<ManagementStage & { version: string }>(
      `UPDATE etapa_gestion e SET estado = $2, fecha_estimada = $3::date, fecha_real = $4::date,
         id_usuario_responsable = NULLIF($5, '')::bigint, responsable_nombre = $6, observaciones = $7
       FROM gestion g WHERE e.id_etapa_gestion = $1::bigint AND g.id_gestion = e.id_gestion
         AND e.xmin = $8::text::xid
       RETURNING e.id_etapa_gestion::text AS id, g.codigo AS "managementId", e.id_etapa::text AS "stageId",
         e.estado AS status, e.fecha_estimada::text AS "estimatedOn", e.fecha_real::text AS "completedOn",
         e.responsable_nombre AS responsible, e.observaciones AS notes, e.xmin::text AS version`,
      [id, input.status, input.estimatedOn, input.completedOn, input.responsible, input.responsible, input.notes, expectedVersion],
    );
    const row = result.rows[0];
    if (!row) throw new AppError('VERSION_CONFLICT', 'La etapa cambió; recarga antes de guardar.', 409);
    return { ...row, version: Number(row.version) };
  }
}
