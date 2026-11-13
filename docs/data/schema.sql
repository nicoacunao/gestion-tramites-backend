CREATE TABLE usuario (
    id_usuario BIGINT GENERATED ALWAYS AS IDENTITY,
    rut VARCHAR(12) NOT NULL,
    contrasena_hash VARCHAR(255) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    primer_apellido VARCHAR(80) NOT NULL,
    segundo_apellido VARCHAR(80),
    correo VARCHAR(254) NOT NULL,
    telefono VARCHAR(30),
    descripcion VARCHAR(500),
    rol VARCHAR(100) NOT NULL,
    organizacion VARCHAR(150),

    CONSTRAINT pk_usuario PRIMARY KEY (id_usuario),
    CONSTRAINT uq_usuario_rut UNIQUE (rut),
    CONSTRAINT uq_usuario_correo UNIQUE (correo)
);

CREATE TABLE estacion (
    id_estacion VARCHAR(20),
    direccion VARCHAR(250) NOT NULL,
    comuna VARCHAR(100) NOT NULL,
    razon_social VARCHAR(150) NOT NULL,
    jefe_zona VARCHAR(150),
    jefe_comercial VARCHAR(150),
    rut_sociedad VARCHAR(12),
    nombre_representante_legal VARCHAR(150),
    rut_representante_legal VARCHAR(12),
    status VARCHAR(30) NOT NULL DEFAULT 'No',

    CONSTRAINT pk_estacion PRIMARY KEY (id_estacion)
);

CREATE TABLE ambito_gestion (
    codigo_ambito VARCHAR(10),

    nombre VARCHAR(100) NOT NULL,

    CONSTRAINT pk_ambito_gestion PRIMARY KEY (codigo_ambito),
    CONSTRAINT uq_ambito_gestion_nombre UNIQUE (nombre)
);

CREATE TABLE tipo_gestion (
    id_tipo_gestion VARCHAR(80),

    nombre VARCHAR(150) NOT NULL,
    etiqueta_segundo_nivel VARCHAR(150) NOT NULL DEFAULT 'Gestión específica',
    requiere_seleccion_segundo_nivel_principal BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT pk_tipo_gestion PRIMARY KEY (id_tipo_gestion),
    CONSTRAINT uq_tipo_gestion_nombre UNIQUE (nombre)
);

CREATE TABLE antecedente (
    id_antecedente BIGINT GENERATED ALWAYS AS IDENTITY,

    nombre VARCHAR(300) NOT NULL,
    categoria VARCHAR(20) NOT NULL DEFAULT 'requerido',

    CONSTRAINT pk_antecedente PRIMARY KEY (id_antecedente),
    CONSTRAINT uq_antecedente_nombre UNIQUE (nombre),
    CONSTRAINT ck_antecedente_categoria
        CHECK (categoria IN ('requerido', 'complementario'))
);

CREATE TABLE etapa (
    id_etapa BIGINT GENERATED ALWAYS AS IDENTITY,

    nombre VARCHAR(200) NOT NULL,
    porcentaje SMALLINT NOT NULL,
    orden INTEGER NOT NULL,

    CONSTRAINT pk_etapa PRIMARY KEY (id_etapa),
    CONSTRAINT uq_etapa_nombre UNIQUE (nombre),
    CONSTRAINT uq_etapa_orden UNIQUE (orden),
    CONSTRAINT ck_etapa_porcentaje CHECK (porcentaje BETWEEN 0 AND 100),
    CONSTRAINT ck_etapa_orden CHECK (orden > 0)
);

CREATE TABLE gestion_especifica (
    id_gestion_especifica BIGINT GENERATED ALWAYS AS IDENTITY,

    id_tipo_gestion VARCHAR(80) NOT NULL,
    codigo VARCHAR(100) NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_gestion_especifica
        PRIMARY KEY (id_gestion_especifica),

    CONSTRAINT uq_gestion_especifica_codigo
        UNIQUE (codigo),

    CONSTRAINT uq_gestion_especifica_tipo_nombre
        UNIQUE (id_tipo_gestion, nombre),

    CONSTRAINT fk_gestion_especifica_tipo
        FOREIGN KEY (id_tipo_gestion)
        REFERENCES tipo_gestion (id_tipo_gestion)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE gestion_especifica_antecedente (
    id_gestion_especifica BIGINT NOT NULL,
    id_antecedente BIGINT NOT NULL,
    id_antecedente_padre BIGINT,
    nivel VARCHAR(2) NOT NULL,
    orden INTEGER NOT NULL,

    CONSTRAINT pk_gestion_especifica_antecedente
        PRIMARY KEY (id_gestion_especifica, id_antecedente),

    CONSTRAINT uq_gestion_especifica_antecedente_orden
        UNIQUE (id_gestion_especifica, orden),

    CONSTRAINT ck_gestion_especifica_antecedente_orden
        CHECK (orden > 0),

    CONSTRAINT ck_gestion_especifica_antecedente_nivel
        CHECK (nivel IN ('N2', 'N3', 'N4')),

    CONSTRAINT fk_gestion_especifica_antecedente_especifica
        FOREIGN KEY (id_gestion_especifica)
        REFERENCES gestion_especifica (id_gestion_especifica)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_gestion_especifica_antecedente_catalogo
        FOREIGN KEY (id_antecedente)
        REFERENCES antecedente (id_antecedente)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_gestion_especifica_antecedente_padre
        FOREIGN KEY (id_antecedente_padre)
        REFERENCES antecedente (id_antecedente)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE gestion (
    id_gestion BIGINT GENERATED ALWAYS AS IDENTITY,

    codigo VARCHAR(30) NOT NULL,
    id_estacion VARCHAR(20) NOT NULL,
    id_tipo_gestion VARCHAR(80) NOT NULL,
    id_gestion_especifica BIGINT,
    codigo_ambito VARCHAR(10) NOT NULL,
    id_usuario_responsable BIGINT,

    nivel VARCHAR(2) NOT NULL,
    correlativo INTEGER NOT NULL,
    modalidad_creacion VARCHAR(20) NOT NULL,
    estado VARCHAR(30) NOT NULL,
    prioridad VARCHAR(10) NOT NULL,

    responsable_nombre VARCHAR(150) NOT NULL,
    nombre_solicitante VARCHAR(150) NOT NULL,

    razon_social VARCHAR(150) NOT NULL,
    rut_razon_social VARCHAR(12),
    representante_legal VARCHAR(150),
    rut_representante_legal VARCHAR(12),

    fecha_apertura DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_estimada_termino DATE,
    fecha_ultima_revision DATE,

    CONSTRAINT pk_gestion PRIMARY KEY (id_gestion),

    CONSTRAINT uq_gestion_codigo UNIQUE (codigo),

    CONSTRAINT uq_gestion_correlativo
        UNIQUE (nivel, codigo_ambito, correlativo),

    CONSTRAINT ck_gestion_nivel
        CHECK (nivel IN ('N1', 'N2', 'N3', 'N4')),

    CONSTRAINT ck_gestion_correlativo
        CHECK (correlativo > 0),

    CONSTRAINT ck_gestion_modalidad
        CHECK (modalidad_creacion IN ('principal', 'subtramite')),

    CONSTRAINT ck_gestion_subtramite_especifico
        CHECK (
            modalidad_creacion = 'principal'
            OR id_gestion_especifica IS NOT NULL
        ),

    CONSTRAINT ck_gestion_estado
        CHECK (
            estado IN (
                'Borrador',
                'Pendiente',
                'Ingresado',
                'En tramitación',
                'Observado',
                'Reingresado',
                'Rechazado',
                'Terminado aprobado',
                'Terminado desfavorable'
            )
        ),

    CONSTRAINT ck_gestion_prioridad
        CHECK (prioridad IN ('Alta', 'Media', 'Baja')),

    CONSTRAINT ck_gestion_fechas
        CHECK (
            fecha_estimada_termino IS NULL
            OR fecha_estimada_termino >= fecha_apertura
        ),

    CONSTRAINT fk_gestion_estacion
        FOREIGN KEY (id_estacion)
        REFERENCES estacion (id_estacion)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_gestion_tipo
        FOREIGN KEY (id_tipo_gestion)
        REFERENCES tipo_gestion (id_tipo_gestion)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_gestion_especifica
        FOREIGN KEY (id_gestion_especifica)
        REFERENCES gestion_especifica (id_gestion_especifica)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_gestion_ambito
        FOREIGN KEY (codigo_ambito)
        REFERENCES ambito_gestion (codigo_ambito)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_gestion_usuario_responsable
        FOREIGN KEY (id_usuario_responsable)
        REFERENCES usuario (id_usuario)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE gestion_subtramite (
    id_gestion BIGINT NOT NULL,
    id_gestion_especifica BIGINT NOT NULL,

    CONSTRAINT pk_gestion_subtramite PRIMARY KEY (id_gestion, id_gestion_especifica),
    CONSTRAINT fk_gestion_subtramite_gestion FOREIGN KEY (id_gestion)
        REFERENCES gestion (id_gestion) ON DELETE RESTRICT,
    CONSTRAINT fk_gestion_subtramite_especifica FOREIGN KEY (id_gestion_especifica)
        REFERENCES gestion_especifica (id_gestion_especifica) ON DELETE RESTRICT
);

CREATE TABLE antecedente_gestion (
    id_antecedente_gestion BIGINT GENERATED ALWAYS AS IDENTITY,

    id_gestion BIGINT NOT NULL,
    id_antecedente_padre BIGINT,
    id_antecedente BIGINT,

    nivel VARCHAR(2) NOT NULL,
    categoria VARCHAR(20) NOT NULL,
    nombre_mostrado VARCHAR(300) NOT NULL,
    flag_obligatorio BOOLEAN NOT NULL DEFAULT FALSE,

    solicitado_por VARCHAR(150),
    id_usuario_responsable BIGINT,
    responsable_nombre VARCHAR(150) NOT NULL,

    estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
    observaciones VARCHAR(2000),

    archivo_nombre VARCHAR(255),
    archivo_referencia VARCHAR(500),
    fecha_carga TIMESTAMPTZ,
    id_usuario_carga BIGINT,
    cargado_por VARCHAR(150),

    CONSTRAINT pk_antecedente_gestion
        PRIMARY KEY (id_antecedente_gestion),

    CONSTRAINT ck_antecedente_gestion_nivel
        CHECK (nivel IN ('N2', 'N3', 'N4')),

    CONSTRAINT ck_antecedente_gestion_categoria
        CHECK (categoria IN ('requerido', 'complementario', 'adicional')),

    CONSTRAINT ck_antecedente_gestion_requerido
        CHECK (
            categoria <> 'requerido'
            OR flag_obligatorio = TRUE
        ),

    CONSTRAINT ck_antecedente_gestion_estado
        CHECK (estado IN ('Pendiente', 'Recibido', 'Recibido conforme')),

    CONSTRAINT ck_antecedente_gestion_archivo
        CHECK (
            archivo_referencia IS NULL
            OR fecha_carga IS NOT NULL
        ),

    CONSTRAINT fk_antecedente_gestion_gestion
        FOREIGN KEY (id_gestion)
        REFERENCES gestion (id_gestion)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_antecedente_gestion_padre
        FOREIGN KEY (id_antecedente_padre)
        REFERENCES antecedente_gestion (id_antecedente_gestion)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_antecedente_gestion_catalogo
        FOREIGN KEY (id_antecedente)
        REFERENCES antecedente (id_antecedente)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_antecedente_gestion_usuario_responsable
        FOREIGN KEY (id_usuario_responsable)
        REFERENCES usuario (id_usuario)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_antecedente_gestion_usuario_carga
        FOREIGN KEY (id_usuario_carga)
        REFERENCES usuario (id_usuario)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE etapa_gestion (
    id_etapa_gestion BIGINT GENERATED ALWAYS AS IDENTITY,

    id_gestion BIGINT NOT NULL,
    id_etapa BIGINT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    fecha_estimada DATE,
    fecha_real DATE,
    id_usuario_responsable BIGINT,
    responsable_nombre VARCHAR(150),
    observaciones VARCHAR(300),

    CONSTRAINT pk_etapa_gestion
        PRIMARY KEY (id_etapa_gestion),

    CONSTRAINT uq_etapa_gestion_gestion_etapa
        UNIQUE (id_gestion, id_etapa),

    CONSTRAINT ck_etapa_gestion_estado
        CHECK (estado IN ('Pendiente', 'En curso', 'Completado')),

    CONSTRAINT ck_etapa_gestion_fecha_real
        CHECK (
            fecha_real IS NULL
            OR fecha_estimada IS NULL
            OR fecha_real >= fecha_estimada
        ),

    CONSTRAINT fk_etapa_gestion_gestion
        FOREIGN KEY (id_gestion)
        REFERENCES gestion (id_gestion)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_etapa_gestion_etapa
        FOREIGN KEY (id_etapa)
        REFERENCES etapa (id_etapa)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_etapa_gestion_usuario_responsable
        FOREIGN KEY (id_usuario_responsable)
        REFERENCES usuario (id_usuario)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE entrada_bitacora (
    id_entrada_bitacora BIGINT GENERATED ALWAYS AS IDENTITY,

    codigo_externo VARCHAR(100),
    id_gestion BIGINT NOT NULL,
    id_usuario BIGINT,

    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
    autor_nombre VARCHAR(150) NOT NULL,
    autor_iniciales VARCHAR(10) NOT NULL,

    tipo VARCHAR(20),
    titulo VARCHAR(80) NOT NULL,
    comentario VARCHAR(1000) NOT NULL,
    automatica BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT pk_entrada_bitacora
        PRIMARY KEY (id_entrada_bitacora),

    CONSTRAINT uq_entrada_bitacora_codigo_externo
        UNIQUE (codigo_externo),

    CONSTRAINT ck_entrada_bitacora_tipo
        CHECK (
            tipo IS NULL
            OR tipo IN ('inicio', 'novedad', 'seguimiento', 'contacto')
        ),

    CONSTRAINT fk_entrada_bitacora_gestion
        FOREIGN KEY (id_gestion)
        REFERENCES gestion (id_gestion)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_entrada_bitacora_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario (id_usuario)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE archivo_gestion (
    id_archivo VARCHAR(100) PRIMARY KEY,
    id_gestion BIGINT NOT NULL REFERENCES gestion (id_gestion) ON DELETE RESTRICT,
    id_antecedente_gestion BIGINT REFERENCES antecedente_gestion (id_antecedente_gestion) ON DELETE RESTRICT,
    proveedor VARCHAR(30) NOT NULL,
    referencia_almacenamiento VARCHAR(500) NOT NULL UNIQUE,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_mime VARCHAR(150) NOT NULL,
    tamano_bytes BIGINT NOT NULL CHECK (tamano_bytes >= 0),
    id_usuario_carga BIGINT NOT NULL REFERENCES usuario (id_usuario),
    fecha_carga TIMESTAMPTZ NOT NULL DEFAULT now()
);
