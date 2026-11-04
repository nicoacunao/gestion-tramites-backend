# ADR-0002: Monolito modular equilibrado

- Estado: aceptado
- Fecha: 2026-11-03

## Decisión

Dividir el backend en `identidad`, `catalogos`, `gestiones`, `archivos`,
`bitacora` y `consultas`. Cada módulo expone solo su `index.ts`; la comunicación
usa interfaces públicas o eventos tipados.

## Consecuencias

- Archivos y bitácora pueden extraerse con menor fricción.
- Gestiones conserva las invariantes de su jerarquía y etapas.
- No se crea un módulo de notificaciones sin un caso de uso confirmado.
- ESLint, dependency-cruiser y CI hacen cumplir límites y ausencia de ciclos.
