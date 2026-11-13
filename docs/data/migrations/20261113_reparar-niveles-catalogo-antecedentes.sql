-- Corrige los niveles del catálogo según la matriz operativa.
--
-- En la matriz:
--   N1 = tipo de gestión (tipo_gestion)
--   N2 = gestión específica / trámite (gestion_especifica)
--   N3 = antecedente requerido/documental (gestion_especifica_antecedente)
--
-- La migración 20261113_antecedente-niveles.sql dejó todas las relaciones del
-- catálogo en N2 y no exponía el nivel propio de la gestión específica. La
-- gestión específica es el nodo N2; sus antecedentes requeridos son N3.

BEGIN;

ALTER TABLE gestion_especifica
    ADD COLUMN IF NOT EXISTS nivel VARCHAR(2) NOT NULL DEFAULT 'N2';

UPDATE gestion_especifica
SET nivel = 'N2'
WHERE nivel IS DISTINCT FROM 'N2';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_gestion_especifica_nivel'
          AND conrelid = 'gestion_especifica'::regclass
    ) THEN
        ALTER TABLE gestion_especifica
            ADD CONSTRAINT ck_gestion_especifica_nivel
            CHECK (nivel = 'N2');
    END IF;
END $$;

-- Verificación previa opcional:
-- SELECT ge.codigo, a.nombre, gea.nivel, gea.id_antecedente_padre
-- FROM gestion_especifica_antecedente gea
-- JOIN gestion_especifica ge
--   ON ge.id_gestion_especifica = gea.id_gestion_especifica
-- JOIN antecedente a
--   ON a.id_antecedente = gea.id_antecedente
-- ORDER BY ge.codigo, gea.orden;

UPDATE gestion_especifica_antecedente
SET nivel = 'N3',
    id_antecedente_padre = NULL;

-- Sincroniza las instancias ya creadas con el catálogo corregido.
-- La gestión específica es el agrupador N2; el antecedente requerido es N3.
UPDATE antecedente_gestion ag
SET nivel = gea.nivel,
    id_antecedente_padre = NULL
FROM gestion g
JOIN gestion_especifica ge
  ON ge.id_gestion_especifica = g.id_gestion_especifica
JOIN gestion_especifica_antecedente gea
  ON gea.id_gestion_especifica = ge.id_gestion_especifica
WHERE ag.id_gestion = g.id_gestion
  AND ag.id_antecedente = gea.id_antecedente;

-- Validaciones obligatorias posteriores: ambas consultas deben devolver cero.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM gestion_especifica
        WHERE nivel <> 'N2'
    ) THEN
        RAISE EXCEPTION
            'El catálogo de gestiones específicas todavía contiene niveles inválidos';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM gestion_especifica_antecedente
        WHERE nivel <> 'N3' OR id_antecedente_padre IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'El catálogo de antecedentes todavía contiene niveles o padres inválidos';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM antecedente_gestion ag
        JOIN gestion g
          ON g.id_gestion = ag.id_gestion
        JOIN gestion_especifica ge
          ON ge.id_gestion_especifica = g.id_gestion_especifica
        JOIN gestion_especifica_antecedente gea
          ON gea.id_gestion_especifica = ge.id_gestion_especifica
         AND gea.id_antecedente = ag.id_antecedente
        WHERE ag.nivel <> gea.nivel
           OR ag.id_antecedente_padre IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'Las instancias de antecedentes todavía contienen niveles o padres inválidos';
    END IF;
END $$;

COMMIT;

-- Verificación informativa:
-- SELECT nivel, COUNT(*)
-- FROM gestion_especifica_antecedente
-- GROUP BY nivel
-- ORDER BY nivel;
