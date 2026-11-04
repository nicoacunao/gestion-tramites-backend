# Próximos pasos

Orden sugerido para iniciar implementación real:

1. Elegir la estrategia de Excel: OAuth delegado, archivo completo app-only o
   migración temprana a SQL/D1.
2. Resolver si `Etapa_gestion.responsable` referencia un usuario y su
   obligatoriedad.
3. Cerrar el ERD: nulabilidad, estados, prioridad, código visible, datos legales
   y campos dinámicos.
4. Aprobar ADR de seguridad para hash de contraseñas y sesión.
5. Definir los primeros casos de uso y sus permisos por rol.
6. Convertir catálogos y gestiones a esquemas Zod/OpenAPI.
7. Implementar mappers y fixtures Excel sin datos reales.
8. Implementar primero endpoints de solo lectura y medir Graph.
9. Agregar bloqueo optimista antes de permitir escrituras.
10. Generar el cliente Angular y reemplazar mocks progresivamente.

No implementar archivos, notificaciones ni flujos de aprobación hasta confirmar
sus reglas y almacenamiento.
