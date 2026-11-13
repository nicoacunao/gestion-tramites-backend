import type { SqlExecutor } from '../../../infrastructure/persistence/postgres/connection';
import type { ManagementListItem, StationSummary } from '../domain/read-models';
import type { ManagementQueries } from '../application/ports';

export class PostgresManagementQueries implements ManagementQueries {
  constructor(private readonly database: SqlExecutor) {}
  async listAssignedTo(userId: string): Promise<readonly ManagementListItem[]> {
    return this.list('WHERE g.id_usuario_responsable = $1', [userId]);
  }
  async listAll(): Promise<readonly ManagementListItem[]> {
    return this.list('', []);
  }
  private async list(where: string, values: unknown[]): Promise<readonly ManagementListItem[]> {
    const result = await this.database.query<ManagementListItem>(
      `SELECT g.codigo AS id, g.codigo AS code, g.nivel AS level,
      g.id_estacion AS "stationId", e.comuna AS commune,
      (SELECT concat_ws(' ', u.nombres, u.primer_apellido, u.segundo_apellido)
         FROM usuario u WHERE u.id_usuario = g.id_usuario_responsable) AS "responsibleName",
      g.estado AS status, g.fecha_apertura::text AS "openedOn" FROM gestion g JOIN estacion e ON e.id_estacion = g.id_estacion ${where} ORDER BY g.fecha_apertura DESC`,
      values,
    );
    return result.rows;
  }
  async summarizeStations(): Promise<readonly StationSummary[]> {
    const result = await this.database.query<StationSummary>(
      `SELECT e.id_estacion AS "stationId",
      COUNT(g.id_gestion) FILTER (WHERE g.estado NOT IN ('Terminado aprobado','Terminado desfavorable'))::int AS "activeCount",
      COUNT(g.id_gestion) FILTER (WHERE g.estado IN ('Borrador','Pendiente','Observado','Reingresado'))::int AS "pendingCount",
      COALESCE((CURRENT_DATE - MAX(g.fecha_ultima_revision))::int, 0) AS "daysWithoutProgress",
      CASE WHEN COUNT(g.id_gestion) FILTER (WHERE g.estado NOT IN ('Terminado aprobado','Terminado desfavorable')) = 0 THEN 'Sin gestiones activas'
        WHEN COUNT(g.id_gestion) FILTER (WHERE g.estado IN ('Borrador','Pendiente','Observado','Reingresado')) >= 3
          OR COALESCE((CURRENT_DATE - MAX(g.fecha_ultima_revision))::int, 0) >= 15 THEN 'Urgente'
        ELSE 'Al día' END AS "overallStatus"
      FROM estacion e LEFT JOIN gestion g ON g.id_estacion = e.id_estacion GROUP BY e.id_estacion ORDER BY e.id_estacion`,
      [],
    );
    return result.rows;
  }
}
