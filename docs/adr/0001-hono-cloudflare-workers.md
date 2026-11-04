# ADR-0001: Hono sobre Cloudflare Workers

- Estado: aceptado
- Fecha: 2026-11-03

## Contexto

La API debe desplegarse en Cloudflare, mantenerse pequeña y permitir OpenAPI y
pruebas cercanas al runtime productivo.

## Decisión

Usar Hono, `@hono/zod-openapi` y Zod sobre un Worker ES Modules. NestJS y
Containers no se usarán inicialmente.

## Consecuencias

- Bajo overhead y acceso directo a Web APIs/bindings.
- OpenAPI y validación pueden compartir esquemas.
- La modularidad y DI se implementan explícitamente mediante composición y
  puertos.
- Dependencias Node deberán probarse dentro de `workerd`.
