import { AppError } from '../../../shared/errors/app-error';
import type { TabularDataSource, TabularRow } from '../../../shared/persistence/tabular-repository';

export interface MicrosoftGraphWorkbookOptions {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  driveId: string;
  workbookItemId: string;
  authMode: 'disabled' | 'delegated-refresh-token';
}

export class MicrosoftGraphWorkbookDataSource implements TabularDataSource {
  constructor(readonly options: MicrosoftGraphWorkbookOptions) {}

  private async accessToken(): Promise<string> {
    if (this.options.authMode !== 'delegated-refresh-token') {
      throw new AppError('EXCEL_GRAPH_NOT_CONFIGURED', 'Excel Graph requiere OAuth delegado.', 503);
    }
    const response = await fetch(
      `https://login.microsoftonline.com/${this.options.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
          refresh_token: this.options.refreshToken,
          grant_type: 'refresh_token',
          scope: 'https://graph.microsoft.com/.default',
        }),
      },
    );
    if (!response.ok)
      throw new AppError(
        'EXCEL_GRAPH_UNAVAILABLE',
        'No fue posible autenticar contra Excel Graph.',
        503,
      );
    const body = (await response.json()) as { access_token?: string };
    if (!body.access_token)
      throw new AppError(
        'EXCEL_GRAPH_UNAVAILABLE',
        'Excel Graph no entregó un token de acceso.',
        503,
      );
    return body.access_token;
  }

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(this.options.driveId)}/items/${encodeURIComponent(this.options.workbookItemId)}/workbook${path}`,
      {
        ...init,
        headers: {
          authorization: `Bearer ${await this.accessToken()}`,
          accept: 'application/json',
          ...(init?.headers ?? {}),
        },
      },
    );
    if (!response.ok)
      throw new AppError(
        'EXCEL_GRAPH_UNAVAILABLE',
        `Excel Graph respondió HTTP ${response.status}.`,
        503,
      );
    return response.status === 204 ? undefined : response.json();
  }

  async readTable(tableName: string): Promise<readonly TabularRow[]> {
    const body = (await this.request(
      `/tables/${encodeURIComponent(tableName)}/rows?$top=5000`,
    )) as { value?: Array<{ values?: unknown[][] }> };
    const rows = body.value ?? [];
    if (!rows.length) return [];
    const headers = (await this.request(
      `/tables/${encodeURIComponent(tableName)}/headerRowRange`,
    )) as { values?: unknown[][] };
    const columns = (headers.values?.[0] ?? []).map(String);
    return rows.map((entry) =>
      Object.fromEntries(
        columns.map((column, index) => [column, normalize(entry.values?.[0]?.[index])]),
      ),
    ) as TabularRow[];
  }

  async findRow(tableName: string, id: string): Promise<TabularRow | null> {
    const rows = await this.readTable(tableName);
    return rows.find((row) => String(Object.values(row)[0] ?? '') === id) ?? null;
  }

  async upsertRow(tableName: string, row: TabularRow, expectedVersion?: number): Promise<void> {
    const rows = await this.readTable(tableName);
    const values = Object.values(row);
    const id = String(values[0] ?? '');
    const index = rows.findIndex((candidate) => String(Object.values(candidate)[0] ?? '') === id);
    const existing = index >= 0 ? rows[index] : undefined;
    if (
      index >= 0 &&
      expectedVersion !== undefined &&
      existing &&
      Number(existing.version ?? 0) !== expectedVersion
    ) {
      throw new AppError('VERSION_CONFLICT', 'La fila fue modificada por otro usuario.', 409);
    }
    const path =
      index >= 0
        ? `/tables/${encodeURIComponent(tableName)}/rows/${index}`
        : `/tables/${encodeURIComponent(tableName)}/rows/add`;
    await this.request(path, {
      method: index >= 0 ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ values: [values] }),
    });
  }
}

function normalize(value: unknown): string | number | boolean | null {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  )
    return value;
  return value === undefined ? null : String(value);
}
