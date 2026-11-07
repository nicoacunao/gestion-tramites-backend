import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import type { CamposAdicionalesRepository } from '../application/ports';
import type { AdditionalField } from '../domain/model';
export class PostgresCamposAdicionalesRepository implements CamposAdicionalesRepository {
  constructor(private readonly database: SqlExecutor) {}
  async list(managementTypeId?: string): Promise<readonly AdditionalField[]> {
    const result = await this.database.query<AdditionalField>(
      `SELECT c.id_campo_adicional::text AS id, c.id_tipo_gestion AS "managementTypeId",
        c.codigo AS code, c.etiqueta AS label, c.tipo_control AS "controlType", c.requerido AS required,
        COALESCE((SELECT json_agg(json_build_object('value', o.valor, 'order', o.orden) ORDER BY o.orden)
          FROM opcion_campo_adicional o WHERE o.id_campo_adicional = c.id_campo_adicional), '[]'::json) AS options
      FROM campo_adicional_tipo c
      WHERE ($1::varchar IS NULL OR c.id_tipo_gestion = $1)
      ORDER BY c.id_campo_adicional`,
      [managementTypeId ?? null],
    );
    return result.rows;
  }
}
