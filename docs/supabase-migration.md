# Migración a Supabase PostgreSQL

El backend usa `pg` con SQL parametrizado y una sesión de pool por solicitud de
Cloudflare Worker. `src/infrastructure/persistence/postgres/connection.ts` es el
único punto de conexión; los repositorios reciben `SqlExecutor` y no construyen
SQL en controladores.

## Probar localmente

1. Copia `.env.example` a `.env`.
2. Para producción en Cloudflare Workers, crea un Hyperdrive apuntando a la
   cadena de Supabase y agrega el binding `HYPERDRIVE` a `wrangler.jsonc`:
   `npx wrangler hyperdrive create gestion-tramites-db` con
   `--connection-string="postgres://..."`. El Worker usará automáticamente
   `env.HYPERDRIVE.connectionString` y Hyperdrive gestionará la conexión TLS.
   Esto evita el certificado no conforme que actualmente entrega el pooler
   compartido de Supabase a la validación TLS estricta de Workers.
3. Para desarrollo local sin Hyperdrive, pega en `DATABASE_URL` la cadena del
   panel **Connect** de Supabase y usa `DATABASE_SSL_MODE=disable`. Esta
   excepción está permitida solo con `APP_ENV=development`; no la uses en
   staging ni producción porque la conexión cliente→pooler no tendrá TLS.
4. Si el certificado de tu entorno lo requiere, pega su PEM en
   `DATABASE_SSL_CA` (los saltos pueden escribirse como `\\n`).
5. Ejecuta `node --env-file=.env --import tsx scripts/check-db.ts`.
6. Ejecuta `npm run dev` y consulta `http://localhost:8787/openapi.json`.

No se registra `DATABASE_URL`, errores de `pg` ni parámetros SQL. En Cloudflare,
configura `AUTH_TOKEN_SECRET` como secreto; las variables de pool pueden ser
variables normales. `DATABASE_URL` solo es necesario cuando no se usa
Hyperdrive.

## Estructura

Antes, los catálogos vivían en `src/modules/catalogos` y los adaptadores leían
Excel/Graph:

```text
catalogos/{domain,application,http,infrastructure}
identidad/{domain,application,http,infrastructure}
gestiones/{domain,application,http,infrastructure}
bitacora/{domain,application,http,infrastructure}
```

Ahora cada catálogo es un módulo del mismo nivel:

```text
infrastructure/persistence/postgres/{config,connection,errors}
modules/
  estaciones/       ambitos/          tipos-gestion/
  antecedentes/     etapas/           gestiones-especificas/
  identidad/       gestiones/       bitacora/
```

`catalogos` permanece como fachada de compatibilidad para sus rutas antiguas.
La ruta `/api/v1/catalogos/type-relations` se retiró y fue reemplazada por
`GET /api/v1/gestiones-especificas/items?managementTypeId=...`.

## Decisiones de contrato

- `version` es `xmin` de PostgreSQL expuesto como número para control optimista;
  no se promete que aumente de uno en uno.
- `usuario` no tiene `activo`, por lo que los usuarios existentes se consideran
  activos. Las contraseñas deben conservar un formato compatible con PBKDF2 del
  backend hasta confirmar el algoritmo de los datos existentes.
- `estacion.name` se devuelve como `null` y `status` como `active`; las escrituras
  con otros valores se rechazan con `422` porque esas columnas no existen.
- `gestion.id` de la API es `gestion.codigo`; `id_gestion` sigue siendo interno.
  El alta usa `modalidad_creacion='principal'` y deriva los datos legales de la
  estación y el nombre del responsable desde las tablas relacionadas.
- Bitácora usa `codigo_externo` como `id`, convierte fecha/hora desde
  `America/Santiago` y deriva autor e iniciales desde `usuario`. Un usuario nulo
  se rechaza con `422`; una fila existente sin código externo se informa como
  conflicto para evitar inventar identificadores.

## Frontend

La auditoría está en [docs/frontend-supabase-audit.md](./frontend-supabase-audit.md).
El frontend revisado no llama al backend: usa mocks y sólo carga
`/data/tramite-catalogos.json`. Por eso la conexión de este repositorio no
activa automáticamente las pantallas Angular; el informe enumera las diferencias
que deben resolverse al crear sus servicios HTTP.
