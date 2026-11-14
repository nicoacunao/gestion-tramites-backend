-- Ejecutor único para psql.
-- Uso:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/data/migrations/20261113_apply-all.sql
--
-- No ejecutar este archivo desde el editor SQL de Supabase: \ir es un comando
-- del cliente psql, no SQL del servidor.

\set ON_ERROR_STOP on

\ir 20261113_antecedente-niveles.sql
\ir 20261113_reparar-niveles-catalogo-antecedentes.sql
\ir 20261113_antecedente-gestion-especifica.sql
\ir 20261113_normalizacion-operacional.sql
\ir 20261113_bitacora-snapshot.sql
\ir 20261113_borrado-agregado-gestion.sql
\ir 20261113_indices-operacionales.sql
