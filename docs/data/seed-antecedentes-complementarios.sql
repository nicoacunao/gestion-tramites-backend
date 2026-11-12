-- Opciones del selector "Antecedentes complementarios" del frontend.
-- Son antecedentes de catálogo global; no se asocian a una gestión específica.

ALTER TABLE antecedente
    ADD COLUMN IF NOT EXISTS categoria VARCHAR(20) NOT NULL DEFAULT 'requerido';

DO $$
BEGIN
    ALTER TABLE antecedente
        ADD CONSTRAINT ck_antecedente_categoria
        CHECK (categoria IN ('requerido', 'complementario'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO antecedente (nombre, categoria)
VALUES
    ('Certificado de matrimonio', 'complementario'),
    ('Certificado de número', 'complementario'),
    ('Croquis de la instalación', 'complementario'),
    ('Informe complementario de seguridad', 'complementario'),
    ('Informe de Bomberos', 'complementario'),
    ('Informe de factibilidad de construcción (IFC)', 'complementario'),
    ('Otro documento (requiere validación de catálogo)', 'complementario')
ON CONFLICT (nombre) DO UPDATE SET categoria = EXCLUDED.categoria;
