# Módulo identidad

Responsable de usuarios internos y autenticación local mediante RUT y
contraseña. Expone contratos, no lógica de credenciales.

- API pública: `index.ts`.
- Health: `GET /api/v1/identidad/health`.
- Pendiente: ADR del algoritmo de hash, política de sesión y recuperación.
