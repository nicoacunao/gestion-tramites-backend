# Despliegue en Cloudflare

## Entornos

`wrangler.jsonc` define:

- default: desarrollo.
- `staging`: `gestion-tramites-api-staging`.
- `production`: `gestion-tramites-api`.

Los nombres y dominios son operacionales y pueden ajustarse antes del primer
despliegue. Los dominios `.invalid` son marcadores deliberados; no representan
dominios de Copec.

## Variables y secretos

Variables no secretas se configuran en `vars`. Antes de staging/producción:

1. Sustituir `CORS_ORIGINS` por el dominio real del frontend.
2. Mantener `DATA_ADAPTER=placeholder` hasta aprobar persistencia.
3. Mantener `GRAPH_AUTH_MODE=disabled` hasta resolver OAuth.

Secretos:

```bash
npx wrangler secret put AUTH_TOKEN_SECRET --env staging
npx wrangler secret put AUTH_TOKEN_SECRET --env production
```

Los secretos Graph solo se agregan si se aprueba el flujo delegado. Nunca se
guardan en `wrangler.jsonc`, `.env` ni GitHub Actions.

## Comandos

```bash
npm run build
npm run deploy -- --env staging
npm run deploy -- --env production
```

Para dominio propio, configurar Custom Domain en Cloudflare o `routes` en
Wrangler una vez conocido el hostname. No se inventa una ruta en este esqueleto.

## CI/CD

`.github/workflows/ci.yml` ejecuta tipos, lint, límites, formato, pruebas, build y
verificación de OpenAPI.

El deploy desde `main` solo se activa cuando:

- Variable GitHub `CLOUDFLARE_DEPLOY_ENABLED=true`.
- Secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` están configurados.
- El environment `production` permite el despliegue.

El token debe tener el mínimo permiso necesario para desplegar Workers.

## Rollback y observabilidad

- Wrangler/Cloudflare conserva versiones para rollback.
- `upload_source_maps` y observabilidad están habilitados.
- Los logs son JSON y usan `requestId`; no registrar contraseñas, tokens, RUT
  completos ni contenido de archivos.
