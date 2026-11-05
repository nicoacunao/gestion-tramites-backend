import type { TabularDataSource, TabularRow } from '../../../shared/persistence/tabular-repository';

export interface ExcelGraphOptions {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  driveId: string;
  workbookItemId: string;
}

export class ExcelGraphUserDataSource implements TabularDataSource {
  constructor(
    private readonly options: ExcelGraphOptions,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async readTable(tableName: string): Promise<readonly TabularRow[]> {
    const token = await this.accessToken();
    const baseUrl = `https://graph.microsoft.com/v1.0/drives/${this.options.driveId}/items/${this.options.workbookItemId}/workbook/tables/${encodeURIComponent(tableName)}`;
    const [columnsResponse, rowsResponse] = await Promise.all([
      this.fetcher(`${baseUrl}/columns`, { headers: { Authorization: `Bearer ${token}` } }),
      this.fetcher(`${baseUrl}/rows`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (!columnsResponse.ok || !rowsResponse.ok) {
      throw new Error(
        `Excel Graph respondió HTTP ${columnsResponse.ok ? rowsResponse.status : columnsResponse.status}.`,
      );
    }
    const columnsBody = (await columnsResponse.json()) as { value?: Array<{ name?: string }> };
    const rowsBody = (await rowsResponse.json()) as { value?: Array<{ values?: unknown[][] }> };
    const headers = (columnsBody.value ?? []).map((column) => column.name ?? '');
    return (rowsBody.value ?? []).flatMap((row) => {
      const values = row.values?.[0];
      return values
        ? [
            Object.fromEntries(
              headers.map((header, index) => [
                header,
                (values[index] as string | number | boolean | null) ?? null,
              ]),
            ),
          ]
        : [];
    });
  }

  async findRow(tableName: string, id: string): Promise<TabularRow | null> {
    const rows = await this.readTable(tableName);
    return rows.find((row) => String(row.id_usuario ?? '') === id) ?? null;
  }

  upsertRow(_tableName: string, _row: TabularRow, _expectedVersion?: number): Promise<void> {
    throw new Error('La escritura de usuarios en Excel aún no está habilitada.');
  }

  private async accessToken(): Promise<string> {
    const response = await this.fetcher(
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
    if (!response.ok) throw new Error(`Microsoft OAuth respondió HTTP ${response.status}.`);
    const body = (await response.json()) as { access_token?: string };
    if (!body.access_token) throw new Error('Microsoft OAuth no devolvió access_token.');
    return body.access_token;
  }
}
