import { AppError } from '../errors/app-error';

export async function fetchExternal(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
  code: string,
  message: string,
): Promise<Response> {
  try {
    return await fetcher(input, init);
  } catch {
    throw new AppError(code, message, 503);
  }
}

export async function readExternalJson<T>(
  response: Response,
  code: string,
  message: string,
): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new AppError(code, message, 503);
  }
}
