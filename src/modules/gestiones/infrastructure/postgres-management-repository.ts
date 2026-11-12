import type { Pool, PoolClient } from 'pg';
import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import { AppError } from '../../../shared/errors/app-error';
import type { ManagementRepository } from '../application/ports';
import type {
  CompleteManagementInput,
  Management,
  ManagementAdditionalDataCreateInput,
  ManagementBackground,
  ManagementBackgroundCreateInput,
  ManagementStage,
  ManagementStageCreateInput,
} from '../domain/management';

const projection = `codigo AS id, id_estacion AS "stationId", id_tipo_gestion AS "managementTypeId",
  codigo_ambito AS "scopeCode", id_usuario_responsable::text AS "responsibleUserId",
  nivel AS level, correlativo AS sequence, fecha_apertura::text AS "openedOn",
  fecha_estimada_termino::text AS "estimatedCompletionOn", fecha_ultima_revision::text AS "lastReviewedOn",
  prioridad AS priority, nombre_solicitante AS "requesterName", estado AS status, xmin::text AS version,
  modalidad_creacion AS "creationMode", id_gestion_especifica::text AS "specificManagementId",
  id_estacion AS "stationName", razon_social AS "legalName", responsable_nombre AS "responsibleName",
  (SELECT t.nombre FROM tipo_gestion t WHERE t.id_tipo_gestion = gestion.id_tipo_gestion) AS "managementTypeName",
  (SELECT ge.codigo FROM gestion_especifica ge WHERE ge.id_gestion_especifica = gestion.id_gestion_especifica) AS "managementTypeCode",
  (SELECT e.comuna FROM estacion e WHERE e.id_estacion = gestion.id_estacion) AS commune,
  (SELECT e.direccion FROM estacion e WHERE e.id_estacion = gestion.id_estacion) AS address,
  (SELECT e.rut_sociedad FROM estacion e WHERE e.id_estacion = gestion.id_estacion) AS "legalRut",
  (SELECT e.nombre_representante_legal FROM estacion e WHERE e.id_estacion = gestion.id_estacion) AS "legalRepresentative"`;
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

  private get pool(): Pool {
    return this.database as Pool;
  }

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

  async updateBackground(
    id: string,
    input: Omit<ManagementBackground, 'id' | 'version'>,
    expectedVersion: number,
  ): Promise<ManagementBackground> {
    const result = await this.database.query<ManagementBackground & { version: string }>(
      `UPDATE antecedente_gestion a SET id_usuario_responsable = NULLIF($2, '')::bigint,
         estado = $3, archivo_referencia = $4
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
    if (!row)
      throw new AppError(
        'VERSION_CONFLICT',
        'El antecedente cambió; recarga antes de guardar.',
        409,
      );
    return { ...row, version: Number(row.version) };
  }

  async updateStage(
    id: string,
    input: Omit<ManagementStage, 'id' | 'version'>,
    expectedVersion: number,
  ): Promise<ManagementStage> {
    const result = await this.database.query<ManagementStage & { version: string }>(
      `UPDATE etapa_gestion e SET estado = $2, fecha_estimada = $3::date, fecha_real = $4::date,
         id_usuario_responsable = NULLIF($5, '')::bigint,
         responsable_nombre = CASE WHEN NULLIF($5, '') IS NULL THEN NULL
           ELSE (SELECT concat_ws(' ', nombres, primer_apellido, segundo_apellido)
                 FROM usuario WHERE id_usuario = NULLIF($5, '')::bigint) END,
         observaciones = $6
       FROM gestion g WHERE e.id_etapa_gestion = $1::bigint AND g.id_gestion = e.id_gestion
         AND e.xmin = $7::text::xid
       RETURNING e.id_etapa_gestion::text AS id, g.codigo AS "managementId", e.id_etapa::text AS "stageId",
         e.estado AS status, e.fecha_estimada::text AS "estimatedOn", e.fecha_real::text AS "completedOn",
         e.responsable_nombre AS responsible, e.observaciones AS notes, e.xmin::text AS version`,
      [
        id,
        input.status,
        input.estimatedOn,
        input.completedOn,
        input.responsible,
        input.notes,
        expectedVersion,
      ],
    );
    const row = result.rows[0];
    if (!row)
      throw new AppError('VERSION_CONFLICT', 'La etapa cambió; recarga antes de guardar.', 409);
    return { ...row, version: Number(row.version) };
  }

  async createComplete(input: CompleteManagementInput): Promise<Management> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const management = await this.insertManagement(client, input);
      const parentIds = new Map<string, string>();
      for (const background of [
        ...(input.requiredBackgrounds ?? []),
        ...(input.complementaryBackgrounds ?? []),
      ]) {
        const created = await this.insertBackground(client, management.id, background, parentIds);
        parentIds.set(background.backgroundId ?? background.name, created.id);
        parentIds.set(background.name, created.id);
      }
      for (const stage of input.stages ?? []) await this.insertStage(client, management.id, stage);
      for (const data of input.additionalData ?? [])
        await this.insertAdditionalData(client, management.id, data);
      for (const specificId of input.associatedSpecificManagementIds ?? [])
        await client.query(
          `INSERT INTO gestion_subtramite (id_gestion, id_gestion_especifica)
           VALUES ((SELECT id_gestion FROM gestion WHERE codigo = $1),
             (SELECT id_gestion_especifica FROM gestion_especifica
               WHERE id_gestion_especifica::text = $2 OR nombre = $2))`,
          [management.id, specificId],
        );
      await client.query('COMMIT');
      return management;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createBackground(
    managementId: string,
    input: ManagementBackgroundCreateInput,
  ): Promise<ManagementBackground> {
    return this.inTransaction(async (client) =>
      this.insertBackground(client, managementId, input, new Map()),
    );
  }

  async createStage(
    managementId: string,
    input: ManagementStageCreateInput,
  ): Promise<ManagementStage> {
    return this.inTransaction(async (client) => this.insertStage(client, managementId, input));
  }

  async createAdditionalData(
    managementId: string,
    input: ManagementAdditionalDataCreateInput,
  ): Promise<void> {
    await this.inTransaction(async (client) =>
      this.insertAdditionalData(client, managementId, input),
    );
  }

  private async inTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertManagement(
    client: PoolClient,
    input: CompleteManagementInput,
  ): Promise<Management> {
    const sequenceResult = await client.query<{ next_sequence: string }>(
      `SELECT (COALESCE(MAX(correlativo), 0) + 1)::text AS next_sequence
       FROM gestion WHERE nivel = $1 AND codigo_ambito = $2`,
      [input.level, input.scopeCode],
    );
    const sequence = input.sequence ?? Number(sequenceResult.rows[0]?.next_sequence ?? '1');
    const code =
      input.id || `${input.level}-${input.scopeCode}-${String(sequence).padStart(3, '0')}`;
    const result = await client.query<ManagementRow>(
      `INSERT INTO gestion (codigo, id_estacion, id_tipo_gestion, id_gestion_especifica, codigo_ambito,
        id_usuario_responsable, nivel, correlativo, modalidad_creacion, estado, prioridad,
        responsable_nombre, nombre_solicitante, razon_social, rut_razon_social, representante_legal,
        rut_representante_legal, fecha_apertura, fecha_estimada_termino, fecha_ultima_revision)
       VALUES ($1, $2, $3,
        (SELECT id_gestion_especifica FROM gestion_especifica
          WHERE id_gestion_especifica::text = NULLIF($4, '') OR nombre = NULLIF($4, '')),
        $5, $6::bigint, $7, $8, $9, $10, $11,
        (SELECT concat_ws(' ', nombres, primer_apellido, segundo_apellido) FROM usuario WHERE id_usuario = $6::bigint),
        $12, (SELECT razon_social FROM estacion WHERE id_estacion = $2),
        (SELECT rut_sociedad FROM estacion WHERE id_estacion = $2),
        (SELECT nombre_representante_legal FROM estacion WHERE id_estacion = $2),
        (SELECT rut_representante_legal FROM estacion WHERE id_estacion = $2), $13::date, $14::date, $15::date)
       RETURNING ${projection}`,
      [
        code,
        input.stationId,
        input.managementTypeId,
        input.specificManagementId ?? '',
        input.scopeCode,
        input.responsibleUserId,
        input.level,
        sequence,
        input.creationMode,
        input.status,
        input.priority,
        input.requesterName,
        input.openedOn,
        input.estimatedCompletionOn,
        input.lastReviewedOn,
      ],
    );
    if (!result.rows[0]) throw new Error('La gestión no pudo ser creada.');
    return fromRow(result.rows[0]);
  }

  private async insertBackground(
    client: PoolClient,
    managementId: string,
    input: ManagementBackgroundCreateInput,
    parentIds: Map<string, string>,
  ): Promise<ManagementBackground> {
    const parentId = input.parentBackgroundId
      ? (parentIds.get(input.parentBackgroundId) ?? null)
      : null;
    const result = await client.query<ManagementBackground & { version: string }>(
      `INSERT INTO antecedente_gestion (id_gestion, id_antecedente_padre, id_antecedente, nivel, categoria,
        nombre_mostrado, flag_obligatorio, solicitado_por, id_usuario_responsable, responsable_nombre,
        estado, observaciones, archivo_nombre, archivo_referencia, fecha_carga)
       VALUES ((SELECT id_gestion FROM gestion WHERE codigo = $1), $2::bigint,
        (SELECT id_antecedente FROM antecedente WHERE id_antecedente::text = NULLIF($3, '') OR nombre = $4),
        'N2', $5, $4, $6, $7, NULLIF($8, '')::bigint,
        COALESCE(NULLIF($9, ''), (SELECT concat_ws(' ', nombres, primer_apellido, segundo_apellido)
          FROM usuario WHERE id_usuario = NULLIF($8, '')::bigint), ''), $10, $11, $12, $13,
        CASE WHEN $13::text IS NULL THEN NULL ELSE now() END)
       RETURNING id_antecedente_gestion::text AS id, $1::text AS "managementId",
        id_antecedente_padre::text AS "parentManagementBackgroundId",
        (SELECT id_tipo_gestion FROM gestion WHERE codigo = $1) AS "managementTypeId",
        COALESCE(id_antecedente::text, '') AS "backgroundId", nivel AS level,
        flag_obligatorio AS required, COALESCE(id_usuario_responsable::text, '') AS "responsibleUserId",
        estado AS status, archivo_referencia AS "fileReference", fecha_carga AS "uploadedAt", xmin::text AS version`,
      [
        managementId,
        parentId,
        input.backgroundId ?? '',
        input.name,
        input.category,
        input.required,
        input.requestedBy ?? null,
        input.responsibleUserId ?? '',
        input.responsibleName ?? '',
        input.status ?? 'Pendiente',
        input.observations ?? null,
        input.fileName ?? null,
        input.fileReference ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('El antecedente no pudo ser creado.');
    return { ...row, version: Number(row.version) };
  }

  private async insertStage(
    client: PoolClient,
    managementId: string,
    input: ManagementStageCreateInput,
  ): Promise<ManagementStage> {
    const result = await client.query<ManagementStage & { version: string }>(
      `INSERT INTO etapa_gestion (id_gestion, id_etapa, estado, fecha_estimada, fecha_real,
        id_usuario_responsable, responsable_nombre, observaciones)
       VALUES ((SELECT id_gestion FROM gestion WHERE codigo = $1),
        (SELECT id_etapa FROM etapa WHERE id_etapa::text = NULLIF($2, '') OR nombre = $3),
        $4, $5::date, $6::date, NULLIF($7, '')::bigint, $8, $9)
       RETURNING id_etapa_gestion::text AS id, $1::text AS "managementId", id_etapa::text AS "stageId",
        estado AS status, fecha_estimada::text AS "estimatedOn", fecha_real::text AS "completedOn",
        responsable_nombre AS responsible, observaciones AS notes, xmin::text AS version`,
      [
        managementId,
        input.stageId ?? '',
        input.name,
        input.status ?? 'Pendiente',
        input.estimatedOn ?? null,
        input.completedOn ?? null,
        input.responsibleUserId ?? '',
        input.responsibleName ?? null,
        input.notes ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('La etapa no pudo ser creada.');
    return { ...row, version: Number(row.version) };
  }

  private async insertAdditionalData(
    client: PoolClient,
    managementId: string,
    input: ManagementAdditionalDataCreateInput,
  ): Promise<void> {
    await client.query(
      `INSERT INTO gestion_dato_adicional (id_gestion, id_campo_adicional, valor)
       VALUES ((SELECT id_gestion FROM gestion WHERE codigo = $1),
        (SELECT id_campo_adicional FROM campo_adicional_tipo
          WHERE id_campo_adicional::text = NULLIF($2, '') OR codigo = $3), $4)`,
      [managementId, input.fieldId ?? '', input.fieldCode ?? '', input.value],
    );
  }
}
