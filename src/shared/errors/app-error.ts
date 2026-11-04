export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotImplementedAppError extends AppError {
  constructor(capability: string) {
    super(
      'CAPABILITY_NOT_IMPLEMENTED',
      `La capacidad ${capability} todavía no está implementada.`,
      503,
    );
  }
}
