-- Hace explícito que el nombre del autor es histórico y no un segundo dato
-- vigente del usuario.

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'entrada_bitacora'
          AND column_name = 'autor_nombre'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'entrada_bitacora'
          AND column_name = 'autor_nombre_snapshot'
    ) THEN
        ALTER TABLE entrada_bitacora
            RENAME COLUMN autor_nombre TO autor_nombre_snapshot;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'entrada_bitacora'
          AND column_name = 'autor_iniciales'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'entrada_bitacora'
          AND column_name = 'autor_iniciales_snapshot'
    ) THEN
        ALTER TABLE entrada_bitacora
            RENAME COLUMN autor_iniciales TO autor_iniciales_snapshot;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_entrada_bitacora_autor'
          AND conrelid = 'entrada_bitacora'::regclass
    ) THEN
        ALTER TABLE entrada_bitacora
            ADD CONSTRAINT ck_entrada_bitacora_autor
            CHECK (id_usuario IS NOT NULL OR automatica = TRUE);
    END IF;
END $$;

COMMIT;
