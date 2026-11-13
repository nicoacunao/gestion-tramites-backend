-- Consultas de verificación posteriores a la normalización.

-- Debe devolver cero filas.
SELECT id_gestion, id_antecedente, COUNT(*) AS repeticiones
FROM antecedente_gestion
GROUP BY id_gestion, id_antecedente
HAVING COUNT(*) > 1;

-- Debe devolver cero filas.
SELECT g.codigo, g.id_tipo_gestion, ge.id_tipo_gestion AS tipo_de_especifica
FROM gestion g
JOIN gestion_especifica ge
  ON ge.id_gestion_especifica = g.id_gestion_especifica
WHERE g.id_tipo_gestion <> ge.id_tipo_gestion;

-- Debe devolver cero filas.
SELECT gs.id_gestion, gs.id_gestion_especifica
FROM gestion_subtramite gs
JOIN gestion g ON g.id_gestion = gs.id_gestion
JOIN gestion_especifica ge
  ON ge.id_gestion_especifica = gs.id_gestion_especifica
WHERE g.id_tipo_gestion <> ge.id_tipo_gestion;

-- Debe devolver cero filas.
SELECT f.id_archivo, f.id_gestion, f.id_antecedente_gestion
FROM archivo_gestion f
JOIN antecedente_gestion ag
  ON ag.id_antecedente_gestion = f.id_antecedente_gestion
WHERE ag.id_gestion <> f.id_gestion;

-- Debe devolver cero filas.
SELECT id_entrada_bitacora, id_usuario, automatica
FROM entrada_bitacora
WHERE id_usuario IS NULL AND automatica IS NOT TRUE;

-- Resumen de las tablas principales.
SELECT 'gestion' AS tabla, COUNT(*) AS filas FROM gestion
UNION ALL
SELECT 'antecedente_gestion', COUNT(*) FROM antecedente_gestion
UNION ALL
SELECT 'etapa_gestion', COUNT(*) FROM etapa_gestion
UNION ALL
SELECT 'entrada_bitacora', COUNT(*) FROM entrada_bitacora
UNION ALL
SELECT 'archivo_gestion', COUNT(*) FROM archivo_gestion;
