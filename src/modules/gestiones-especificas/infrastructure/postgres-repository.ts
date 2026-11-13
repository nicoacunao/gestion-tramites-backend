import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import type { GestionesEspecificasRepository } from '../application/ports';
import type { SpecificManagement } from '../domain/model';
export class PostgresGestionesEspecificasRepository implements GestionesEspecificasRepository {
  constructor(private readonly database: SqlExecutor) {}
  async list(managementTypeId?: string): Promise<readonly SpecificManagement[]> {
    const result = await this.database.query<SpecificManagement>(
      `SELECT ge.id_gestion_especifica::text AS id, ge.id_tipo_gestion AS "managementTypeId",
        ge.codigo AS code, ge.nombre AS name, ge.activo AS active,
        COALESCE(
          json_agg(
            json_build_object(
              'id', a.id_antecedente::text,
              'name', a.nombre,
              'level', gea.nivel,
              'parentBackgroundId', gea.id_antecedente_padre::text
            ) ORDER BY gea.orden
          ) FILTER (WHERE a.id_antecedente IS NOT NULL),
          '[]'::json
        ) AS backgrounds
      FROM gestion_especifica ge
      LEFT JOIN gestion_especifica_antecedente gea
        ON gea.id_gestion_especifica = ge.id_gestion_especifica
      LEFT JOIN antecedente a ON a.id_antecedente = gea.id_antecedente
      WHERE ($1::varchar IS NULL OR ge.id_tipo_gestion = $1)
      GROUP BY ge.id_gestion_especifica, ge.id_tipo_gestion, ge.codigo, ge.nombre, ge.activo
      ORDER BY ge.nombre, ge.id_gestion_especifica`,
      [managementTypeId ?? null],
    );
    return result.rows;
  }
}
