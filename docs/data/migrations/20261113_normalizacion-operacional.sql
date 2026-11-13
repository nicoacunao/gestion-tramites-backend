-- Primera normalización operacional.
-- Este proyecto aún trabaja con datos de prueba. La migración es transaccional
-- y elimina columnas derivables o duplicadas del modelo operacional.

BEGIN;

-- La identidad de la persona vive en usuario. El nombre se resuelve mediante
-- JOIN y no puede quedar desincronizado de la FK.
ALTER TABLE gestion
    DROP COLUMN IF EXISTS responsable_nombre,
    DROP COLUMN IF EXISTS razon_social,
    DROP COLUMN IF EXISTS rut_razon_social,
    DROP COLUMN IF EXISTS representante_legal,
    DROP COLUMN IF EXISTS rut_representante_legal;

-- El contrato de gestión y el dominio exigen responsable principal.
ALTER TABLE gestion
    ALTER COLUMN id_usuario_responsable SET NOT NULL;

ALTER TABLE etapa_gestion
    DROP COLUMN IF EXISTS responsable_nombre;

ALTER TABLE antecedente_gestion
    DROP COLUMN IF EXISTS nombre_mostrado,
    DROP COLUMN IF EXISTS responsable_nombre,
    DROP COLUMN IF EXISTS cargado_por,
    DROP COLUMN IF EXISTS solicitado_por,
    DROP COLUMN IF EXISTS id_usuario_carga;

-- Los adjuntos tienen cardinalidad 0..N y su única fuente de verdad debe ser
-- archivo_gestion. Si el esquema antiguo tenía referencias, se eliminan junto
-- con la columna antigua porque no son datos de producción.
ALTER TABLE antecedente_gestion
    DROP CONSTRAINT IF EXISTS ck_antecedente_gestion_archivo,
    DROP COLUMN IF EXISTS archivo_nombre,
    DROP COLUMN IF EXISTS archivo_referencia,
    DROP COLUMN IF EXISTS fecha_carga;

ALTER TABLE antecedente_gestion
    ALTER COLUMN id_antecedente SET NOT NULL;

-- Impide que el mismo antecedente aparezca dos veces en la misma gestión.
-- La sentencia se ejecuta solo si aún no existe la restricción.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_antecedente_gestion_gestion_antecedente'
          AND conrelid = 'antecedente_gestion'::regclass
    ) THEN
        ALTER TABLE antecedente_gestion
            ADD CONSTRAINT uq_antecedente_gestion_gestion_antecedente
            UNIQUE (id_gestion, id_antecedente);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_antecedente_gestion_id_gestion'
          AND conrelid = 'antecedente_gestion'::regclass
    ) THEN
        ALTER TABLE antecedente_gestion
            ADD CONSTRAINT uq_antecedente_gestion_id_gestion
            UNIQUE (id_antecedente_gestion, id_gestion);
    END IF;
END $$;

ALTER TABLE archivo_gestion
    DROP CONSTRAINT IF EXISTS archivo_gestion_id_antecedente_gestion_fkey;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_archivo_gestion_antecedente_gestion'
          AND conrelid = 'archivo_gestion'::regclass
    ) THEN
        ALTER TABLE archivo_gestion
            ADD CONSTRAINT fk_archivo_gestion_antecedente_gestion
            FOREIGN KEY (id_antecedente_gestion, id_gestion)
            REFERENCES antecedente_gestion (id_antecedente_gestion, id_gestion)
            ON DELETE RESTRICT;
    END IF;
END $$;

-- El catálogo de antecedentes por gestión específica no debe repetir orden.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_gestion_especifica_antecedente_orden'
          AND conrelid = 'gestion_especifica_antecedente'::regclass
    ) THEN
        ALTER TABLE gestion_especifica_antecedente
            ADD CONSTRAINT uq_gestion_especifica_antecedente_orden
            UNIQUE (id_gestion_especifica, orden);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Garantiza que una gestión específica pertenezca al tipo declarado por la
-- gestión cuando ambos valores estén presentes. La aplicación también debe
-- mantener esta regla en sus comandos de alta y edición.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM gestion g
        JOIN gestion_especifica ge
          ON ge.id_gestion_especifica = g.id_gestion_especifica
        WHERE g.id_tipo_gestion <> ge.id_tipo_gestion
    ) THEN
        RAISE EXCEPTION
            'Existen gestiones con tipo y gestión específica incompatibles';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_gestion_especifica_id_tipo'
          AND conrelid = 'gestion_especifica'::regclass
    ) THEN
        ALTER TABLE gestion_especifica
            ADD CONSTRAINT uq_gestion_especifica_id_tipo
            UNIQUE (id_gestion_especifica, id_tipo_gestion);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION validar_tipo_gestion_especifica()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.id_gestion_especifica IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM gestion_especifica ge
           WHERE ge.id_gestion_especifica = NEW.id_gestion_especifica
             AND ge.id_tipo_gestion = NEW.id_tipo_gestion
       ) THEN
        RAISE EXCEPTION
            'La gestión específica no pertenece al tipo de gestión indicado';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_tipo_gestion_especifica ON gestion;
CREATE TRIGGER trg_validar_tipo_gestion_especifica
BEFORE INSERT OR UPDATE OF id_tipo_gestion, id_gestion_especifica ON gestion
FOR EACH ROW
EXECUTE FUNCTION validar_tipo_gestion_especifica();

CREATE OR REPLACE FUNCTION validar_tipo_subtramite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM gestion g
        JOIN gestion_especifica ge
          ON ge.id_gestion_especifica = NEW.id_gestion_especifica
        WHERE g.id_gestion = NEW.id_gestion
          AND ge.id_tipo_gestion = g.id_tipo_gestion
    ) THEN
        RAISE EXCEPTION
            'El subtrámite no pertenece al tipo de gestión de la gestión principal';
    END IF;
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM gestion_subtramite gs
        JOIN gestion g ON g.id_gestion = gs.id_gestion
        JOIN gestion_especifica ge
          ON ge.id_gestion_especifica = gs.id_gestion_especifica
        WHERE ge.id_tipo_gestion <> g.id_tipo_gestion
    ) THEN
        RAISE EXCEPTION
            'Existen subtrámites incompatibles con el tipo de su gestión principal';
    END IF;
END $$;

DROP TRIGGER IF EXISTS trg_validar_tipo_subtramite ON gestion_subtramite;
CREATE TRIGGER trg_validar_tipo_subtramite
BEFORE INSERT OR UPDATE OF id_gestion, id_gestion_especifica ON gestion_subtramite
FOR EACH ROW
EXECUTE FUNCTION validar_tipo_subtramite();

COMMIT;

-- Validaciones posteriores sugeridas:
-- SELECT id_gestion, id_antecedente, COUNT(*)
-- FROM antecedente_gestion
-- GROUP BY id_gestion, id_antecedente
-- HAVING COUNT(*) > 1;
--
-- SELECT g.codigo, g.id_tipo_gestion, ge.id_tipo_gestion
-- FROM gestion g
-- JOIN gestion_especifica ge ON ge.id_gestion_especifica = g.id_gestion_especifica
-- WHERE g.id_tipo_gestion <> ge.id_tipo_gestion;
