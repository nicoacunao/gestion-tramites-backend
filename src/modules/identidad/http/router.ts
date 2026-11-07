import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { AppError } from '../../../shared/errors/app-error';
import { ApiErrorSchema, ApiMetaSchema } from '../../../shared/api/schemas';
import type { AppEnv } from '../../../shared/config/bindings';
import { InvalidCredentialsError, login, type LoginDependencies } from '../application/login';
import { authenticatedUser } from '../../../shared/auth/request-auth';

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

const publicUserSchema = z
  .object({
    id: z.string(),
    rut: z.string(),
    names: z.string(),
    firstSurname: z.string(),
    secondSurname: z.string().nullable(),
    email: z.string(),
    phone: z.string().nullable(),
    description: z.string().nullable(),
    role: z.string(),
    organization: z.string().nullable(),
    version: z.number().int().nonnegative(),
  })
  .openapi('UserProfile');
const profileWriteSchema = z.object({
  names: z.string().trim().min(1).max(100),
  firstSurname: z.string().trim().min(1).max(80),
  secondSurname: z.string().trim().max(80).nullable(),
  email: z.string().email().max(254),
  phone: z.string().trim().max(30).nullable(),
  description: z.string().trim().max(500).nullable(),
  version: z.number().int().nonnegative(),
});

function publicUser(user: Awaited<ReturnType<typeof authenticatedUser>>) {
  return {
    id: user.id,
    rut: user.rut,
    names: user.names,
    firstSurname: user.firstSurname,
    secondSurname: user.secondSurname,
    email: user.email,
    phone: user.phone,
    description: user.description,
    role: user.role,
    organization: user.organization,
    version: user.version,
  };
}

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
  router.openapi(
    createRoute({
      method: 'get',
      path: '/profile',
      tags: ['identidad'],
      operationId: 'identidadGetProfile',
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({ data: publicUserSchema, meta: ApiMetaSchema }),
            },
          },
          description: 'Perfil.',
        },
        401: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'No autenticado.',
        },
      },
    }),
    async (context) => {
      const user = await authenticatedUser(context.req.raw, context.env);
      return context.json(
        { data: publicUser(user), meta: { requestId: context.get('requestId') } },
        200,
      );
    },
  );
  router.openapi(
    createRoute({
      method: 'put',
      path: '/profile',
      tags: ['identidad'],
      operationId: 'identidadUpdateProfile',
      request: { body: { content: { 'application/json': { schema: profileWriteSchema } } } },
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({ data: publicUserSchema, meta: ApiMetaSchema }),
            },
          },
          description: 'Perfil actualizado.',
        },
        401: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'No autenticado.',
        },
        409: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'Conflicto de versión.',
        },
      },
    }),
    async (context) => {
      const user = await authenticatedUser(context.req.raw, context.env);
      const input = context.req.valid('json');
      const users = dependencies(context.env).users;
      await users.save({ ...user, ...input }, input.version);
      const updated = await users.findById(user.id);
      return context.json(
        {
          data: publicUser(updated ?? { ...user, ...input }),
          meta: { requestId: context.get('requestId') },
        },
        200,
      );
    },
  );
  router.openapi(
    createRoute({
      method: 'get',
      path: '/users',
      tags: ['identidad'],
      operationId: 'identidadListUsers',
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({ data: z.array(publicUserSchema), meta: ApiMetaSchema }),
            },
          },
          description: 'Responsables disponibles.',
        },
        401: {
          content: { 'application/json': { schema: ApiErrorSchema } },
          description: 'No autenticado.',
        },
      },
    }),
    async (context) => {
      await authenticatedUser(context.req.raw, context.env);
      const users = dependencies(context.env).users;
      if (!users.list)
        throw new AppError('NOT_IMPLEMENTED', 'El listado de usuarios no está disponible.', 503);
      return context.json(
        {
          data: Array.from((await users.list()).map(publicUser)),
          meta: { requestId: context.get('requestId') },
        },
        200,
      );
    },
  );
  return router;
}
