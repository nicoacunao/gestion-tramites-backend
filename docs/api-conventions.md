# Convenciones del API

## Versionado y nombres

- Prefijo: `/api/v1`.
- Recursos y rutas en español, minúsculas y kebab-case cuando corresponda.
- JSON en `camelCase` para alinearse con TypeScript/Angular.
- Identificadores se exponen como strings opacos, aunque una fuente use números.
- Fechas sin hora: `YYYY-MM-DD`.
- Instantes: ISO 8601 UTC, por ejemplo `2026-11-03T18:30:00Z`.

## Respuesta simple

```json
{
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

## Colecciones y paginación

La convención prevista es paginación basada en página mientras Excel sea la
fuente, por simplicidad para el volumen esperado:

```json
{
  "data": [],
  "meta": {
    "requestId": "...",
    "page": 1,
    "pageSize": 25,
    "total": 0,
    "totalPages": 0
  }
}
```

Parámetros comunes: `page`, `pageSize`, `sort`, `order` y filtros declarados por
endpoint. `pageSize` tendrá un máximo documentado cuando se implementen rutas.

## Errores

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "El recurso solicitado no existe.",
    "details": {}
  },
  "meta": {
    "requestId": "..."
  }
}
```

- `code` es estable y apto para lógica del cliente.
- `message` es seguro para mostrar; no contiene secretos ni stack traces.
- `details` es opcional y se usa para errores de validación.
- En importaciones tabulares, `details.errors` contiene la fila y el motivo de
  cada error, y `message` incluye un resumen seguro para mostrar directamente
  en la interfaz. El cliente debe conservar ambos valores.
- `x-request-id` se acepta o genera y siempre se devuelve.

## Estados HTTP

- `200`: lectura/actualización exitosa.
- `201`: creación.
- `204`: eliminación sin cuerpo.
- `400`: request malformado.
- `401`: no autenticado.
- `403`: autenticado sin permiso.
- `404`: recurso inexistente.
- `409`: conflicto de versión/concurrencia.
- `422`: validación semántica.
- `429`: límite de solicitudes.
- `500`: error inesperado.
- `503`: dependencia no disponible o capacidad aún no configurada.

## OpenAPI

Los esquemas de rutas son la fuente de verdad. `openapi/openapi.json` es un
artefacto generado y CI falla si queda desactualizado.
