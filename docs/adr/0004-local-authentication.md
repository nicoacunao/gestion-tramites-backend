# ADR-0004: Autenticación local

- Estado: aceptado, implementación pendiente
- Fecha: 2026-11-03

## Decisión

Los usuarios accederán mediante RUT y contraseña local. `Usuario` conserva
`contrasena_hash`; no se usará Entra ID/OIDC para autenticar usuarios de la
plataforma en esta etapa.

## Límites de esta fase

Solo se declaran `UserRepository`, `PasswordHasher` y `SessionIssuer`. No se
implementan login, hash, tokens, recuperación ni autorización.

Antes de implementar se deberá aprobar un ADR de seguridad con algoritmo de
hash, costo, rotación de sesión, expiración, bloqueo y recuperación.

La presencia de `contrasena_hash` en el PNG no implica que el workbook sea un
almacén de credenciales aprobado. Los hashes deben quedar fuera de un Excel
compartido salvo que una revisión de seguridad explícita determine lo
contrario; la persistencia de identidad puede usar un adaptador distinto del de
los datos operacionales.
