# Gestión de Trámites — Backend

Esqueleto de un monolito modular TypeScript para Cloudflare Workers. Esta fase
define arquitectura, contratos y configuración; no implementa lógica de negocio
ni endpoints funcionales aparte de health checks.

## Stack

- Cloudflare Workers + Wrangler.
- Hono y `@hono/zod-openapi`.
- Zod para contratos y validación futura.
- Vitest ejecutado dentro de `workerd` mediante el plugin oficial de Cloudflare.
- ESLint, Prettier, dependency-cruiser, Husky y lint-staged.

## Requisitos

- Node.js 22.13 o superior recomendado.
- npm 11 o superior.
- Cuenta Cloudflare solo para despliegues.

## Inicio rápido

```bash
npm install
cp .dev.vars.example .dev.vars
npm run types:bindings
npm run dev
```

El Worker local queda disponible normalmente en `http://localhost:8787`.

```bash
curl http://localhost:8787/api/v1/gestiones/health
```

## Comandos

| Comando                    | Uso                                  |
| -------------------------- | ------------------------------------ |
| `npm run dev`              | desarrollo local con Wrangler        |
| `npm run typecheck`        | TypeScript estricto                  |
| `npm run lint`             | lint del código                      |
| `npm run boundaries`       | límites y ciclos entre capas/módulos |
| `npm run format`           | verifica formato                     |
| `npm test`                 | pruebas dentro del runtime Workers   |
| `npm run build`            | build dry-run de Cloudflare          |
| `npm run openapi:generate` | regenera `openapi/openapi.json`      |
| `npm run check`            | cadena completa de calidad           |

## Módulos

- `identidad`: usuarios internos y contratos de autenticación local.
- `catalogos`: estaciones, ámbitos, tipos, relaciones entre tipos,
  antecedentes y etapas de catálogo.
- `gestiones`: gestión, antecedentes jerárquicos y ejecución de etapas.
- `archivos`: metadatos y contratos de almacenamiento.
- `bitacora`: historial manual y automático.
- `consultas`: modelos de lectura para listados y resúmenes.

Cada módulo expone únicamente su `index.ts`. Consulta
[la arquitectura](./docs/architecture.md) y
[las opciones aprobadas](./docs/module-options.md).

## Contrato HTTP

OpenAPI se publica en `/openapi.json` y se versiona como
[`openapi/openapi.json`](./openapi/openapi.json). En esta fase solo contiene:

- `GET /api/v1/identidad/health`
- `GET /api/v1/catalogos/health`
- `GET /api/v1/gestiones/health`
- `GET /api/v1/archivos/health`
- `GET /api/v1/bitacora/health`
- `GET /api/v1/consultas/health`

## Configuración y secretos

Las variables no secretas están en `wrangler.jsonc`. Los secretos nunca se
guardan en Git:

```bash
npx wrangler secret put AUTH_TOKEN_SECRET --env production
```

Repite el comando para cualquier secreto Graph cuando se apruebe una estrategia
OAuth compatible. Consulta [despliegue](./docs/deployment.md).

## Estado de Excel/Graph

El puerto tabular y los repositorios placeholder están creados, pero el
adaptador Graph está deshabilitado. Microsoft declara que Excel Workbook API no
soporta permisos de aplicación en las operaciones verificadas, por lo que
`client_credentials` no puede usarse directamente para hojas y tablas. Consulta
[Microsoft Graph y Excel](./docs/microsoft-graph-excel.md).

## Documentación

- [ERD provisional](./docs/erd-provisional.md)
- [Arquitectura y módulos](./docs/architecture.md)
- [Convenciones del API](./docs/api-conventions.md)
- [Modelo Excel](./docs/data/excel-model.md)
- [Integración Angular](./docs/frontend-integration.md)
- [Despliegue](./docs/deployment.md)
- [Próximos pasos](./docs/next-steps.md)
- [ADRs](./docs/adr/)
