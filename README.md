# Gestión de Trámites — Backend

API REST para gestionar trámites internos. Es un monolito modular TypeScript
ejecutado en Cloudflare Workers con Hono, validación Zod, OpenAPI y PostgreSQL
de Supabase. El acceso a datos usa `pg` y SQL nativo parametrizado; no se usa
ORM ni query builder.

## Stack

- Cloudflare Workers, Wrangler y `nodejs_compat`.
- Hono y `@hono/zod-openapi`.
- PostgreSQL/Supabase mediante `pg`.
- Vitest con el plugin de Cloudflare.
- ESLint, Prettier y dependency-cruiser.

El pool se crea de forma lazy por solicitud, se comparte entre los repositorios
que atienden esa solicitud y se cierra al terminar. Las credenciales no se
guardan en Git.

## Inicio rápido

Requisitos: Node.js 22.13+ y npm 11+.

```bash
npm install
cp .env.example .env
# Completa DATABASE_URL, DATABASE_SSL_CA y AUTH_TOKEN_SECRET
npm run types:bindings
node --env-file=.env --import tsx scripts/check-db.ts
npm run dev
```

El Worker queda normalmente en `http://localhost:8787`. La configuración de
Supabase está en [docs/supabase-migration.md](./docs/supabase-migration.md).

## Comandos

| Comando                    | Descripción                                  |
| -------------------------- | -------------------------------------------- |
| `npm run dev`              | Desarrollo local con Wrangler.               |
| `npm run typecheck`        | TypeScript estricto.                         |
| `npm run lint`             | ESLint.                                      |
| `npm run boundaries`       | Límites y ciclos entre módulos.              |
| `npm run format`           | Verificación Prettier.                       |
| `npm test`                 | Pruebas dentro de `workerd`.                 |
| `npm run build`            | Dry-run del despliegue.                      |
| `npm run openapi:generate` | Regenera `openapi/openapi.json`.             |
| `npm run check`            | Ejecuta todas las comprobaciones anteriores. |

## Estructura de un módulo

```text
src/modules/<modulo>/
  domain/           modelos y tipos
  application/      servicios y puertos de repositorio
  http/             rutas, esquemas y controladores
  infrastructure/   repositorios PostgreSQL
  factory.ts        composición de dependencias
  module.ts         ensamblaje Hono
  index.ts          API pública
```

La conexión común está en
[`src/infrastructure/persistence/postgres`](./src/infrastructure/persistence/postgres):
`config.ts` valida URL/TLS, `connection.ts` crea sesiones de pool y `errors.ts`
traduce códigos SQLSTATE a errores HTTP seguros.

## Módulos y servicios

### `identidad`

Autentica usuarios de `usuario` mediante RUT y contraseña. `login.ts` coordina
la búsqueda, `password-hasher.ts` verifica PBKDF2 y `session-issuer.ts` emite
la sesión firmada con `AUTH_TOKEN_SECRET`. El repositorio PostgreSQL está en
`infrastructure/postgres-user-repository.ts`.

Rutas: `POST /api/v1/identidad/login` y
`GET /api/v1/identidad/health`.

### `estaciones`

Administra `estacion`: listado, detalle, alta y edición optimista usando `xmin`.
Rutas: `GET/POST /api/v1/estaciones/items` y
`GET/PUT /api/v1/estaciones/items/{id}`.

La fachada antigua también las expone en `/api/v1/catalogos/items`. Como la BD
no tiene `name` ni `status`, se devuelve `name=null` y `status=active`; otros
valores se rechazan.

### `ambitos`

Consulta `ambito_gestion` con código y nombre. Ruta nueva:
`GET /api/v1/ambitos/items`. Compatibilidad: `/api/v1/catalogos/scopes`.

### `tipos-gestion`

Consulta `tipo_gestion`, incluyendo etiqueta y configuración del segundo nivel.
Ruta nueva: `GET /api/v1/tipos-gestion/items`. Compatibilidad:
`/api/v1/catalogos/management-types`.

### `gestiones-especificas`

Consulta `gestion_especifica`, que reemplaza la relación padre-hijo anterior
entre tipos. Ruta: `GET /api/v1/gestiones-especificas/items`, con filtro opcional
`managementTypeId`. La ruta antigua `/api/v1/catalogos/type-relations` fue
retirada porque no existe una tabla equivalente.

### `antecedentes`

Consulta el catálogo `antecedente`. Ruta nueva:
`GET /api/v1/antecedentes/items`. Compatibilidad: `/api/v1/catalogos/backgrounds`.

### `campos-adicionales`

Consulta `campo_adicional_tipo` y sus opciones de
`opcion_campo_adicional`, filtrables por tipo de gestión:
`GET /api/v1/campos-adicionales/items?managementTypeId=...`.

### `etapas`

Consulta el catálogo ordenado `etapa`, con nombre, porcentaje y orden. Ruta
nueva: `GET /api/v1/etapas/items`. Compatibilidad: `/api/v1/catalogos/stages`.

### `catalogos`

Es una fachada de compatibilidad para las rutas antiguas de estaciones, ámbitos,
tipos, antecedentes y etapas. La lógica nueva pertenece a los módulos separados.
También conserva `GET /api/v1/catalogos/health`.

### `gestiones`

Administra `gestion`. El identificador público es `gestion.codigo`; el identity
`id_gestion` es interno. El servicio valida fechas, estado, prioridad, nivel,
responsable y concurrencia mediante `xmin`. En altas usa
`modalidad_creacion='principal'` y deriva datos legales desde la estación y el
nombre del responsable desde `usuario`.

Rutas: `GET/POST /api/v1/gestiones/items`,
`GET/PUT /api/v1/gestiones/items/{id}` y
`GET /api/v1/gestiones/health`.

### `bitacora`

Administra `entrada_bitacora`. Usa `codigo_externo` como ID público, relaciona
la entrada con `gestion` y `usuario`, convierte fecha/hora desde
`America/Santiago` y deriva `autor_nombre` e iniciales desde el usuario.

Rutas: `GET /api/v1/bitacora/items?managementId=...`,
`POST /api/v1/bitacora/items`, `GET /api/v1/bitacora/items/{id}` y
`GET /api/v1/bitacora/health`.

### `archivos`

Actualmente expone sólo `GET /api/v1/archivos/health`. Sus tipos reservan el
contrato de metadatos; el esquema guarda referencias, no bytes. El almacenamiento
de objetos y las operaciones upload/download aún deben definirse.

### `consultas`

Actualmente expone sólo `GET /api/v1/consultas/health`. Sus modelos de lectura
reservan futuros listados, indicadores y resúmenes.

## Contrato HTTP

OpenAPI se publica en `/openapi.json` y se versiona en
[openapi/openapi.json](./openapi/openapi.json). Las respuestas de negocio usan:

```json
{ "data": {}, "meta": { "requestId": "..." } }
```

Los errores usan:

```json
{ "error": { "code": "...", "message": "..." }, "meta": { "requestId": "..." } }
```

## Configuración

```env
DATABASE_URL=postgresql://...
DATABASE_SSL_MODE=verify-full
DATABASE_SSL_CA="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
DATABASE_POOL_MAX=5
DATABASE_CONNECTION_TIMEOUT_MS=10000
DATABASE_IDLE_TIMEOUT_MS=30000
AUTH_TOKEN_SECRET=...
```

`.env` y `.dev.vars` están excluidos de Git. En Cloudflare, configura secretos
con Wrangler:

```bash
npx wrangler secret put DATABASE_URL --env production
npx wrangler secret put DATABASE_SSL_CA --env production
npx wrangler secret put AUTH_TOKEN_SECRET --env production
```

Para PostgreSQL se usa la cadena de conexión de Supabase, no las claves `anon` o
`service_role`.

## Health checks

Las carpetas `health` se conservan porque tienen imports, documentación y tests.
El frontend revisado no las consume, pero pueden existir sondas externas.

## Documentación adicional

- [Migración y conexión Supabase](./docs/supabase-migration.md)
- [Auditoría de integración con frontend](./docs/frontend-supabase-audit.md)
- [Arquitectura](./docs/architecture.md)
- [Convenciones del API](./docs/api-conventions.md)
- [ERD provisional](./docs/erd-provisional.md)
- [Despliegue](./docs/deployment.md)
- [Integración Angular](./docs/frontend-integration.md)
- [Microsoft Graph y Excel](./docs/microsoft-graph-excel.md)
- [ADRs](./docs/adr/)
