# Microsoft Graph y Excel

## Resultado de compatibilidad

La propuesta original de usar `client_credentials` directamente contra Excel
Workbook API **no es compatible con las operaciones verificadas**.

Microsoft documenta para `workbook/createSession`, lectura de worksheets y
actualización de worksheets:

- Delegated (work or school): `Files.ReadWrite`.
- Application: `Not supported`.

Fuentes oficiales:

- [Create session](https://learn.microsoft.com/en-us/graph/api/workbook-createsession?view=graph-rest-1.0)
- [Get worksheet](https://learn.microsoft.com/en-us/graph/api/worksheet-get?view=graph-rest-1.0)
- [Update worksheet](https://learn.microsoft.com/en-us/graph/api/worksheet-update?view=graph-rest-1.0)
- [Working with Excel in Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/resources/excel?view=graph-rest-1.0)

La app registration sigue siendo necesaria, pero un token app-only obtenido con
`client_credentials` no habilita esas operaciones de workbook.

## Consecuencia para este proyecto

La autenticación local RUT/contraseña de la plataforma no crea una identidad
Microsoft delegada. Son dos decisiones independientes. Para usar Workbook API
se necesitaría un consentimiento Microsoft adicional y contexto delegado.

`MicrosoftGraphWorkbookDataSource` queda deliberadamente deshabilitado y
`GRAPH_AUTH_MODE=disabled`. No se guardan secretos ni refresh tokens reales.

## Alternativas por decidir

### A. OAuth delegado con cuenta de servicio Microsoft 365

- Authorization Code una vez y posterior renovación con refresh token.
- Permiso delegado mínimo `Files.ReadWrite` sobre una cuenta que tenga acceso al
  archivo.
- Secretos y refresh token almacenados como secretos de Cloudflare.
- Permite Workbook API y sesiones persistentes.

Riesgos: dependencia de una cuenta, consentimiento, expiración/revocación del
refresh token y operación adicional. No debe implementarse sin aprobación de
seguridad.

### B. Descargar y reemplazar el archivo completo con permisos de aplicación

Drive API sí admite permisos de aplicación para descargar y reemplazar el
contenido de un `driveItem`. Se podría usar `client_credentials`, descargar el
`.xlsx`, editarlo con una librería compatible con Workers y volver a subirlo.

- [Descargar contenido](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0)
- [Reemplazar contenido](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0)
- [Permisos seleccionados](https://learn.microsoft.com/en-us/graph/permissions-selected-overview)

Debe preferirse acceso seleccionado al archivo/sitio cuando sea viable, en vez
de permisos amplios como `Files.ReadWrite.All`. Esta alternativa aumenta CPU,
memoria, latencia y riesgo de sobrescritura concurrente; no está seleccionada.

### C. Fuente distinta

Mover el almacenamiento operacional a SQL/D1 o exponer Excel mediante un
servicio intermedio autorizado. Los puertos actuales permiten hacerlo sin
reescribir servicios de aplicación.

## Compatibilidad con Workers

La comunicación OAuth y Graph usa HTTPS, `fetch` y Web Crypto, disponibles en
Workers. No se necesita el SDK de Graph. Los secretos se configuran con
`wrangler secret`, nunca como `vars` o archivos versionados.

## Sesiones, concurrencia y errores

Si se aprueba Workbook API delegado:

- Usar sesión persistente durante una unidad corta de trabajo para reducir
  latencia.
- No compartir sesiones entre solicitudes concurrentes.
- Reintentar solo errores transitorios documentados; recrear sesiones inválidas
  cuando corresponda.
- Tratar conflictos y bloqueos como errores explícitos, no como reintentos
  infinitos.

Microsoft Graph devuelve `429` con `Retry-After`; se debe respetar ese valor y
usar backoff exponencial cuando falte. Fuente:
[guía de throttling](https://learn.microsoft.com/en-us/graph/throttling).

## Mitigaciones proporcionadas al volumen esperado

- Cache API o KV para catálogos de lectura frecuente con TTL corto.
- Lecturas agrupadas por tabla, evitando una llamada por fila.
- Campo `version` por fila para bloqueo optimista en la capa de aplicación.
- Escrituras serializadas por libro si aparecen conflictos recurrentes; un
  Durable Object es una opción futura, no parte del esqueleto.
- Métricas de latencia, 429, conflictos y recreación de sesiones antes de
  optimizar.
