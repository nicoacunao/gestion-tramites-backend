-- Homologa el catálogo N1/N2/N3 con la matriz operativa.
-- La matriz es la fuente funcional para los N2 incluidos explícitamente.
-- No se infieren niveles usando igualdad entre IDs numéricos.

BEGIN;

-- Los nombres canónicos de N2 provienen de la matriz.
WITH matrix_n2_mapping(id_gestion_especifica, nombre_canonico) AS (VALUES
    (1::bigint, 'Informe de obras para patente comercial'),
    (2::bigint, 'Solicitud de patente EDS'),
    (3::bigint, 'Documentación Extraordinaria'),
    (4::bigint, 'Solicitud de patente PRONTO'),
    (5::bigint, 'Traspaso de patente provisoria a definitiva'),
    (7::bigint, 'Local de elaboración de alimentos con consumo al paso'),
    (8::bigint, 'Local de expendio de alimentos con consumo al paso'),
    (9::bigint, 'Local de expendio de alimentos'),
    (12::bigint, 'Permiso de obra menor DOM'),
    (13::bigint, 'Recepción de permiso de obra menor'))
UPDATE gestion_especifica ge
SET nombre = m.nombre_canonico
FROM matrix_n2_mapping m
WHERE ge.id_gestion_especifica = m.id_gestion_especifica
  AND ge.nombre IS DISTINCT FROM m.nombre_canonico;

-- Cada N2 de la matriz es también un antecedente requerido real del catálogo.
WITH matrix_n2_mapping(id_gestion_especifica, nombre_canonico) AS (VALUES
    (1::bigint, 'Informe de obras para patente comercial'),
    (2::bigint, 'Solicitud de patente EDS'),
    (3::bigint, 'Documentación Extraordinaria'),
    (4::bigint, 'Solicitud de patente PRONTO'),
    (5::bigint, 'Traspaso de patente provisoria a definitiva'),
    (7::bigint, 'Local de elaboración de alimentos con consumo al paso'),
    (8::bigint, 'Local de expendio de alimentos con consumo al paso'),
    (9::bigint, 'Local de expendio de alimentos'),
    (12::bigint, 'Permiso de obra menor DOM'),
    (13::bigint, 'Recepción de permiso de obra menor'))
INSERT INTO antecedente (nombre, categoria)
SELECT m.nombre_canonico, 'requerido'
FROM matrix_n2_mapping m
ON CONFLICT (nombre) DO UPDATE
SET categoria = 'requerido';

-- Desplaza temporalmente los órdenes para reservar la posición 1 al N2 sin
-- violar la restricción de unicidad del orden.
WITH matrix_n2_mapping(id_gestion_especifica, nombre_canonico) AS (VALUES
    (1::bigint, 'Informe de obras para patente comercial'),
    (2::bigint, 'Solicitud de patente EDS'),
    (3::bigint, 'Documentación Extraordinaria'),
    (4::bigint, 'Solicitud de patente PRONTO'),
    (5::bigint, 'Traspaso de patente provisoria a definitiva'),
    (7::bigint, 'Local de elaboración de alimentos con consumo al paso'),
    (8::bigint, 'Local de expendio de alimentos con consumo al paso'),
    (9::bigint, 'Local de expendio de alimentos'),
    (12::bigint, 'Permiso de obra menor DOM'),
    (13::bigint, 'Recepción de permiso de obra menor'))
UPDATE gestion_especifica_antecedente gea
SET orden = gea.orden + 1000000
FROM matrix_n2_mapping m
WHERE gea.id_gestion_especifica = m.id_gestion_especifica
  AND NOT EXISTS (
      SELECT 1
      FROM gestion_especifica_antecedente existing_n2
      JOIN antecedente a ON a.id_antecedente = existing_n2.id_antecedente
      WHERE existing_n2.id_gestion_especifica = m.id_gestion_especifica
        AND a.nombre = m.nombre_canonico
  );

UPDATE gestion_especifica_antecedente
SET orden = orden - 999999
WHERE orden > 1000000;

WITH matrix_n2_mapping(id_gestion_especifica, nombre_canonico) AS (VALUES
    (1::bigint, 'Informe de obras para patente comercial'),
    (2::bigint, 'Solicitud de patente EDS'),
    (3::bigint, 'Documentación Extraordinaria'),
    (4::bigint, 'Solicitud de patente PRONTO'),
    (5::bigint, 'Traspaso de patente provisoria a definitiva'),
    (7::bigint, 'Local de elaboración de alimentos con consumo al paso'),
    (8::bigint, 'Local de expendio de alimentos con consumo al paso'),
    (9::bigint, 'Local de expendio de alimentos'),
    (12::bigint, 'Permiso de obra menor DOM'),
    (13::bigint, 'Recepción de permiso de obra menor'))
INSERT INTO gestion_especifica_antecedente
    (id_gestion_especifica, id_antecedente, id_antecedente_padre, nivel, orden)
SELECT m.id_gestion_especifica,
       a.id_antecedente,
       NULL,
       'N2',
       1
FROM matrix_n2_mapping m
JOIN antecedente a ON a.nombre = m.nombre_canonico
ON CONFLICT (id_gestion_especifica, id_antecedente) DO UPDATE
SET id_antecedente_padre = NULL,
    nivel = 'N2',
    orden = 1;

-- Todos los antecedentes existentes de estos N2 se conservan como N3 y
-- dependen del nuevo antecedente N2 canónico. No se eliminan extras.
WITH matrix_n2_mapping(id_gestion_especifica, nombre_canonico) AS (VALUES
    (1::bigint, 'Informe de obras para patente comercial'),
    (2::bigint, 'Solicitud de patente EDS'),
    (3::bigint, 'Documentación Extraordinaria'),
    (4::bigint, 'Solicitud de patente PRONTO'),
    (5::bigint, 'Traspaso de patente provisoria a definitiva'),
    (7::bigint, 'Local de elaboración de alimentos con consumo al paso'),
    (8::bigint, 'Local de expendio de alimentos con consumo al paso'),
    (9::bigint, 'Local de expendio de alimentos'),
    (12::bigint, 'Permiso de obra menor DOM'),
    (13::bigint, 'Recepción de permiso de obra menor'))
UPDATE gestion_especifica_antecedente child
SET nivel = 'N3',
    id_antecedente_padre = n2.id_antecedente
FROM matrix_n2_mapping m
JOIN antecedente n2 ON n2.nombre = m.nombre_canonico
WHERE child.id_gestion_especifica = m.id_gestion_especifica
  AND child.id_antecedente <> n2.id_antecedente;

-- Crea el antecedente N2 en las gestiones existentes que tienen la relación
-- directa o por gestion_subtramite.
WITH matrix_n2_mapping(id_gestion_especifica, nombre_canonico) AS (VALUES
    (1::bigint, 'Informe de obras para patente comercial'),
    (2::bigint, 'Solicitud de patente EDS'),
    (3::bigint, 'Documentación Extraordinaria'),
    (4::bigint, 'Solicitud de patente PRONTO'),
    (5::bigint, 'Traspaso de patente provisoria a definitiva'),
    (7::bigint, 'Local de elaboración de alimentos con consumo al paso'),
    (8::bigint, 'Local de expendio de alimentos con consumo al paso'),
    (9::bigint, 'Local de expendio de alimentos'),
    (12::bigint, 'Permiso de obra menor DOM'),
    (13::bigint, 'Recepción de permiso de obra menor')),
management_specific AS (
    SELECT g.id_gestion, g.id_gestion_especifica
    FROM gestion g
    JOIN matrix_n2_mapping m
      ON m.id_gestion_especifica = g.id_gestion_especifica
    UNION
    SELECT gs.id_gestion, gs.id_gestion_especifica
    FROM gestion_subtramite gs
    JOIN matrix_n2_mapping m
      ON m.id_gestion_especifica = gs.id_gestion_especifica
)
INSERT INTO antecedente_gestion
    (id_gestion, id_gestion_especifica, id_antecedente_padre, id_antecedente,
     nivel, categoria, flag_obligatorio, estado)
SELECT ms.id_gestion,
       ms.id_gestion_especifica,
       NULL,
       a.id_antecedente,
       'N2',
       'requerido',
       TRUE,
       'Pendiente'
FROM management_specific ms
JOIN matrix_n2_mapping m
  ON m.id_gestion_especifica = ms.id_gestion_especifica
JOIN antecedente a
  ON a.nombre = m.nombre_canonico
WHERE NOT EXISTS (
    SELECT 1
    FROM antecedente_gestion existing_n2
    WHERE existing_n2.id_gestion = ms.id_gestion
      AND existing_n2.id_gestion_especifica = ms.id_gestion_especifica
      AND existing_n2.id_antecedente = a.id_antecedente
);

-- Corrige las instancias existentes: los documentos de cada N2 son N3 y
-- apuntan a la instancia N2 real recién creada o ya existente.
WITH matrix_n2_mapping(id_gestion_especifica, nombre_canonico) AS (VALUES
    (1::bigint, 'Informe de obras para patente comercial'),
    (2::bigint, 'Solicitud de patente EDS'),
    (3::bigint, 'Documentación Extraordinaria'),
    (4::bigint, 'Solicitud de patente PRONTO'),
    (5::bigint, 'Traspaso de patente provisoria a definitiva'),
    (7::bigint, 'Local de elaboración de alimentos con consumo al paso'),
    (8::bigint, 'Local de expendio de alimentos con consumo al paso'),
    (9::bigint, 'Local de expendio de alimentos'),
    (12::bigint, 'Permiso de obra menor DOM'),
    (13::bigint, 'Recepción de permiso de obra menor'))
UPDATE antecedente_gestion child
SET nivel = 'N3',
    id_antecedente_padre = parent.id_antecedente_gestion
FROM matrix_n2_mapping m
JOIN antecedente n2
  ON n2.nombre = m.nombre_canonico
     CROSS JOIN antecedente_gestion parent
WHERE child.id_gestion_especifica = m.id_gestion_especifica
  AND child.id_antecedente <> n2.id_antecedente
  AND parent.id_gestion_especifica = m.id_gestion_especifica
  AND parent.id_antecedente = n2.id_antecedente
  AND parent.id_gestion = child.id_gestion;

-- Garantiza la representación N2 de la instancia.
WITH matrix_n2_mapping(id_gestion_especifica, nombre_canonico) AS (VALUES
    (1::bigint, 'Informe de obras para patente comercial'),
    (2::bigint, 'Solicitud de patente EDS'),
    (3::bigint, 'Documentación Extraordinaria'),
    (4::bigint, 'Solicitud de patente PRONTO'),
    (5::bigint, 'Traspaso de patente provisoria a definitiva'),
    (7::bigint, 'Local de elaboración de alimentos con consumo al paso'),
    (8::bigint, 'Local de expendio de alimentos con consumo al paso'),
    (9::bigint, 'Local de expendio de alimentos'),
    (12::bigint, 'Permiso de obra menor DOM'),
    (13::bigint, 'Recepción de permiso de obra menor'))
UPDATE antecedente_gestion n2_instance
SET nivel = 'N2',
    categoria = 'requerido',
    flag_obligatorio = TRUE,
    id_antecedente_padre = NULL
FROM matrix_n2_mapping m
JOIN antecedente n2
  ON n2.nombre = m.nombre_canonico
WHERE n2_instance.id_gestion_especifica = m.id_gestion_especifica
  AND n2_instance.id_antecedente = n2.id_antecedente;

CREATE INDEX IF NOT EXISTS idx_antecedente_gestion_gestion_especifica
    ON antecedente_gestion (id_gestion, id_gestion_especifica);

COMMIT;
