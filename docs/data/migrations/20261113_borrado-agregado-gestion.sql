-- Las tablas internas de una gestión forman un agregado: al eliminar la
-- gestión de pruebas, sus dependencias no deben quedar huérfanas.

BEGIN;

ALTER TABLE gestion_subtramite
    DROP CONSTRAINT IF EXISTS fk_gestion_subtramite_gestion;
ALTER TABLE gestion_subtramite
    ADD CONSTRAINT fk_gestion_subtramite_gestion
    FOREIGN KEY (id_gestion) REFERENCES gestion (id_gestion) ON DELETE CASCADE;

ALTER TABLE antecedente_gestion
    DROP CONSTRAINT IF EXISTS fk_antecedente_gestion_gestion,
    DROP CONSTRAINT IF EXISTS fk_antecedente_gestion_padre;
ALTER TABLE antecedente_gestion
    ADD CONSTRAINT fk_antecedente_gestion_gestion
        FOREIGN KEY (id_gestion) REFERENCES gestion (id_gestion) ON DELETE CASCADE,
    ADD CONSTRAINT fk_antecedente_gestion_padre
        FOREIGN KEY (id_antecedente_padre)
        REFERENCES antecedente_gestion (id_antecedente_gestion) ON DELETE CASCADE;

ALTER TABLE etapa_gestion
    DROP CONSTRAINT IF EXISTS fk_etapa_gestion_gestion;
ALTER TABLE etapa_gestion
    ADD CONSTRAINT fk_etapa_gestion_gestion
    FOREIGN KEY (id_gestion) REFERENCES gestion (id_gestion) ON DELETE CASCADE;

ALTER TABLE entrada_bitacora
    DROP CONSTRAINT IF EXISTS fk_entrada_bitacora_gestion;
ALTER TABLE entrada_bitacora
    ADD CONSTRAINT fk_entrada_bitacora_gestion
    FOREIGN KEY (id_gestion) REFERENCES gestion (id_gestion) ON DELETE CASCADE;

ALTER TABLE archivo_gestion
    DROP CONSTRAINT IF EXISTS archivo_gestion_id_gestion_fkey,
    DROP CONSTRAINT IF EXISTS fk_archivo_gestion_gestion;
ALTER TABLE archivo_gestion
    ADD CONSTRAINT fk_archivo_gestion_gestion
    FOREIGN KEY (id_gestion) REFERENCES gestion (id_gestion) ON DELETE CASCADE;

COMMIT;
