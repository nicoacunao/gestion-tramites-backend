import { z } from '@hono/zod-openapi';
import { ApiMetaSchema } from '../../../shared/api/schemas';

export const StationSchema = z
  .object({
    id: z.string().trim().regex(/^\d+$/).max(19),
    address: z.string().trim().min(1).max(250),
    commune: z.string().trim().min(1).max(100),
    legalName: z.string().trim().min(1).max(150),
    zoneManager: z.string().trim().max(150).nullable().optional(),
    commercialManager: z.string().trim().max(150).nullable().optional(),
    companyRut: z.string().trim().max(12).nullable().optional(),
    legalRepresentative: z.string().trim().max(150).nullable().optional(),
    legalRepresentativeRut: z.string().trim().max(12).nullable().optional(),
    estado: z.string().trim().min(1).max(30),
  })
  .openapi('Station');

export const StationWriteSchema = StationSchema.openapi('StationWrite');
export const StationUpdateSchema = StationWriteSchema.openapi('StationUpdate');

export const StationResponseSchema = z
  .object({ exito: z.literal(true), mensaje: StationSchema, meta: ApiMetaSchema })
  .openapi('StationResponse');
export const StationListResponseSchema = z
  .object({ exito: z.literal(true), mensaje: z.array(StationSchema), meta: ApiMetaSchema })
  .openapi('StationListResponse');
