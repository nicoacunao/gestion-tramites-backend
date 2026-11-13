-- Normaliza la jerarquía del catálogo sin convertir gestiones específicas en
-- antecedentes. La gestión específica es el agrupador del trámite y sus
-- antecedentes documentales directos son N2.

BEGIN;

ALTER TABLE gestion_especifica_antecedente
    ADD COLUMN IF NOT EXISTS id_antecedente_padre BIGINT,
    ADD COLUMN IF NOT EXISTS nivel VARCHAR(2);

UPDATE gestion_especifica_antecedente
SET id_antecedente_padre = NULL,
    nivel = 'N2';

ALTER TABLE gestion_especifica_antecedente
    ALTER COLUMN nivel SET NOT NULL,
    ALTER COLUMN nivel DROP DEFAULT;

-- Limpia filas creadas por la migración anterior, que materializaba el nombre
-- de cada gestión específica como un antecedente N2 artificial. Esta limpieza
-- es intencional para el entorno de pruebas actual.
UPDATE antecedente_gestion
SET id_antecedente_padre = NULL
WHERE id_antecedente_padre IS NOT NULL;

DELETE FROM archivo_gestion f
USING antecedente_gestion ag, antecedente a, gestion_especifica ge
WHERE f.id_antecedente_gestion = ag.id_antecedente_gestion
  AND a.id_antecedente = ag.id_antecedente
  AND a.nombre = ge.nombre;

DELETE FROM antecedente_gestion ag
USING antecedente a, gestion_especifica ge
WHERE a.id_antecedente = ag.id_antecedente
  AND a.nombre = ge.nombre;

DELETE FROM gestion_especifica_antecedente gea
USING antecedente a, gestion_especifica ge
WHERE a.id_antecedente = gea.id_antecedente
  AND ge.id_gestion_especifica = gea.id_gestion_especifica
  AND a.nombre = ge.nombre;

DELETE FROM antecedente a
USING gestion_especifica ge
WHERE a.nombre = ge.nombre
  AND NOT EXISTS (
      SELECT 1 FROM antecedente_gestion ag
      WHERE ag.id_antecedente = a.id_antecedente
  )
  AND NOT EXISTS (
      SELECT 1 FROM gestion_especifica_antecedente gea
      WHERE gea.id_antecedente = a.id_antecedente
  );

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_gestion_especifica_antecedente_nivel'
          AND conrelid = 'gestion_especifica_antecedente'::regclass
    ) THEN
        ALTER TABLE gestion_especifica_antecedente
            ADD CONSTRAINT ck_gestion_especifica_antecedente_nivel
            CHECK (nivel IN ('N2', 'N3', 'N4'));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_gestion_especifica_antecedente_padre'
          AND conrelid = 'gestion_especifica_antecedente'::regclass
    ) THEN
        ALTER TABLE gestion_especifica_antecedente
            ADD CONSTRAINT fk_gestion_especifica_antecedente_padre
            FOREIGN KEY (id_antecedente_padre)
            REFERENCES antecedente (id_antecedente)
            ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_gestion_especifica_antecedente_padre_misma_especifica'
          AND conrelid = 'gestion_especifica_antecedente'::regclass
    ) THEN
        ALTER TABLE gestion_especifica_antecedente
            ADD CONSTRAINT fk_gestion_especifica_antecedente_padre_misma_especifica
            FOREIGN KEY (id_gestion_especifica, id_antecedente_padre)
            REFERENCES gestion_especifica_antecedente (id_gestion_especifica, id_antecedente)
            ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Ajusta las gestiones de prueba a la configuración actual del catálogo.
-- No se crean filas artificiales en antecedente.
UPDATE antecedente_gestion ag
SET nivel = COALESCE(
        (
            SELECT gea.nivel
            FROM gestion g
            JOIN gestion_especifica ge
              ON ge.id_gestion_especifica = g.id_gestion_especifica
            JOIN gestion_especifica_antecedente gea
              ON gea.id_gestion_especifica = ge.id_gestion_especifica
             AND gea.id_antecedente = ag.id_antecedente
            WHERE g.id_gestion = ag.id_gestion
        ),
        'N2'
    ),
    id_antecedente_padre = NULL;

COMMIT;

-- Validaciones posteriores:
-- SELECT ge.codigo, gea.id_antecedente, gea.nivel
-- FROM gestion_especifica ge
-- JOIN gestion_especifica_antecedente gea
--   ON gea.id_gestion_especifica = ge.id_gestion_especifica
-- ORDER BY ge.codigo, gea.orden;
