-- Índices para las consultas operacionales y relaciones FK más usadas.
-- Las PK y UNIQUE ya tienen índices implícitos; no se duplican aquí.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_gestion_estacion
    ON gestion (id_estacion);
CREATE INDEX IF NOT EXISTS idx_gestion_tipo
    ON gestion (id_tipo_gestion);
CREATE INDEX IF NOT EXISTS idx_gestion_ambito
    ON gestion (codigo_ambito);
CREATE INDEX IF NOT EXISTS idx_gestion_responsable
    ON gestion (id_usuario_responsable);
CREATE INDEX IF NOT EXISTS idx_gestion_especifica
    ON gestion (id_gestion_especifica)
    WHERE id_gestion_especifica IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_antecedente_gestion_gestion
    ON antecedente_gestion (id_gestion);
CREATE INDEX IF NOT EXISTS idx_antecedente_gestion_padre
    ON antecedente_gestion (id_antecedente_padre)
    WHERE id_antecedente_padre IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_antecedente_gestion_responsable
    ON antecedente_gestion (id_usuario_responsable)
    WHERE id_usuario_responsable IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_etapa_gestion_gestion
    ON etapa_gestion (id_gestion);
CREATE INDEX IF NOT EXISTS idx_etapa_gestion_responsable
    ON etapa_gestion (id_usuario_responsable)
    WHERE id_usuario_responsable IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entrada_bitacora_gestion_fecha
    ON entrada_bitacora (id_gestion, fecha_hora DESC);

CREATE INDEX IF NOT EXISTS idx_archivo_gestion_gestion_fecha
    ON archivo_gestion (id_gestion, fecha_carga DESC);
CREATE INDEX IF NOT EXISTS idx_archivo_gestion_antecedente_fecha
    ON archivo_gestion (id_antecedente_gestion, fecha_carga DESC)
    WHERE id_antecedente_gestion IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gestion_especifica_antecedente_antecedente
    ON gestion_especifica_antecedente (id_antecedente);

COMMIT;
