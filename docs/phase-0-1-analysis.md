# Fase de análisis: frontend, modelo de datos y stack

Fecha de revisión: 2026-11-03  
Estado: análisis y recomendación aprobados; sirvieron de base para el esqueleto
actual.

## 1. Frontend Angular revisado

### Situación actual

- Aplicación standalone en Angular 21, TypeScript 5.9 y RxJS 7.8.
- `provideHttpClient()` está configurado, pero no existe todavía un cliente de
  API, URL base, environments, proxy, interceptores ni manejo HTTP común.
- La única lectura HTTP es un JSON estático local:
  `/data/tramite-catalogos.json`.
- Las gestiones se leen y modifican con `TramitesMock`, un servicio en memoria.
  Las bitácoras y el perfil del usuario también viven en memoria.
- No se encontró MSAL, OIDC, JWT, guards de rutas ni interceptores de
  autorización. El login valida formato de RUT y contraseña requerida, emite el
  formulario y navega a `/home` sin autenticar contra un servidor.
- El cierre de sesión solo navega a `/login`. Las rutas internas no están
  protegidas.
- El perfil conectado está hardcodeado en `UserSessionService` y permite editar
  nombre, correo, teléfono y descripción solo durante la sesión del navegador.

### Rutas y flujos observados

| Ruta                          | Necesidad de backend inferida                              |
| ----------------------------- | ---------------------------------------------------------- |
| `/login`                      | autenticación/sesión o inicio OIDC; perfil actual          |
| `/home`                       | perfil editable, accesos rápidos y tareas/resúmenes        |
| `/escritorio`                 | gestiones asignadas al usuario actual                      |
| `/todas-las-gestiones`        | listado global con filtros, búsqueda, orden y paginación   |
| `/tramites/nuevo`             | catálogos y creación de una gestión completa o subtrámite  |
| `/tramites/:id/modificar`     | lectura y actualización de cabecera, antecedentes y etapas |
| detalle lateral de trámite    | detalle, adjuntos, bitácora y registro de última revisión  |
| `/tramites/estado-estaciones` | resumen agregado de gestiones por estación                 |

### Contratos funcionales que el frontend ya presupone

1. **Gestiones**: listar por alcance (propias/todas), obtener detalle, crear y
   actualizar. El listado necesita filtros por código, estación, comuna, razón
   social, responsable, semáforo y fecha; también paginación y orden.
2. **Catálogos**: estaciones, prioridades, estados, responsables/solicitantes,
   tipos de gestión, gestiones específicas, antecedentes requeridos, etapas y
   campos adicionales dinámicos de tipo texto o selección.
3. **Jerarquía**: niveles `N1` a `N4`; la UI distingue gestión principal y
   subtrámite, y antecedentes con padre opcional.
4. **Antecedentes/adjuntos**: requeridos, complementarios y adicionales;
   obligatoriedad, responsable, estado, observaciones, fecha y archivo. La UI
   limita el archivo a 10 MB, pero todavía no define persistencia ni descarga.
5. **Etapas**: catálogo ordenado, porcentaje, estado, fechas, responsable y
   observación. La UI deriva el porcentaje actual desde las etapas.
6. **Bitácora**: listar y agregar entradas; fecha/hora, autor, iniciales, tipo,
   título, comentario y marca automática.
7. **Usuarios**: usuario actual y edición de perfil. Aunque los mocks muestran
   etiquetas como “Concesionario” y “Oficina técnica”, se confirmó que los
   responsables de gestiones y antecedentes serán usuarios internos. El caso de
   etapas sigue pendiente.
8. **Resumen por estación**: activos, pendientes, prioridad, días sin avance,
   estado general y semáforo. Conviene decidir qué valores se calculan en
   backend y cuáles son meramente de presentación.

### Observaciones contractuales

- Las fechas se manejan hoy como strings `DD-MM-YYYY` o `DD/MM/YYYY`. El API
  debería usar ISO 8601 (`YYYY-MM-DD` para fechas y timestamp con zona para
  eventos) y dejar el formato chileno a la UI.
- La UI usa números para `id` de gestión y strings para códigos de estación y
  varios catálogos. Estos identificadores deben estabilizarse antes de generar
  el cliente OpenAPI.
- Los códigos de gestión (`N1-MUN-001`) y semáforos se calculan hoy con reglas
  locales y datos hardcodeados. La autoridad de esas reglas debe quedar en el
  backend para que no diverjan entre pantallas.
- El front contiene archivos de modelo físico no versionados y cambios locales
  ajenos a este backend. Solo se usaron como contexto de análisis; no se
  modificaron.

## 2. Cruce con el PNG

El ERD transcrito y sus tipos inferidos están en
[`erd-provisional.md`](./erd-provisional.md).

### Lo cubierto

El PNG representa las piezas centrales: usuario, estación, ámbito, tipo de
gestión, gestión, catálogo e instancia de antecedentes, catálogo e instancia de
etapas y bitácora.

### Lo que falta o no alcanza a cubrir

- El “trámite específico” del frontend quedó confirmado como otro registro de
  `Tipo_gestion`, no como un catálogo separado. Como un tipo inferior es
  reutilizable bajo múltiples tipos superiores, se agrega la tabla puente
  autorreferente `Tipo_gestion_relacion` con orden y validación contra ciclos.
- Configuración de antecedentes requeridos por tipo de gestión.
- Campos adicionales dinámicos, sus opciones y valores por gestión.
- Relación explícita entre gestión principal y subtrámite.
- Estado y modalidad de creación de `Gestion`.
- Código visible y/o regla inequívoca para generar nivel, ámbito y correlativo.
- Razón social, RUT, representante legal y RUT del representante que aparecen en
  los listados.
- Metadatos de adjuntos: nombre, referencia estable, tipo MIME, tamaño, autor y
  fecha/hora de carga.
- Observaciones y solicitante de antecedentes.
- Tipo, autor mostrado, iniciales y marca automática de bitácora.

La autorrelación del PNG quedó confirmada: el campo originalmente rotulado
`id_subgestion_padre` apunta a otra instancia de `Antecedente_gestion`. En el
modelo se denominará `id_antecedente_gestion_padre` para reflejar esa semántica.
También quedó confirmado que `Antecedente_gestion.id_tipo_gestion` describe el
tipo propio de ese elemento de nivel inferior y no duplica el tipo de la gestión
principal. Toda instancia de `Antecedente_gestion` debe tener exactamente un
`Antecedente` del catálogo asociado. El concepto de “trámite específico” del
frontend corresponde también a `Tipo_gestion`; su relación reutilizable con
tipos superiores es muchos-a-muchos.

Se confirmó autenticación local mediante RUT y contraseña. Por tanto,
`Usuario.contrasena_hash` se conserva y no se diseñará el frontend ni el backend
alrededor de Entra ID/OIDC en esta etapa. El algoritmo y la política de
credenciales se decidirán en un ADR antes de implementar autenticación real.
También se confirmó que los responsables de gestiones y antecedentes deben ser
usuarios internos registrados. La semántica del responsable de una etapa queda
pendiente.

## 3. Evaluación de stack para Cloudflare

### Límites y costos relevantes verificados

Según la documentación vigente de Cloudflare:

- Workers Free: 100.000 solicitudes/día, 10 ms de CPU por invocación, 128 MB de
  memoria y 50 subrequests externos por solicitud.
- Workers Paid: mínimo USD 5/mes; incluye 10 millones de solicitudes/mes y 30
  millones de CPU-ms. Excedentes: USD 0,30 por millón de solicitudes y USD 0,02
  por millón de CPU-ms.
- En Paid, el límite de CPU por invocación es 30 s por defecto y puede subirse a
  5 min. Hay 10.000 subrequests por solicitud por defecto.
- Ambos planes declaran actualmente 64 MiB como tamaño máximo de Worker, 128 MB
  de memoria y 1 s de startup.
- Desde una compatibility date igual o posterior a 2026-08-04, la compatibilidad
  Node se habilita por defecto. Sigue siendo un subconjunto/adaptación: algunos
  módulos son parciales y otros son stubs que fallan al invocarse.
- Containers requiere Workers Paid. El plan incluye 25 GiB-h de memoria, 375
  vCPU-min y 200 GB-h de disco al mes; el exceso se factura por recurso. Además
  se cobran el Worker y Durable Object que enrutan/controlan el contenedor.

Para pocos usuarios, los límites de solicitudes no son el problema. Los puntos
sensibles son CPU al procesar respuestas de Excel, latencia/red de Microsoft
Graph y concurrencia de escritura. Hono reduce overhead; las llamadas a Graph
esperan I/O y no consumen CPU durante la espera.

### Comparación

| Criterio                     | Hono + `@hono/zod-openapi` en Workers                                  | NestJS en Workers                                                                | Node/Nest en Containers                                     |
| ---------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Encaje con runtime           | Nativo: Web Standards y `fetch`                                        | Posible vía `node:http`/adaptador; sin guía oficial específica de Nest           | Runtime Node/Linux completo                                 |
| Bundle/arranque              | Muy bajo; `hono/tiny` es menor a 14 kB antes de dependencias de la app | Superior por DI, metadata, decoradores y adaptador HTTP                          | Imagen mucho mayor; arranque/provisión de contenedor        |
| Estructura mantenible        | Hay que imponerla explícitamente; encaja bien con monolito modular     | Excelente estructura y DI incorporadas                                           | Igual que Nest/Node tradicional                             |
| OpenAPI                      | Esquemas Zod sirven para validación, tipos y documento                 | `@nestjs/swagger` es maduro, pero usa decoradores/metadata y validación separada | Igual que Nest convencional                                 |
| Tests                        | Hono `app.request` + plugin Vitest oficial de Workers                  | Unit tests buenos; integración Worker requiere validar la adaptación             | Tooling Node tradicional, menor paridad con Workers         |
| Acceso a bindings Cloudflare | Directo                                                                | Requiere encapsular/adaptar bindings                                             | Se accede a través del Worker controlador o red             |
| Portabilidad futura          | Alta si dominio y repositorios no importan Hono/Cloudflare             | Alta en Node, menor en edge                                                      | Alta entre plataformas de contenedores                      |
| Complejidad operativa        | Baja                                                                   | Media en Worker por adaptación/build                                             | Mayor: Docker, ciclo de vida, costos y observabilidad doble |

### Hono en Workers

Pros:

- Es el camino soportado explícitamente por Cloudflare y está construido sobre
  APIs Web estándar.
- Bundle y arranque pequeños, útiles incluso si inicialmente se usa el plan
  gratuito.
- `OpenAPIHono` permite validar con Zod y generar OpenAPI desde los mismos
  esquemas, reduciendo divergencia entre runtime, documentación y cliente
  Angular.
- Testing directo de requests y ejecución dentro de `workerd` con el plugin
  oficial de Vitest.
- Acceso natural a `fetch`, Web Crypto, secrets y bindings futuros.

Contras:

- No entrega por sí solo módulos, inyección de dependencias ni límites de capa.
  Hay que diseñarlos y aplicar reglas de lint/importación.
- OpenAPI con Zod exige declarar explícitamente request y response; es más
  verboso que inferir parte del documento con decoradores de Nest.
- Debe evitarse que lógica de dominio dependa de `Context` de Hono o bindings de
  Cloudflare para conservar portabilidad.

### NestJS en Workers

Desde 2026 Cloudflare soporta servidores `node:http` mediante
`httpServerHandler`, y Nest soporta Express, Fastify y un adaptador `node:http`.
Por tanto, Nest en Workers ya no debe calificarse de imposible.

No obstante, no es la opción preferida aquí:

- No existe en la documentación oficial revisada una integración específica de
  Nest con Workers comparable a la guía oficial de Hono o Express.
- El bootstrap, DI, metadata/decoradores y adaptador aumentan bundle y CPU de
  arranque sin que este proyecto necesite esa maquinaria.
- La compatibilidad Node de Workers sigue teniendo diferencias y stubs; cada
  dependencia transitiva debe probarse en `workerd`, no solo en Node local.
- `@nestjs/swagger` es muy bueno, pero su plugin de compilación y metadata añade
  complejidad al pipeline de un Worker.

Nest sería razonable si el equipo ya estuviera estandarizado en Nest, el dominio
fuera mucho mayor o existiera una necesidad fuerte de su ecosistema. No es el
caso observable hoy.

### Node/Nest en Cloudflare Containers

Pros:

- Compatibilidad real con el runtime Node y dependencias que necesitan Linux,
  filesystem o procesos.
- Permite usar Nest sin adaptar el modelo HTTP de Workers.

Contras:

- Requiere Workers Paid, Docker y operación adicional.
- Añade facturación y ciclo de vida de Worker, Durable Object y contenedor.
- Es excesivo para una API pequeña que principalmente valida, autoriza y llama a
  Microsoft Graph por HTTP.
- Reduce parte de la ventaja de simplicidad y despliegue edge buscada en esta
  fase.

## 4. Recomendación

**Hono + `@hono/zod-openapi` + Zod, desplegado como un único Cloudflare Worker.**

La arquitectura debe mantener Hono solo en la capa de transporte. Servicios de
aplicación y dominio dependerán de interfaces de repositorio; la primera
implementación llamará Microsoft Graph y una implementación SQL futura podrá
reemplazarla sin tocar casos de uso.

Configuración recomendada para la futura estructura, aún no creada:

- Compatibility date actual; no agregar `nodejs_compat` redundante mientras las
  dependencias elegidas funcionen con Web APIs.
- OpenAPI generado desde esquemas Zod y publicado como artefacto del build.
- Vitest con el plugin oficial de Cloudflare para unitarias/integración.
- Workers Paid solo si las mediciones del flujo real de Excel superan los 10 ms
  de CPU del plan Free o si se requieren garantías/observabilidad del plan; el
  volumen de usuarios por sí solo no obliga a pagarlo.
- Containers queda como plan de contingencia, no como punto de partida.

## 5. Fuentes oficiales consultadas

- [Cloudflare Workers: límites](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers: precios](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Workers: compatibilidad Node.js](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
- [Cloudflare Workers: integración `node:http`](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/)
- [Cloudflare Workers: Hono](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/)
- [Cloudflare Workers: testing con Vitest](https://developers.cloudflare.com/workers/testing/vitest-integration/)
- [Cloudflare Containers: descripción](https://developers.cloudflare.com/containers/)
- [Cloudflare Containers: límites](https://developers.cloudflare.com/containers/platform/limits/)
- [Cloudflare Containers: precios](https://developers.cloudflare.com/containers/platform/pricing/)
- [Hono: documentación y tamaño](https://hono.dev/docs)
- [Hono: Zod OpenAPI](https://hono.dev/examples/zod-openapi)
- [Hono: testing](https://hono.dev/docs/guides/testing)
- [NestJS: plataformas HTTP](https://docs.nestjs.com/first-steps)
- [NestJS: OpenAPI](https://docs.nestjs.com/openapi/introduction)
- [NestJS: serverless](https://docs.nestjs.com/faq/serverless)
