-- Corrige el nivel y la relación padre de antecedentes de gestiones ya creadas.
-- La relación gestion_especifica_antecedente es la fuente de verdad del catálogo.
-- Ejecutar después de docs/data/schema.sql y del seed del catálogo.

BEGIN;

ALTER TABLE gestion_especifica_antecedente
    ADD COLUMN IF NOT EXISTS id_antecedente_padre BIGINT,
    ADD COLUMN IF NOT EXISTS nivel VARCHAR(2) NOT NULL DEFAULT 'N3';

DO $$
BEGIN
    ALTER TABLE gestion_especifica_antecedente
        ADD CONSTRAINT ck_gestion_especifica_antecedente_nivel
        CHECK (nivel IN ('N2', 'N3', 'N4'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE gestion_especifica_antecedente
        ADD CONSTRAINT fk_gestion_especifica_antecedente_padre
        FOREIGN KEY (id_antecedente_padre)
        REFERENCES antecedente (id_antecedente)
        ON UPDATE CASCADE ON DELETE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Los registros creados por el bug se corrigen sólo cuando existe una relación
-- inequívoca entre la gestión, su gestión específica y el antecedente catalogado.
UPDATE antecedente_gestion ag
SET nivel = gea.nivel,
    id_antecedente_padre = parent_ag.id_antecedente_gestion
FROM gestion g
JOIN gestion_especifica_antecedente gea
  ON gea.id_gestion_especifica = g.id_gestion_especifica
LEFT JOIN antecedente_gestion parent_ag
  ON parent_ag.id_gestion = ag.id_gestion
 AND parent_ag.id_antecedente = gea.id_antecedente_padre
WHERE ag.id_gestion = g.id_gestion
  AND ag.id_antecedente = gea.id_antecedente;

COMMIT;

-- Auditoría posterior sugerida:
-- SELECT ag.id_antecedente_gestion, g.codigo, ag.id_antecedente, ag.nivel
-- FROM antecedente_gestion ag JOIN gestion g ON g.id_gestion = ag.id_gestion
-- WHERE ag.nivel = 'N2' AND g.id_gestion_especifica IS NOT NULL;
