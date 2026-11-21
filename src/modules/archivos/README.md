# Módulo archivos

Gestiona contratos de almacenamiento y metadatos de adjuntos, separado de la
fuente tabular de datos.

- Health: `GET /api/v1/archivos/health`.

El flujo actual de carga es multipart (`POST /api/v1/archivos/items`), guarda
la referencia en `gestion_especifica.url_archivo`, almacena el contenido en OneDrive y permite
descargarlo mediante `GET /api/v1/archivos/items/{id}/download`. La decisión
sobre validación de extensiones/MIME, límite de 10 MB, preview y reemplazo
transaccional queda pendiente; por ahora no se modifica ese flujo.

La operación se identifica mediante `id_gestion_especifica` y
`storageReference` es la referencia opaca real del archivo almacenado.
