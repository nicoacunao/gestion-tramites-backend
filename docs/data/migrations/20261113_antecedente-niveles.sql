-- Corrige el nivel y la relación padre de antecedentes de gestiones ya creadas.
-- La relación gestion_especifica_antecedente es la fuente de verdad del catálogo.
-- Ejecutar después de docs/data/schema.sql y del seed del catálogo.

BEGIN;

ALTER TABLE gestion_especifica_antecedente
    ADD COLUMN IF NOT EXISTS id_antecedente_padre BIGINT,
    ADD COLUMN IF NOT EXISTS nivel VARCHAR(2);

UPDATE gestion_especifica_antecedente
SET nivel = 'N3'
WHERE nivel IS NULL;

ALTER TABLE gestion_especifica_antecedente
    ALTER COLUMN nivel SET NOT NULL,
    ALTER COLUMN nivel DROP DEFAULT;

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

-- El Excel define las gestiones específicas como antecedentes padre N2.
-- Sus antecedentes documentales quedan como hijos N3.
INSERT INTO antecedente (nombre)
SELECT ge.nombre
FROM gestion_especifica ge
WHERE EXISTS (
    SELECT 1
    FROM gestion_especifica_antecedente gea
    WHERE gea.id_gestion_especifica = ge.id_gestion_especifica
)
ON CONFLICT (nombre) DO NOTHING;

-- Reserva temporal de orden para insertar el padre en la posición 1.
UPDATE gestion_especifica_antecedente gea
SET orden = gea.orden + 1000
FROM gestion_especifica ge
JOIN antecedente parent ON parent.nombre = ge.nombre
WHERE ge.id_gestion_especifica = gea.id_gestion_especifica
  AND NOT EXISTS (
      SELECT 1
      FROM gestion_especifica_antecedente existing_parent
      WHERE existing_parent.id_gestion_especifica = ge.id_gestion_especifica
        AND existing_parent.id_antecedente = parent.id_antecedente
  );

UPDATE gestion_especifica_antecedente gea
SET orden = gea.orden - 999
FROM gestion_especifica ge
JOIN antecedente parent ON parent.nombre = ge.nombre
WHERE ge.id_gestion_especifica = gea.id_gestion_especifica
  AND NOT EXISTS (
      SELECT 1
      FROM gestion_especifica_antecedente existing_parent
      WHERE existing_parent.id_gestion_especifica = ge.id_gestion_especifica
        AND existing_parent.id_antecedente = parent.id_antecedente
  );

INSERT INTO gestion_especifica_antecedente (
    id_gestion_especifica, id_antecedente, id_antecedente_padre, nivel, orden
)
SELECT ge.id_gestion_especifica, parent.id_antecedente, NULL, 'N2', 1
FROM gestion_especifica ge
JOIN antecedente parent ON parent.nombre = ge.nombre
WHERE EXISTS (
    SELECT 1
    FROM gestion_especifica_antecedente gea
    WHERE gea.id_gestion_especifica = ge.id_gestion_especifica
      AND gea.id_antecedente <> parent.id_antecedente
)
ON CONFLICT (id_gestion_especifica, id_antecedente) DO UPDATE
SET id_antecedente_padre = NULL, nivel = 'N2', orden = 1;

UPDATE gestion_especifica_antecedente gea
SET id_antecedente_padre = parent.id_antecedente,
    nivel = 'N3'
FROM gestion_especifica ge
JOIN antecedente parent ON parent.nombre = ge.nombre
WHERE ge.id_gestion_especifica = gea.id_gestion_especifica
  AND gea.id_antecedente <> parent.id_antecedente;

-- Crea los padres que faltan en gestiones históricas que sólo tenían hijos.
INSERT INTO antecedente_gestion (
    id_gestion, id_antecedente_padre, id_antecedente, nivel, categoria,
    nombre_mostrado, flag_obligatorio, id_usuario_responsable, responsable_nombre,
    estado
)
SELECT DISTINCT ON (g.id_gestion, parent.id_antecedente)
    g.id_gestion, NULL, parent.id_antecedente, 'N2', 'requerido',
    parent.nombre, TRUE, child.id_usuario_responsable, child.responsable_nombre,
    'Pendiente'
FROM gestion g
JOIN gestion_especifica ge ON ge.id_gestion_especifica = g.id_gestion_especifica
JOIN antecedente parent ON parent.nombre = ge.nombre
JOIN antecedente_gestion child ON child.id_gestion = g.id_gestion
WHERE EXISTS (
    SELECT 1
    FROM gestion_especifica_antecedente gea
    WHERE gea.id_gestion_especifica = ge.id_gestion_especifica
      AND gea.id_antecedente = parent.id_antecedente
      AND gea.nivel = 'N2'
)
  AND NOT EXISTS (
      SELECT 1
      FROM antecedente_gestion existing_parent
      WHERE existing_parent.id_gestion = g.id_gestion
        AND existing_parent.id_antecedente = parent.id_antecedente
  )
ORDER BY g.id_gestion, parent.id_antecedente, child.id_antecedente_gestion;

-- Los registros creados por el bug se corrigen sólo cuando existe una relación
-- inequívoca entre la gestión, su gestión específica y el antecedente catalogado.
UPDATE antecedente_gestion ag
SET nivel = gea.nivel,
    id_antecedente_padre = (
        SELECT parent_ag.id_antecedente_gestion
        FROM antecedente_gestion parent_ag
        WHERE parent_ag.id_gestion = ag.id_gestion
          AND parent_ag.id_antecedente = gea.id_antecedente_padre
        ORDER BY parent_ag.id_antecedente_gestion
        LIMIT 1
    )
FROM gestion g
JOIN gestion_especifica_antecedente gea
  ON gea.id_gestion_especifica = g.id_gestion_especifica
WHERE ag.id_gestion = g.id_gestion
  AND ag.id_antecedente = gea.id_antecedente;

COMMIT;

-- Auditoría posterior sugerida:
-- SELECT ag.id_antecedente_gestion, g.codigo, ag.id_antecedente, ag.nivel
-- FROM antecedente_gestion ag JOIN gestion g ON g.id_gestion = ag.id_gestion
-- WHERE ag.nivel = 'N2' AND g.id_gestion_especifica IS NOT NULL;
