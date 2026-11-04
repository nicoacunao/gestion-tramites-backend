import { z } from '@hono/zod-openapi';

export const ApiMetaSchema = z
  .object({
    requestId: z.string().openapi({ example: '4b118c2e-f0f6-4be9-9713-9ed923f44a68' }),
  })
  .openapi('ApiMeta');

export const ModuleHealthDataSchema = z
  .object({
    module: z.string().openapi({ example: 'gestiones' }),
    status: z.literal('ok'),
  })
  .openapi('ModuleHealthData');

export const ModuleHealthResponseSchema = z
  .object({
    data: ModuleHealthDataSchema,
    meta: ApiMetaSchema,
  })
  .openapi('ModuleHealthResponse');

export const ApiErrorSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'RESOURCE_NOT_FOUND' }),
      message: z.string().openapi({ example: 'El recurso solicitado no existe.' }),
      details: z.unknown().optional(),
    }),
    meta: ApiMetaSchema,
  })
  .openapi('ApiError');

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiPage<T> {
  data: readonly T[];
  meta: ApiMetaSchemaType & PageMeta;
}

export type ApiMetaSchemaType = z.infer<typeof ApiMetaSchema>;
