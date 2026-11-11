# Módulo identidad

Responsable de usuarios internos y autenticación local mediante RUT y
contraseña. Expone contratos, no lógica de credenciales.

- API pública: `index.ts`.
- Health: `GET /api/v1/identidad/health`.
- Las contraseñas legadas guardadas en texto plano se migran a PBKDF2 después de
  un login válido; las contraseñas ya hasheadas se verifican sin reemplazarlas.
- El RUT se normaliza para aceptar formatos con o sin puntos y guion.
- Pendiente: ADR del algoritmo de hash, política de sesión y recuperación.
