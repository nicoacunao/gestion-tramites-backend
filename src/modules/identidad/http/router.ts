import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { AppError } from '../../../shared/errors/app-error';
import { ApiErrorSchema, ApiMetaSchema } from '../../../shared/api/schemas';
import type { AppEnv } from '../../../shared/config/bindings';
import { InvalidCredentialsError, login, type LoginDependencies } from '../application/login';

const LoginRequestSchema = z
  .object({
    rut: z.string().trim().min(1).max(20).openapi({ example: '12.345.678-9' }),
    password: z.string().min(1).max(200).openapi({ example: '••••••••' }),
  })
  .openapi('LoginRequest');

const LoginResponseSchema = z
  .object({
    data: z.object({
      accessToken: z.string(),
      expiresAt: z.string().datetime(),
      user: z.object({
        id: z.string(),
        rut: z.string(),
        names: z.string(),
        firstSurname: z.string(),
        secondSurname: z.string().nullable(),
        email: z.string(),
        role: z.string(),
      }),
    }),
    meta: ApiMetaSchema,
  })
  .openapi('LoginResponse');

const route = createRoute({
  method: 'post',
  path: '/login',
  tags: ['identidad'],
  operationId: 'identidadLogin',
  request: { body: { content: { 'application/json': { schema: LoginRequestSchema } } } },
  responses: {
    200: {
      content: { 'application/json': { schema: LoginResponseSchema } },
      description: 'Autenticación exitosa.',
    },
    401: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Credenciales inválidas.',
    },
    400: {
      content: { 'application/json': { schema: ApiErrorSchema } },
      description: 'Solicitud inválida.',
    },
  },
});

export function createLoginRouter(
  dependencies: (env: AppEnv['Bindings']) => LoginDependencies,
): OpenAPIHono<AppEnv> {
  const router = new OpenAPIHono<AppEnv>();
  router.openapi(route, async (context) => {
    const body = context.req.valid('json');
    try {
      const result = await login(body.rut.toUpperCase(), body.password, dependencies(context.env));
      return context.json(
        {
          data: {
            accessToken: result.session.token,
            expiresAt: result.session.expiresAt,
            user: result.user,
          },
          meta: { requestId: context.get('requestId') },
        },
        200,
      );
    } catch (error) {
      if (error instanceof InvalidCredentialsError)
        throw new AppError('INVALID_CREDENTIALS', 'RUT o contraseña inválidos.', 401);
      throw error;
    }
  });
  return router;
}
