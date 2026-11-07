import { z } from '@hono/zod-openapi';
import { ApiMetaSchema } from '../../../shared/api/schemas';

export const StationSchema = z
  .object({
    id: z.string().trim().min(1).max(20),
    name: z.string().trim().max(150).nullable().optional(),
    address: z.string().trim().min(1).max(250),
    commune: z.string().trim().min(1).max(100),
    legalName: z.string().trim().min(1).max(150),
    zoneManager: z.string().trim().min(1).max(150),
    commercialManager: z.string().trim().min(1).max(150),
    companyRut: z.string().trim().min(1).max(12),
    legalRepresentative: z.string().trim().min(1).max(150),
    legalRepresentativeRut: z.string().trim().max(12).nullable().optional(),
    status: z.string().trim().min(1).max(30),
    version: z.number().int().nonnegative(),
  })
  .openapi('Station');

export const StationWriteSchema = StationSchema.omit({ version: true }).openapi('StationWrite');
export const StationUpdateSchema = StationWriteSchema.extend({
  version: z.number().int().positive(),
}).openapi('StationUpdate');

export const StationResponseSchema = z
  .object({ data: StationSchema, meta: ApiMetaSchema })
  .openapi('StationResponse');
export const StationListResponseSchema = z
  .object({ data: z.array(StationSchema), meta: ApiMetaSchema })
  .openapi('StationListResponse');
