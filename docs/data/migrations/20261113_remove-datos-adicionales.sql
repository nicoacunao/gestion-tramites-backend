-- Retira el almacenamiento configurable de datos adicionales.
-- Ejecutar sólo después de respaldar cualquier dato que se quiera conservar.

BEGIN;

DROP TABLE IF EXISTS gestion_dato_adicional;
DROP TABLE IF EXISTS opcion_campo_adicional;
DROP TABLE IF EXISTS campo_adicional_tipo;

COMMIT;
