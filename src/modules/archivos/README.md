# Módulo archivos

Gestiona contratos de almacenamiento y metadatos de adjuntos, separado de la
fuente tabular de datos.

- Health: `GET /api/v1/archivos/health`.

El flujo de carga es multipart (`POST /api/v1/archivos/items`) y almacena la
referencia en `gestion_especifica.url_archivo`. La carga y descarga quedan
temporalmente deshabilitadas con una respuesta 503 hasta que esté disponible el
servidor propio de archivos y se defina su contrato de integración. No se usan
servicios Microsoft para almacenar archivos.

La interfaz `FileStorage` y la inyección desde `postgresArchivosDependencies`
son el punto preparado para integrar ese servidor. Al confirmarse la máquina y
su mecanismo de acceso, se debe implementar un adaptador para ese destino y
configurarlo desde el entorno; no se fija una ruta local ni se habilita una
subida que todavía no pueda persistir el contenido. El despliegue actual corre
como Cloudflare Worker, por lo que no dispone de un disco local persistente.

La operación se identifica mediante `id_gestion_especifica` y
`storageReference` es la referencia opaca real del archivo almacenado.
