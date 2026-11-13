import type { Pool, PoolClient } from 'pg';
import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import { AppError } from '../../../shared/errors/app-error';
import type { ManagementRepository } from '../application/ports';
import type {
  CompleteManagementInput,
  Management,
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
  id_estacion AS "stationName",
  (SELECT e.razon_social FROM estacion e WHERE e.id_estacion = gestion.id_estacion) AS "legalName",
  (SELECT concat_ws(' ', u.nombres, u.primer_apellido, u.segundo_apellido)
     FROM usuario u WHERE u.id_usuario = gestion.id_usuario_responsable) AS "responsibleName",
  (SELECT t.nombre FROM tipo_gestion t WHERE t.id_tipo_gestion = gestion.id_tipo_gestion) AS "managementTypeName",
  (SELECT ge.codigo FROM gestion_especifica ge WHERE ge.id_gestion_especifica = gestion.id_gestion_especifica) AS "managementTypeCode",
  (SELECT a.nombre FROM ambito_gestion a WHERE a.codigo_ambito = gestion.codigo_ambito) AS "scopeName",
  (SELECT e.comuna FROM estacion e WHERE e.id_estacion = gestion.id_estacion) AS commune,
  (SELECT e.direccion FROM estacion e WHERE e.id_estacion = gestion.id_estacion) AS address,
  (SELECT e.rut_sociedad FROM estacion e WHERE e.id_estacion = gestion.id_estacion) AS "legalRut",
  (SELECT e.nombre_representante_legal FROM estacion e WHERE e.id_estacion = gestion.id_estacion) AS "legalRepresentative",
  (SELECT e.rut_representante_legal FROM estacion e WHERE e.id_estacion = gestion.id_estacion) AS "legalRepresentativeRut"`;
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

  async list(responsibleUserId?: string): Promise<readonly Management[]> {
    const filter =
      responsibleUserId === undefined ? '' : ' WHERE id_usuario_responsable = $1::bigint';
    const result = await this.database.query<ManagementRow>(
      `SELECT ${projection} FROM gestion${filter} ORDER BY id_gestion`,
      responsibleUserId === undefined ? [] : [responsibleUserId],
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
          nivel, correlativo, modalidad_creacion, estado, prioridad, nombre_solicitante,
          fecha_apertura, fecha_estimada_termino, fecha_ultima_revision)
        VALUES ($1, $2, $3, $4, $5::bigint, $6, $7, 'principal', $8, $9,
          $10,
          $11::date, $12::date, $13::date) RETURNING ${projection}`,
            values,
          )
        : await this.database.query<ManagementRow>(
            `UPDATE gestion SET id_estacion = $2::varchar, id_tipo_gestion = $3::varchar, codigo_ambito = $4::varchar,
          id_usuario_responsable = $5::bigint, nivel = $6, correlativo = $7, estado = $8, prioridad = $9,
          nombre_solicitante = $10, fecha_apertura = $11::date, fecha_estimada_termino = $12::date,
          fecha_ultima_revision = $13::date
        WHERE codigo = $1::varchar AND xmin = $14::text::xid
          AND (id_gestion_especifica IS NULL OR id_tipo_gestion = $3::varchar)
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
        a.id_usuario_responsable::text AS "responsibleUserId", a.estado AS status,
        (SELECT f.referencia_almacenamiento FROM archivo_gestion f
          WHERE f.id_antecedente_gestion = a.id_antecedente_gestion
          ORDER BY f.fecha_carga DESC LIMIT 1) AS "fileReference",
        (SELECT f.fecha_carga::text FROM archivo_gestion f
          WHERE f.id_antecedente_gestion = a.id_antecedente_gestion
          ORDER BY f.fecha_carga DESC LIMIT 1) AS "uploadedAt", a.xmin::text AS version
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
        t.nombre AS "stageName", t.porcentaje AS percentage,
        e.estado AS status, e.fecha_estimada::text AS "estimatedOn", e.fecha_real::text AS "completedOn",
        (SELECT concat_ws(' ', u.nombres, u.primer_apellido, u.segundo_apellido)
           FROM usuario u WHERE u.id_usuario = e.id_usuario_responsable) AS responsible,
        e.observaciones AS notes, e.xmin::text AS version
       FROM etapa_gestion e JOIN gestion g ON g.id_gestion = e.id_gestion JOIN etapa t ON t.id_etapa = e.id_etapa
       WHERE g.codigo = $1 ORDER BY t.orden`,
      [managementId],
    );
    return result.rows.map((row) => ({ ...row, version: Number(row.version) }));
  }

  async findBackground(id: string): Promise<ManagementBackground | null> {
    const rows = await this.database.query<
      Omit<ManagementBackground, 'version'> & { version: string }
    >(
      `SELECT a.id_antecedente_gestion::text AS id, g.codigo AS "managementId",
        a.id_antecedente_padre::text AS "parentManagementBackgroundId", g.id_tipo_gestion AS "managementTypeId",
        COALESCE(a.id_antecedente::text, '') AS "backgroundId", a.nivel AS level, a.flag_obligatorio AS required,
        a.id_usuario_responsable::text AS "responsibleUserId", a.estado AS status,
        (SELECT f.referencia_almacenamiento FROM archivo_gestion f
          WHERE f.id_antecedente_gestion = a.id_antecedente_gestion
          ORDER BY f.fecha_carga DESC LIMIT 1) AS "fileReference",
        (SELECT f.fecha_carga::text FROM archivo_gestion f
          WHERE f.id_antecedente_gestion = a.id_antecedente_gestion
          ORDER BY f.fecha_carga DESC LIMIT 1) AS "uploadedAt", a.xmin::text AS version
       FROM antecedente_gestion a JOIN gestion g ON g.id_gestion = a.id_gestion
       WHERE a.id_antecedente_gestion = $1::bigint`,
      [id],
    );
    const row = rows.rows[0];
    return row ? { ...row, version: Number(row.version) } : null;
  }

  async findStage(id: string): Promise<ManagementStage | null> {
    const rows = await this.database.query<Omit<ManagementStage, 'version'> & { version: string }>(
      `SELECT e.id_etapa_gestion::text AS id, g.codigo AS "managementId", e.id_etapa::text AS "stageId",
        t.nombre AS "stageName", t.porcentaje AS percentage, e.estado AS status,
        e.fecha_estimada::text AS "estimatedOn", e.fecha_real::text AS "completedOn",
        (SELECT concat_ws(' ', u.nombres, u.primer_apellido, u.segundo_apellido)
           FROM usuario u WHERE u.id_usuario = e.id_usuario_responsable) AS responsible,
        e.observaciones AS notes, e.xmin::text AS version
       FROM etapa_gestion e JOIN gestion g ON g.id_gestion = e.id_gestion JOIN etapa t ON t.id_etapa = e.id_etapa
       WHERE e.id_etapa_gestion = $1::bigint`,
      [id],
    );
    const row = rows.rows[0];
    return row ? { ...row, version: Number(row.version) } : null;
  }

  async updateBackground(
    id: string,
    input: Omit<ManagementBackground, 'id' | 'version'>,
    expectedVersion: number,
  ): Promise<ManagementBackground> {
    const result = await this.database.query<ManagementBackground & { version: string }>(
      `UPDATE antecedente_gestion a SET id_usuario_responsable = NULLIF($2, '')::bigint,
         estado = $3
       FROM gestion g WHERE a.id_antecedente_gestion = $1::bigint AND g.id_gestion = a.id_gestion
         AND a.xmin = $4::text::xid
       RETURNING a.id_antecedente_gestion::text AS id, g.codigo AS "managementId",
         a.id_antecedente_padre::text AS "parentManagementBackgroundId", g.id_tipo_gestion AS "managementTypeId",
         COALESCE(a.id_antecedente::text, '') AS "backgroundId", a.nivel AS level, a.flag_obligatorio AS required,
         a.id_usuario_responsable::text AS "responsibleUserId", a.estado AS status,
         (SELECT f.referencia_almacenamiento FROM archivo_gestion f
           WHERE f.id_antecedente_gestion = a.id_antecedente_gestion
           ORDER BY f.fecha_carga DESC LIMIT 1) AS "fileReference",
         (SELECT f.fecha_carga::text FROM archivo_gestion f
           WHERE f.id_antecedente_gestion = a.id_antecedente_gestion
           ORDER BY f.fecha_carga DESC LIMIT 1) AS "uploadedAt", a.xmin::text AS version`,
      [id, input.responsibleUserId, input.status, expectedVersion],
    );
    const row = result.rows[0];
    if (!row)
      throw new AppError(
        'VERSION_CONFLICT',
        'El antecedente cambió; recarga antes de guardar.',
        409,
      );
    if (input.fileReference !== null) {
      await this.database.query(
        `UPDATE archivo_gestion
            SET referencia_almacenamiento = $2,
                fecha_carga = COALESCE($3::timestamptz, fecha_carga)
          WHERE id_antecedente_gestion = $1::bigint
            AND id_archivo = (
              SELECT id_archivo FROM archivo_gestion
              WHERE id_antecedente_gestion = $1::bigint
              ORDER BY fecha_carga DESC
              LIMIT 1
            )`,
        [id, input.fileReference, input.uploadedAt],
      );
    }
    const refreshed = await this.findBackground(id);
    return refreshed ?? { ...row, version: Number(row.version) };
  }

  async updateStage(
    id: string,
    input: Omit<ManagementStage, 'id' | 'version' | 'stageName' | 'percentage'>,
    expectedVersion: number,
  ): Promise<ManagementStage> {
    const result = await this.database.query<ManagementStage & { version: string }>(
      `UPDATE etapa_gestion e SET estado = $2, fecha_estimada = $3::date, fecha_real = $4::date,
         id_usuario_responsable = NULLIF($5, '')::bigint,
         observaciones = $6
       FROM gestion g WHERE e.id_etapa_gestion = $1::bigint AND g.id_gestion = e.id_gestion
         AND e.xmin = $7::text::xid
       RETURNING e.id_etapa_gestion::text AS id, g.codigo AS "managementId", e.id_etapa::text AS "stageId",
         (SELECT nombre FROM etapa WHERE id_etapa = e.id_etapa) AS "stageName",
         (SELECT porcentaje FROM etapa WHERE id_etapa = e.id_etapa) AS percentage,
         e.estado AS status, e.fecha_estimada::text AS "estimatedOn", e.fecha_real::text AS "completedOn",
         (SELECT concat_ws(' ', u.nombres, u.primer_apellido, u.segundo_apellido)
            FROM usuario u WHERE u.id_usuario = e.id_usuario_responsable) AS responsible,
         e.observaciones AS notes, e.xmin::text AS version`,
      [
        id,
        input.status,
        input.estimatedOn,
        input.completedOn,
        input.responsibleUserId ?? null,
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
      for (const specificId of input.associatedSpecificManagementIds ?? [])
        await client.query(
          `INSERT INTO gestion_subtramite (id_gestion, id_gestion_especifica)
           VALUES ((SELECT id_gestion FROM gestion WHERE codigo = $1),
             (SELECT id_gestion_especifica FROM gestion_especifica
               WHERE id_gestion_especifica::text = $2::text OR nombre::text = $2::text))`,
          [management.id, specificId],
        );
      let backgrounds = [
        ...(input.requiredBackgrounds ?? []),
        ...(input.complementaryBackgrounds ?? []),
      ];
      if (backgrounds.length === 0 && input.specificManagementId) {
        const catalog = await client.query<{
          backgroundId: string;
          level: ManagementBackgroundCreateInput['level'];
          name: string;
          category: ManagementBackgroundCreateInput['category'];
          required: boolean;
        }>(
          `SELECT gea.id_antecedente::text AS "backgroundId", gea.nivel AS level,
                  a.nombre AS name,
                  CASE WHEN a.categoria = 'complementario'
                    THEN 'complementario' ELSE 'requerido' END AS category,
                  (a.categoria = 'requerido') AS required
           FROM gestion_especifica_antecedente gea
           JOIN gestion_especifica ge
             ON ge.id_gestion_especifica = gea.id_gestion_especifica
           JOIN antecedente a ON a.id_antecedente = gea.id_antecedente
           WHERE ge.id_gestion_especifica::text = $1::text
              OR ge.codigo = $1::text
              OR ge.nombre = $1::text
           ORDER BY gea.orden`,
          [input.specificManagementId],
        );
        backgrounds = catalog.rows;
      }
      const parentIds = new Map<string, string>();
      for (const background of backgrounds) {
        const backgroundKey = background.backgroundId ?? background.name;
        if (parentIds.has(backgroundKey) || parentIds.has(background.name)) continue;
        const created = await this.insertBackground(client, management.id, background, parentIds);
        parentIds.set(background.backgroundId ?? background.name, created.id);
        parentIds.set(background.name, created.id);
      }
      let stages = input.stages;
      if (stages === undefined) {
        const catalog = await client.query<{ name: string }>(
          `SELECT nombre AS name FROM etapa ORDER BY orden`,
        );
        stages = catalog.rows.map((stage) => ({ name: stage.name, status: 'Pendiente' as const }));
      }
      for (const stage of stages) await this.insertStage(client, management.id, stage);
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
       FROM gestion WHERE nivel = $1::varchar AND codigo_ambito = $2::varchar`,
      [input.level, input.scopeCode],
    );
    const sequence = input.sequence ?? Number(sequenceResult.rows[0]?.next_sequence ?? '1');
    const code =
      input.id || `${input.level}-${input.scopeCode}-${String(sequence).padStart(3, '0')}`;
    const result = await client.query<ManagementRow>(
      `INSERT INTO gestion (codigo, id_estacion, id_tipo_gestion, id_gestion_especifica, codigo_ambito,
        id_usuario_responsable, nivel, correlativo, modalidad_creacion, estado, prioridad,
        nombre_solicitante, fecha_apertura, fecha_estimada_termino, fecha_ultima_revision)
       VALUES ($1::varchar, $2::varchar, $3::varchar,
        (SELECT id_gestion_especifica FROM gestion_especifica
          WHERE id_gestion_especifica::text = NULLIF($4::text, '')
             OR codigo::text = NULLIF($4::text, '')
             OR nombre::text = NULLIF($4::text, '')),
        $5::varchar, $6::bigint, $7::varchar, $8::integer, $9::varchar, $10::varchar, $11::varchar,
        $12::varchar,
        $13::date, $14::date, $15::date)
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
    const catalogBackground = (
      await client.query<{
        level: ManagementBackgroundCreateInput['level'];
        parentBackgroundId: string | null;
        parentLevel: ManagementBackgroundCreateInput['level'] | null;
      }>(
        `SELECT gea.nivel AS level, gea.id_antecedente_padre::text AS "parentBackgroundId",
                parent_gea.nivel AS "parentLevel"
         FROM gestion g
         JOIN gestion_especifica_antecedente gea
           ON gea.id_gestion_especifica = g.id_gestion_especifica
           OR EXISTS (
             SELECT 1 FROM gestion_subtramite gs
             WHERE gs.id_gestion = g.id_gestion
               AND gs.id_gestion_especifica = gea.id_gestion_especifica
           )
         JOIN antecedente a ON a.id_antecedente = gea.id_antecedente
         LEFT JOIN gestion_especifica_antecedente parent_gea
           ON parent_gea.id_gestion_especifica = gea.id_gestion_especifica
          AND parent_gea.id_antecedente = gea.id_antecedente_padre
         WHERE g.codigo = $1
           AND (gea.id_antecedente::text = NULLIF($2::text, '') OR a.nombre = $3)
         LIMIT 1`,
        [managementId, input.backgroundId ?? '', input.name],
      )
    ).rows[0];
    if (!catalogBackground)
      throw new AppError(
        'BACKGROUND_NOT_FOUND_IN_CATALOG',
        `El antecedente "${input.name}" no existe en el catálogo de la gestión.`,
        422,
      );
    const level = catalogBackground?.level ?? input.level;
    const parentBackgroundId = catalogBackground
      ? catalogBackground.parentBackgroundId
      : input.parentBackgroundId;
    if (catalogBackground) {
      const expectedParentLevel = level === 'N3' ? 'N2' : level === 'N4' ? 'N3' : null;
      const hierarchyIsValid =
        level === 'N2'
          ? parentBackgroundId === null
          : parentBackgroundId !== null && catalogBackground.parentLevel === expectedParentLevel;
      if (!hierarchyIsValid)
        throw new AppError(
          'INVALID_BACKGROUND_CATALOG_HIERARCHY',
          `La configuración del catálogo para "${input.name}" no define correctamente su nivel o antecedente padre.`,
          422,
        );
    }
    let parentId = parentBackgroundId
      ? (parentIds.get(parentBackgroundId) ??
        (
          await client.query<{ id: string }>(
            `SELECT ag.id_antecedente_gestion::text AS id
             FROM antecedente_gestion ag JOIN gestion g ON g.id_gestion = ag.id_gestion
             JOIN antecedente a ON a.id_antecedente = ag.id_antecedente
             WHERE g.codigo = $1
               AND (ag.id_antecedente_gestion::text = $2
                 OR ag.id_antecedente::text = $2
                 OR a.nombre = $2)
             ORDER BY ag.id_antecedente_gestion
             LIMIT 1`,
            [managementId, parentBackgroundId],
          )
        ).rows[0]?.id ??
        null)
      : null;
    if (parentBackgroundId && !parentId) {
      const parentCatalog = (
        await client.query<{
          backgroundId: string;
          name: string;
          level: ManagementBackgroundCreateInput['level'];
          parentBackgroundId: string | null;
          category: 'requerido' | 'complementario';
        }>(
          `SELECT gea.id_antecedente::text AS "backgroundId", a.nombre AS name,
                  gea.nivel AS level, gea.id_antecedente_padre::text AS "parentBackgroundId",
                  CASE WHEN a.categoria = 'complementario'
                    THEN 'complementario' ELSE 'requerido' END AS category
           FROM gestion g
           JOIN gestion_especifica_antecedente gea
             ON gea.id_gestion_especifica = g.id_gestion_especifica
             OR EXISTS (
               SELECT 1 FROM gestion_subtramite gs
               WHERE gs.id_gestion = g.id_gestion
                 AND gs.id_gestion_especifica = gea.id_gestion_especifica
             )
           JOIN antecedente a ON a.id_antecedente = gea.id_antecedente
           WHERE g.codigo = $1 AND gea.id_antecedente::text = $2
           LIMIT 1`,
          [managementId, parentBackgroundId],
        )
      ).rows[0];
      if (parentCatalog) {
        const parent = await this.insertBackground(
          client,
          managementId,
          {
            backgroundId: parentCatalog.backgroundId,
            parentBackgroundId: parentCatalog.parentBackgroundId,
            level: parentCatalog.level,
            name: parentCatalog.name,
            category: parentCatalog.category,
            required: parentCatalog.category === 'requerido',
          },
          parentIds,
        );
        parentIds.set(parentCatalog.backgroundId, parent.id);
        parentIds.set(parentCatalog.name, parent.id);
        parentId = parent.id;
      }
    }
    if (parentBackgroundId && !parentId)
      throw new AppError(
        'BACKGROUND_PARENT_NOT_FOUND',
        `No se encontró el antecedente padre "${parentBackgroundId}".`,
        422,
      );
    const result = await client.query<ManagementBackground & { version: string }>(
      `INSERT INTO antecedente_gestion (id_gestion, id_antecedente_padre, id_antecedente, nivel, categoria,
        flag_obligatorio, id_usuario_responsable, estado, observaciones)
       VALUES ((SELECT id_gestion FROM gestion WHERE codigo = $1), $2::bigint,
        (SELECT id_antecedente FROM antecedente
          WHERE id_antecedente::text = NULLIF($3::text, '') OR nombre::text = $4::text),
        $5::varchar, $6::varchar, $7::boolean,
        NULLIF($8::text, '')::bigint, $9::varchar, $10::varchar)
       RETURNING id_antecedente_gestion::text AS id, $1::text AS "managementId",
        id_antecedente_padre::text AS "parentManagementBackgroundId",
        (SELECT id_tipo_gestion FROM gestion WHERE codigo = $1) AS "managementTypeId",
        COALESCE(id_antecedente::text, '') AS "backgroundId", nivel AS level,
        flag_obligatorio AS required, id_usuario_responsable::text AS "responsibleUserId",
        estado AS status, NULL::varchar AS "fileReference", NULL::timestamptz AS "uploadedAt", xmin::text AS version`,
      [
        managementId,
        parentId,
        input.backgroundId ?? '',
        input.name,
        level,
        input.category,
        input.required,
        input.responsibleUserId ?? '',
        input.status ?? 'Pendiente',
        input.observations ?? null,
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
        id_usuario_responsable, observaciones)
       VALUES ((SELECT id_gestion FROM gestion WHERE codigo = $1),
        (SELECT id_etapa FROM etapa
          WHERE id_etapa::text = NULLIF($2::text, '') OR nombre::text = $3::text),
        $4, $5::date, $6::date, NULLIF($7, '')::bigint, $8)
       RETURNING id_etapa_gestion::text AS id, $1::text AS "managementId", id_etapa::text AS "stageId",
        (SELECT nombre FROM etapa WHERE id_etapa = etapa_gestion.id_etapa) AS "stageName",
        (SELECT porcentaje FROM etapa WHERE id_etapa = etapa_gestion.id_etapa) AS percentage,
        estado AS status, fecha_estimada::text AS "estimatedOn", fecha_real::text AS "completedOn",
        (SELECT concat_ws(' ', u.nombres, u.primer_apellido, u.segundo_apellido)
           FROM usuario u WHERE u.id_usuario = etapa_gestion.id_usuario_responsable) AS responsible,
        observaciones AS notes, xmin::text AS version`,
      [
        managementId,
        input.stageId ?? '',
        input.name,
        input.status ?? 'Pendiente',
        input.estimatedOn ?? null,
        input.completedOn ?? null,
        input.responsibleUserId ?? '',
        input.notes ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('La etapa no pudo ser creada.');
    return { ...row, version: Number(row.version) };
  }
}
