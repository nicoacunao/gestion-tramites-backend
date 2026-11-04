# Opciones de modularización

Estado: propuesta pendiente de aprobación. Ninguna estructura de código ha sido
generada todavía.

## Opción A: núcleo compacto

1. `identidad`: autenticación local y usuarios.
2. `catalogos`: estaciones, ámbitos, tipos y relaciones entre tipos,
   antecedentes de catálogo y etapas de catálogo.
3. `gestiones`: gestión, antecedentes de gestión, etapas, adjuntos y bitácora.
4. `consultas`: escritorio, listado global y resumen por estación.

Ventaja: menos carpetas y composición inicial muy simple.  
Desventaja: `gestiones` concentra demasiadas responsabilidades y dificulta
extraer archivos o auditoría más adelante.

## Opción B: monolito modular equilibrado — recomendada

1. `identidad`: autenticación local por RUT, sesión/tokens y usuarios internos.
2. `catalogos`: estaciones, ámbitos, tipos de gestión, relaciones reutilizables
   entre tipos, biblioteca de antecedentes y catálogo de etapas.
3. `gestiones`: agregado central `Gestion`, jerarquía de
   `Antecedente_gestion` y ejecución de etapas. La responsabilidad de las etapas
   queda como contrato pendiente, no como lógica asumida.
4. `archivos`: contratos y metadatos de adjuntos; adaptador futuro para
   OneDrive/Graph sin filtrar conceptos de Graph al dominio.
5. `bitacora`: entradas manuales y automáticas asociadas a una gestión.
6. `consultas`: modelos de lectura para escritorio, todas las gestiones y
   resumen por estación; no es dueño de datos operacionales.

Ventajas:

- Mantiene juntas las invariantes jerárquicas de la gestión y sus antecedentes.
- Aísla los dos candidatos más naturales a separación futura: archivos y
  bitácora.
- Las pantallas agregadas no contaminan los repositorios de escritura.
- Seis módulos siguen siendo proporcionados para un equipo y volumen pequeños.

Desventaja: requiere contratos públicos y composición explícita desde el
principio.

No se propone un módulo de notificaciones porque no existe evidencia de ese
flujo en el frontend ni en el esquema actual. Se podrá incorporar cuando haya un
caso de uso confirmado.

## Opción C: separación granular

Separar `autenticacion`, `usuarios`, `estaciones`, `tipos-gestion`, `gestiones`,
`antecedentes`, `etapas`, `archivos`, `bitacora` y `consultas`.

Ventaja: límites muy explícitos.  
Desventaja: demasiada coordinación y contratos para el tamaño actual; varias
operaciones simples cruzarían cuatro o más módulos. No se recomienda en esta
fase.

## Reglas de aislamiento propuestas

- Cada módulo expone únicamente `src/modules/<modulo>/index.ts`.
- Un módulo puede importar el API público de otro, nunca sus carpetas internas.
- Las rutas llaman servicios de aplicación; no importan repositorios concretos.
- Los servicios dependen de puertos/interfaces. Los adaptadores Excel/Graph y
  SQL implementan esos puertos en infraestructura.
- `shared` contiene capacidades transversales, no entidades de dominio ni
  lógica que pertenezca a un módulo.
- Las operaciones síncronas entre módulos usan interfaces públicas. Los efectos
  secundarios desacoplados usan eventos internos tipados.
- El módulo publicador es dueño del contrato del evento; los consumidores no
  pueden modificarlo.
- Se prohíben dependencias circulares.

Aplicación automática:

- Alias TypeScript solo hacia APIs públicas de módulos.
- Reglas ESLint de importación restringida para impedir rutas
  `modules/<otro-modulo>/**` distintas de su `index.ts`.
- `dependency-cruiser` en CI para detectar ciclos y dependencias de capa
  inválidas.
- Tests de arquitectura que fallen si una ruta importa infraestructura o si un
  módulo cruza un límite interno.

## Capas internas por módulo

```text
<modulo>/
├── http/             # rutas, DTO/esquemas y mapeo HTTP
├── application/      # casos de uso/servicios y puertos
├── domain/           # entidades, value objects y reglas propias
├── infrastructure/   # repositorios/adaptadores concretos
├── health/           # health check mínimo del módulo
├── index.ts          # API pública única
└── README.md
```

Durante esta fase los servicios y repositorios serán contratos o placeholders;
no contendrán lógica de negocio.

## Extracción futura a otro Worker

1. Mantener el API público del módulo como contrato estable.
2. Mover su composición y adaptadores a un nuevo entrypoint/Worker.
3. Sustituir el adaptador en proceso del consumidor por un adaptador de Service
   Binding que implemente la misma interfaz.
4. Configurar el binding en Wrangler y tipos generados.
5. Para efectos asíncronos, sustituir el bus interno por Queues sin cambiar el
   contrato de evento del publicador.
6. Mantener en el Worker original una capa anticorrupción para que servicios de
   aplicación no conozcan RPC, HTTP ni detalles de Cloudflare.

Así, separar un módulo cambia la composición y el transporte, no los casos de
uso que lo consumen.
