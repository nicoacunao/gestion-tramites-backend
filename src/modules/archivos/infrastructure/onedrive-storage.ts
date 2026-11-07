import { AppError } from '../../../shared/errors/app-error';
import type { FileStorage } from '../application/ports';
import type { AppBindings } from '../../../shared/config/bindings';

export class OneDriveStorage implements FileStorage {
  constructor(private readonly env: AppBindings) {}
  private async token(): Promise<string> {
    if (
      !this.env.GRAPH_AUTH_MODE ||
      this.env.GRAPH_AUTH_MODE === 'disabled' ||
      !this.env.GRAPH_TENANT_ID ||
      !this.env.GRAPH_CLIENT_ID ||
      !this.env.GRAPH_CLIENT_SECRET ||
      !this.env.GRAPH_REFRESH_TOKEN
    )
      throw new AppError(
        'ONEDRIVE_NOT_CONFIGURED',
        'OneDrive requiere OAuth delegado configurado.',
        503,
      );
    const response = await fetch(
      `https://login.microsoftonline.com/${this.env.GRAPH_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.env.GRAPH_CLIENT_ID,
          client_secret: this.env.GRAPH_CLIENT_SECRET,
          refresh_token: this.env.GRAPH_REFRESH_TOKEN,
          grant_type: 'refresh_token',
          scope: 'https://graph.microsoft.com/.default',
        }),
      },
    );
    if (!response.ok)
      throw new AppError('ONEDRIVE_UNAVAILABLE', 'No fue posible autenticar contra OneDrive.', 503);
    const body = (await response.json()) as { access_token?: string };
    if (!body.access_token)
      throw new AppError('ONEDRIVE_UNAVAILABLE', 'OneDrive no entregó un token.', 503);
    return body.access_token;
  }
  private drive(): string {
    return this.env.ONEDRIVE_DRIVE_ID ?? this.env.GRAPH_DRIVE_ID ?? '';
  }
  async put(key: string, content: ReadableStream, mediaType: string): Promise<string> {
    const reference = `${this.env.ONEDRIVE_ROOT_PATH ?? 'gestion-tramites'}/${key}`;
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(this.drive())}/root:/${reference}:/content`,
      {
        method: 'PUT',
        headers: { authorization: `Bearer ${await this.token()}`, 'content-type': mediaType },
        body: content as BodyInit,
      },
    );
    if (!response.ok)
      throw new AppError(
        'ONEDRIVE_UNAVAILABLE',
        `OneDrive respondió HTTP ${response.status}.`,
        503,
      );
    return reference;
  }
  async get(reference: string): Promise<ReadableStream | null> {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(this.drive())}/root:/${reference}:/content`,
      { headers: { authorization: `Bearer ${await this.token()}` } },
    );
    if (response.status === 404) return null;
    if (!response.ok || !response.body)
      throw new AppError('ONEDRIVE_UNAVAILABLE', 'No fue posible descargar el archivo.', 503);
    return response.body;
  }
}
