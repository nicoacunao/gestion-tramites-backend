# Auditoría de frontend, backend inicial y esquema Supabase

Fecha de revisión: 6 de noviembre de 2026 (America/Santiago).

## Alcance y evidencia

Se verificó el repositorio remoto con el conector GitHub y se revisó su checkout
local en modo lectura. Ambos apuntaban al commit
[`cc6cde488497c7ecdafc19230779a484d6682541`](https://github.com/nicoacunao/gestion-tramites-frontend/commit/cc6cde488497c7ecdafc19230779a484d6682541).
El checkout tenía cambios ajenos en `angular.json` y archivos SQL sin seguimiento;
no se modificaron ni se usaron esos SQL como fuente de verdad. El esquema de
referencia fue exclusivamente el SQL adjuntado en esta conversación.

Las rutas y DTO del apartado «backend inicial» describen el estado anterior a
esta migración. No constituyen una propuesta de conservar campos inexistentes en
PostgreSQL. Las propuestas siguientes no equivalen a cambios implementados en el
frontend.

## Solicitudes realmente realizadas por el frontend

| Método y recurso                   | Parámetros / cuerpo | Respuesta esperada                                                                                            | Resultado de la revisión                                                        |
| ---------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `GET /data/tramite-catalogos.json` | Ninguno             | Objeto directo con `estacionesServicio`, `prioridades`, `responsables`, `tiposTramite`; sin envoltorio `data` | Es un archivo de `public/` servido por el frontend, no un endpoint del backend. |

La llamada está en
[`tramite-nuevo.ts:482`](https://github.com/nicoacunao/gestion-tramites-frontend/blob/cc6cde488497c7ecdafc19230779a484d6682541/src/app/features/tramites/pages/tramite-nuevo/tramite-nuevo.ts#L482).
Se buscaron `HttpClient`, `fetch`, `axios`, URLs, métodos HTTP, `health`, tokens,
`localStorage` y `sessionStorage` en las fuentes. No hay llamadas a `/api/v1`, ni
consumo de `health`, ni persistencia en almacenamiento del navegador.

Las demás operaciones son simulaciones en memoria:

- Login: [`login.ts:102`](https://github.com/nicoacunao/gestion-tramites-frontend/blob/cc6cde488497c7ecdafc19230779a484d6682541/src/app/features/login/login.ts#L102)
  emite `{ rut, password }` y navega a `/home` sin autenticar por HTTP.
- Usuario y edición de perfil: [`user-session.ts`](https://github.com/nicoacunao/gestion-tramites-frontend/blob/cc6cde488497c7ecdafc19230779a484d6682541/src/app/shared/services/user-session.ts)
  mantiene una señal con datos de demostración.
- Consulta y guardado de trámites: [`tramites-mock.ts`](https://github.com/nicoacunao/gestion-tramites-frontend/blob/cc6cde488497c7ecdafc19230779a484d6682541/src/app/features/tramites/services/tramites-mock.ts)
  mantiene un arreglo; `guardar()` inserta o reemplaza por ID.
- Edición de antecedentes y etapas: [`tramite-detalle.ts:411`](https://github.com/nicoacunao/gestion-tramites-frontend/blob/cc6cde488497c7ecdafc19230779a484d6682541/src/app/features/tramite-detalle/tramite-detalle.ts#L411)
  vuelve a guardar en ese mock.
- Bitácora: [`bitacora.ts:42`](https://github.com/nicoacunao/gestion-tramites-frontend/blob/cc6cde488497c7ecdafc19230779a484d6682541/src/app/features/bitacora/bitacora.ts#L42)
  y el detalle mantienen `Map` locales; el panel emite eventos.
- Archivos: se conserva el objeto `File` o su nombre; los controles usan
  `customUpload` y no tienen una operación HTTP de almacenamiento.
- Resumen de estaciones: [`estado-estaciones.ts:106`](https://github.com/nicoacunao/gestion-tramites-frontend/blob/cc6cde488497c7ecdafc19230779a484d6682541/src/app/features/tramites/pages/estado-estaciones/estado-estaciones.ts#L106)
  construye los indicadores con datos locales.

Por tanto, no hay endpoints de negocio consumidos por el frontend cuya
compatibilidad de extremo a extremo pueda declararse comprobada. Conectar el
backend a PostgreSQL no conecta automáticamente estas pantallas.

## Inventario del backend inicial

Todos los endpoints de negocio iniciales devuelven `{ data, meta: { requestId } }`.
Los errores gestionados por la aplicación usan `{ error, meta }`.

| Operación            | Ruta inicial                                                                                      | Contrato relevante                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Login                | `POST /api/v1/identidad/login`                                                                    | `{ rut, password }` → token, vencimiento y usuario parcial.                                  |
| Estaciones           | `GET`, `POST /api/v1/catalogos/items`; `GET`, `PUT /api/v1/catalogos/items/{id}`                  | Filtros `eds`, `commune`, `status`, `legalName`; DTO en inglés; actualización con `version`. |
| Catálogos            | `GET /api/v1/catalogos/scopes`, `/management-types`, `/type-relations`, `/backgrounds`, `/stages` | Listas planas, no el JSON anidado del frontend.                                              |
| Gestiones            | `GET`, `POST /api/v1/gestiones/items`; `GET`, `PUT /api/v1/gestiones/items/{id}`                  | DTO en inglés; ID aportado por cliente; actualización con `version`.                         |
| Bitácora             | `GET`, `POST /api/v1/bitacora/items`; `GET /api/v1/bitacora/items/{id}`                           | Listado exige `managementId`; escritura incluye fecha y hora separadas.                      |
| Archivos y consultas | Solo `/health`                                                                                    | No hay endpoints funcionales de archivos, estadísticas o consultas agregadas.                |

## Diferencias detectadas y soluciones propuestas

| Área                        | Diferencia comprobada                                                                                                                                                                                                                                                                                                                            | Propuesta que requiere acordar el contrato                                                                                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integración HTTP            | El frontend no tiene servicios de API ni interceptor de autenticación.                                                                                                                                                                                                                                                                           | Crear servicios Angular que consuman los módulos independientes, extraigan `data` y presenten errores. Reemplazar los mocks progresivamente.                                                                                                              |
| Login y perfil              | La pantalla elimina puntuación del RUT; el backend inicial compara texto. La respuesta no incluye teléfono, descripción ni organización usados por `ConnectedUser`. El perfil solo se edita en memoria.                                                                                                                                          | Normalizar el RUT de forma consistente, derivar nombre completo/iniciales de nombres y apellidos, acordar lectura/edición de perfil y campos devueltos.                                                                                                   |
| Contraseñas                 | `usuario.contrasena_hash` no especifica algoritmo. El backend existente solo verifica `pbkdf2-sha256$iteraciones$sal$hash`.                                                                                                                                                                                                                      | Confirmar el formato de los hashes existentes antes de cambiar el verificador o añadir una dependencia. No interpretar la tabla `usuario` como Supabase Auth.                                                                                             |
| Autorización                | Catálogos y gestiones inicialmente confían en `x-role` enviado por el cliente (`indagación` y `gestiones`); bitácora no aplica autorización. El rol de demostración del frontend es `Gestor de trámites`.                                                                                                                                        | Acordar permisos reales; validar la sesión en backend y derivar permisos desde `usuario.rol`. No introducir un interceptor que fabrique `x-role` como solución de seguridad.                                                                              |
| Campos sin respaldo         | Los DTO iniciales exigen `version`; la BD no tiene esa columna. `usuario.activo` tampoco existe.                                                                                                                                                                                                                                                 | Acordar retirar esos campos o una estrategia explícita de concurrencia/activación. No inventar columnas, versiones constantes ni usuarios activos silenciosamente.                                                                                        |
| Estaciones                  | Front usa `codigo`, `nombre`, `concesionario`, `rut`; backend inicial usa `id`, `name`, `legalName`, `companyRut`. BD no tiene `nombre` ni `estado` de estación; jefes, RUT y representante son nullable aunque DTO inicial los exige.                                                                                                           | Mapear `codigo → id_estacion`, `concesionario → razon_social`, `rut → rut_sociedad`; acordar etiqueta visual derivada o cambio de BD para nombre. Distinguir estado calculado de gestiones del inexistente estado persistido de estación. Respetar nulls. |
| Tipos y segundo nivel       | Front espera tipos con `segundoNivelLabel`, booleano y `tramitesEspecificos[]`; backend inicial solo devuelve ID/nombre. La relación padre/hijo de tipos inicial no existe en el nuevo esquema.                                                                                                                                                  | Usar `tipo_gestion`, `gestion_especifica` y `gestion_especifica_antecedente`; componer el objeto en un adaptador del frontend o acordar una respuesta agregada. No equiparar `type-relations` a gestiones específicas.                                    |
| Identificadores de catálogo | IDs específicos del JSON son códigos de texto; `gestion_especifica.id_gestion_especifica` es identity BIGINT y `codigo` es otro campo único. Antecedentes se referencian por nombre en el frontend.                                                                                                                                              | Mantener separados ID y código; cargar IDs desde catálogos y enviar los IDs de las relaciones. Evitar resolver relaciones solo por textos visibles.                                                                                                       |
| Alta de gestión             | Front guarda un ID numérico fijo `1006`, etiquetas en vez de IDs, fechas de presentación y valores `Sin especificar`. Backend inicial acepta `id`, exige `responsibleUserId`, omite `codigo`, `modalidad_creacion`, `responsable_nombre` y `razon_social`, y permite estado null. BD genera ID, exige esos campos y permite responsable FK null. | Definir un DTO de alta ajustado a BD, devolver el ID generado como cadena para preservar BIGINT, validar campos obligatorios y eliminar valores de relleno inválidos. Separar responsable nominal de usuario opcional.                                    |
| Códigos y correlativos      | Escritorio calcula correlativo por nivel al renderizar; Todas las gestiones usa otro mapa y fallback `N1-OTR-ID`. BD exige unicidad `(nivel, codigo_ambito, correlativo)` y `codigo`.                                                                                                                                                            | Acordar quién determina ámbito/nivel y el formato de código; asignar correlativos en una transacción con control de concurrencia. No persistir numeración recalculada en el navegador.                                                                    |
| Fechas                      | Front maneja `DD-MM-YYYY`, `DD/MM/YYYY`, `—` y `Sin especificar`; API inicial espera `YYYY-MM-DD`. Bitácora maneja fecha/hora de America/Santiago; BD almacena un `TIMESTAMPTZ`.                                                                                                                                                                 | API con fechas ISO y null; presentación localizada solo en UI. Para bitácora, enviar un timestamp con zona o usar la hora del servidor y mostrarlo en America/Santiago.                                                                                   |
| Etapas                      | UI permite editar fechas sin validar `fecha_real >= fecha_estimada`; BD sí lo exige. UI también aplica progresión secuencial, regla que no está en los CHECK de BD.                                                                                                                                                                              | Confirmar si se debe impedir terminar antes de la fecha estimada; si se mantiene el esquema, validar esa restricción en UI/API. Acordar si la secuencia de etapas también es regla del servidor.                                                          |
| Detalle de gestión          | Front edita antecedentes jerárquicos y etapas; los routers iniciales no tienen endpoints para `antecedente_gestion` ni `etapa_gestion`.                                                                                                                                                                                                          | Diseñar operaciones de detalle y guardado transaccional con IDs de catálogo, categorías, padres y fechas correctos; validar que padres y relaciones pertenezcan a la gestión.                                                                             |
| Campos adicionales          | JSON tiene `datosAdicionales` por tipo; la interfaz de catálogo del componente no los modela y guarda `nombreConcesionario` sin código de catálogo verificado.                                                                                                                                                                                   | Consumir `campo_adicional_tipo` y `opcion_campo_adicional`; validar requerido/opción/tipo y guardar por `id_campo_adicional` en `gestion_dato_adicional`.                                                                                                 |
| Principal y subtrámites     | Front guarda `subtramitesAsociados: string[]`; BD tiene una gestión específica opcional, sin relación padre/hijo entre filas de `gestion`.                                                                                                                                                                                                       | Confirmar si la lista se deriva del catálogo para un trámite principal o si se necesitan gestiones hijas persistidas. El segundo caso requiere revisar el modelo, no crear tablas automáticamente.                                                        |
| Bitácora                    | Front tiene autor, iniciales, tipo, automática e ID `BIT-…`; DTO inicial no incluye esos metadatos, aunque BD exige autor e iniciales.                                                                                                                                                                                                           | Usar identity como ID interno y, si corresponde, `codigo_externo` para ID cliente; completar autor desde la sesión y conservar tipo/automática. Acordar el contrato de timestamp.                                                                         |
| Archivos                    | Front conserva nombres locales. BD solo almacena nombre, referencia y metadatos, no bytes.                                                                                                                                                                                                                                                       | Acordar almacenamiento de objetos y operaciones upload/download; persistir referencia y fecha real de carga. No afirmar que seleccionar un archivo lo subió.                                                                                              |
| Resúmenes y semáforos       | Front usa datos de ejemplo y reglas locales; backend no ofrece esas consultas.                                                                                                                                                                                                                                                                   | Acordar definición de activo/pendiente/último avance y generar consultas sobre las tablas existentes. No crear tablas de resumen sin necesidad.                                                                                                           |

Los valores de estado de gestión, antecedente y etapa declarados en
`src/app/features/tramites/models/estado-tramite.ts` coinciden con los CHECK del
SQL. Las prioridades válidas también coinciden (`Alta`, `Media`, `Baja`);
`Sin prioridad` es una etiqueta del resumen de estaciones, no una prioridad válida
para insertar en `gestion`.

## Dependencias de health

El frontend revisado no llama a health. El backend inicial sí registra seis
rutas `/api/v1/{modulo}/health`, importa los routers desde los módulos y contiene
tests que los requieren (`tests/modules-health.test.ts`,
`tests/openapi.test.ts`). `archivos` y `consultas` exportan directamente sus
routers de health como módulo completo. README y documentación los referencian.

El workflow versionado de CI/CD despliega Cloudflare Workers y no configura una
sonda HTTP health; no se inspeccionaron servicios externos de monitoreo ni el
panel del proveedor. La ausencia de una sonda en Git no demuestra que no exista
un consumidor externo.

Según la instrucción del usuario, estas dependencias impiden eliminar health sin
avisar y acordar su tratamiento. No se debe borrar la carpeta y dejar imports
rotos ni eliminar los tests como si fueran la única dependencia.
