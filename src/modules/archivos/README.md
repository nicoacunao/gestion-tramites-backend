# Módulo archivos

Gestiona contratos de almacenamiento y metadatos de adjuntos, separado de la
fuente tabular de datos.

- Health: `GET /api/v1/archivos/health`.

El flujo de carga es multipart (`POST /api/v1/archivos/items`) y almacena la
referencia en `gestion_especifica.url_archivo`. La carga y descarga quedan
temporalmente deshabilitadas con una respuesta 503 hasta que esté disponible el
servidor propio de archivos y se defina su contrato de integración. No se usan
servicios Microsoft para almacenar archivos.

La operación se identifica mediante `id_gestion_especifica` y
`storageReference` es la referencia opaca real del archivo almacenado.
