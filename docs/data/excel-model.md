# Modelo tabular provisional para Excel

Estado: esquema propuesto para preparar la implementación. No crea ni modifica
ningún archivo Excel.

## Convenciones

- Un worksheet y una Excel Table por entidad.
- Worksheet en `snake_case`; tabla con prefijo `tbl_`.
- Identificadores y RUT se guardan como texto para evitar conversiones de Excel.
- Fechas: `YYYY-MM-DD`; instantes: ISO 8601 UTC.
- Booleanos: `TRUE`/`FALSE`.
- Toda tabla mutable incluye `version`, entero incrementado en cada escritura.
- Las FK son simuladas: Excel no las exige; repositorios y validadores deben
  verificar existencia y coherencia.
- No almacenar binarios en celdas. `archivo_referencia` es opaca y pertenece al
  contrato del módulo de archivos.

## Hojas y tablas

| Worksheet                | Excel Table                  | Clave                    | Columnas principales                                                                                                                                                |
| ------------------------ | ---------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_schema`                | `tbl_schema`                 | `version`                | `version`, `applied_at`, `checksum`, `description`                                                                                                                  |
| `usuarios`               | `tbl_usuarios`               | `id_usuario`             | `rut`, `contrasena_hash`, nombres, apellidos, correo, teléfono, descripción, rol, organización, activo, `version`                                                   |
| `estaciones`             | `tbl_estaciones`             | `id_estacion`            | nombre, dirección, comuna, concesionario, RUT concesionario, `version`                                                                                              |
| `ambitos_gestion`        | `tbl_ambitos_gestion`        | `codigo_ambito`          | nombre, `version`                                                                                                                                                   |
| `tipos_gestion`          | `tbl_tipos_gestion`          | `id_tipo_gestion`        | nombre, `version`                                                                                                                                                   |
| `tipos_gestion_relacion` | `tbl_tipos_gestion_relacion` | padre + hijo             | `id_tipo_gestion_padre`, `id_tipo_gestion_hijo`, orden, `version`                                                                                                   |
| `antecedentes`           | `tbl_antecedentes`           | `id_antecedente`         | nombre, `version`                                                                                                                                                   |
| `etapas`                 | `tbl_etapas`                 | `id_etapa`               | nombre, porcentaje, orden, `version`                                                                                                                                |
| `gestiones`              | `tbl_gestiones`              | `id_gestion`             | estación, tipo, ámbito, usuario responsable, nivel, correlativo, fechas, prioridad, solicitante, estado provisional, `version`                                      |
| `antecedentes_gestion`   | `tbl_antecedentes_gestion`   | `id_antecedente_gestion` | gestión, antecedente padre, tipo propio, antecedente de catálogo, nivel, obligatorio, usuario responsable, estado, referencia de archivo, fecha de carga, `version` |
| `etapas_gestion`         | `tbl_etapas_gestion`         | `id_etapa_gestion`       | gestión, etapa, estado, fechas, responsable pendiente, observaciones, `version`                                                                                     |
| `entradas_bitacora`      | `tbl_entradas_bitacora`      | `id_entrada_bitacora`    | gestión, usuario, timestamp, autor mostrado, iniciales, tipo, título, comentario, automática, `version`                                                             |
| `archivos`               | `tbl_archivos`               | `id_archivo`             | gestión, antecedente de gestión, proveedor, referencia, nombre, MIME, tamaño, usuario de carga, timestamp, `version`                                                |

La fila `usuarios` reproduce el esquema conceptual del PNG, pero **no aprueba
guardar hashes de contraseña en un workbook compartido**. Aunque un hash no sea
la contraseña en texto plano, sigue siendo material de autenticación sensible.
Antes de implementar identidad se deberá decidir un almacén restringido para
credenciales —por ejemplo D1 u otro servicio administrado— y dejar en Excel, a
lo sumo, el perfil no secreto y un identificador. El puerto `UserRepository`
permite tomar esa decisión sin cambiar el dominio.

`tipos_gestion_relacion` es una extensión confirmada al PNG: permite que un
tipo inferior se reutilice bajo varios tipos superiores. La aplicación debe
rechazar pares padre=hijo y ciclos.

## Relaciones obligatorias confirmadas

- Una gestión tiene un tipo principal y un usuario responsable interno.
- Cada `antecedentes_gestion` pertenece a una gestión.
- Cada `antecedentes_gestion` tiene un antecedente de catálogo obligatorio.
- Cada `antecedentes_gestion` tiene su propio tipo de gestión, que puede diferir
  del tipo de la gestión principal.
- El padre opcional de `antecedentes_gestion` apunta a otra fila de la misma
  tabla y de la misma gestión.
- El responsable de `antecedentes_gestion` es un usuario interno.
- La semántica del responsable de `etapas_gestion` sigue pendiente.

## Versionado estructural

1. La fila activa de `_schema` contiene un entero de versión y checksum de las
   columnas esperadas.
2. La aplicación rechaza iniciar el adaptador si la versión no está soportada.
3. Cada cambio estructural lleva un documento/migración idempotente y una copia
   de respaldo del workbook.
4. Primero se agregan columnas compatibles; los renombres/eliminaciones se hacen
   en una versión posterior después de migrar datos.
5. CI valida mappers contra fixtures tabulares, no contra datos reales de Copec.

## Concurrencia

El campo `version` permite compare-and-set lógico: una actualización incluye la
versión leída y falla con conflicto si cambió. Excel no ofrece una transacción
relacional entre tablas; operaciones de varias filas deben ser pequeñas,
idempotentes y registrar su resultado en bitácora cuando se implemente lógica.

No se promete atomicidad entre hojas. Si un caso de uso la requiere, será una
señal para migrarlo a SQL o introducir coordinación explícita.
