# Módulo archivos

Gestiona contratos de almacenamiento y metadatos de adjuntos, separado de la
fuente tabular de datos.

- Health: `GET /api/v1/archivos/health`.

El flujo actual de carga es multipart (`POST /api/v1/archivos/items`), guarda
metadatos en `archivo_gestion`, almacena el contenido en OneDrive y permite
descargarlo mediante `GET /api/v1/archivos/items/{id}/download`. La decisión
sobre validación de extensiones/MIME, límite de 10 MB, preview y reemplazo
transaccional queda pendiente; por ahora no se modifica ese flujo.

`fileName` es el nombre visible y `storageReference` es la referencia opaca
real del archivo almacenado.
