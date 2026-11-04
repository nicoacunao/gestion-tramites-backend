# Integración con Angular

## Estado actual del frontend

El frontend usa mocks, estado local y un JSON estático. No tiene URL base de API,
interceptor, guards ni autenticación real.

## CORS

`CORS_ORIGINS` acepta una lista separada por comas.

- Desarrollo: `http://localhost:4200`.
- Staging y producción: reemplazar los dominios `.invalid` de `wrangler.jsonc`
  antes de desplegar.
- No usar `*` cuando exista autenticación.
- Métodos y headers permitidos se centralizan en middleware.

## Autenticación

Se mantendrá login local RUT/contraseña. La integración futura requerirá:

1. Cliente de autenticación Angular.
2. Interceptor para adjuntar la sesión/token elegido.
3. Guard de rutas internas.
4. Manejo central de `401`/`403`.

No se modifica el frontend durante esta fase y no se define todavía si la sesión
usará cookie segura o bearer token; esa elección pertenece al ADR de seguridad.

## Cliente tipado

OpenAPI es la fuente de verdad. Después de implementar contratos reales se podrá
generar un cliente Angular sin compartir directamente clases internas:

```bash
npx @openapitools/openapi-generator-cli generate \
  -i ../gestion-tramites-backend/openapi/openapi.json \
  -g typescript-angular \
  -o src/app/api/generated
```

Este comando debe ejecutarse desde el repositorio frontend y revisar el diff; el
backend no escribe en el proyecto vecino automáticamente.

Los tipos realmente compartidos son los esquemas OpenAPI. Compartir un paquete
TypeScript fuente entre front y backend queda como alternativa futura, pero no
debe reemplazar la validación runtime.

## Migración desde mocks

Orden sugerido:

1. Configuración de URL base por entorno.
2. Catálogos.
3. Listado/detalle de gestiones.
4. Creación/modificación.
5. Bitácora y archivos.
6. Resúmenes por estación.
7. Retiro progresivo de `TramitesMock` y JSON estático.
