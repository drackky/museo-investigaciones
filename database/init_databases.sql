-- =====================================================
-- Inicialización de bases de datos para el sistema de museo
-- Plataforma de Gestión de Investigaciones
-- =====================================================

-- Crear bases de datos si no existen
CREATE DATABASE IF NOT EXISTS museum_auth_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS museum_docs_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS museum_collections_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS museum_comments_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS museum_research_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =====================================================
-- AUTH SERVICE DATABASE
-- =====================================================
USE museum_auth_db;

-- Tabla de usuarios
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    nombre VARCHAR(255) NOT NULL,
    rol ENUM('investigador', 'invitado') NOT NULL DEFAULT 'invitado',
    institucion VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_rol (rol),
    INDEX idx_google_id (google_id)
);

-- Tabla de sesiones
CREATE TABLE sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_token_hash (token_hash),
    INDEX idx_expires_at (expires_at)
);

-- Tabla de intentos de login (seguridad)
CREATE TABLE login_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    success BOOLEAN DEFAULT FALSE,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_ip (email, ip_address),
    INDEX idx_attempted_at (attempted_at)
);

-- =====================================================
-- DOCUMENTS SERVICE DATABASE
-- =====================================================
USE museum_docs_db;

-- Tabla de documentos
CREATE TABLE documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(500) NOT NULL,
    autor_id INT NOT NULL,
    institucion VARCHAR(255),
    archivo_path VARCHAR(1000) NOT NULL,
    archivo_original VARCHAR(255) NOT NULL,
    descripcion TEXT,
    abstract TEXT,
    fecha_publicacion DATE,
    tamaño_archivo BIGINT,
    tipo_mime VARCHAR(100),
    visualizaciones INT DEFAULT 0,
    descargas INT DEFAULT 0,
    is_publico BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_autor_id (autor_id),
    INDEX idx_titulo (titulo),
    INDEX idx_institucion (institucion),
    INDEX idx_fecha_publicacion (fecha_publicacion),
    INDEX idx_is_publico (is_publico),
    FULLTEXT(titulo, descripcion, abstract)
);

-- Tabla de tags
CREATE TABLE tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    color VARCHAR(7) DEFAULT '#6B7280',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_nombre (nombre)
);

-- Tabla de relación documento-tags
CREATE TABLE document_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    tag_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE KEY unique_document_tag (document_id, tag_id),
    INDEX idx_document_id (document_id),
    INDEX idx_tag_id (tag_id)
);

-- Tabla de favoritos
CREATE TABLE favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    document_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_document (user_id, document_id),
    INDEX idx_user_id (user_id),
    INDEX idx_document_id (document_id)
);

-- =====================================================
-- COLLECTIONS SERVICE DATABASE
-- =====================================================
USE museum_collections_db;

-- Tabla de colecciones
CREATE TABLE collections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(500) NOT NULL,
    descripcion TEXT,
    portada_path VARCHAR(1000),
    autor_id INT NOT NULL,
    is_publica BOOLEAN DEFAULT TRUE,
    total_documentos INT DEFAULT 0,
    visualizaciones INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_autor_id (autor_id),
    INDEX idx_titulo (titulo),
    INDEX idx_is_publica (is_publica),
    FULLTEXT(titulo, descripcion)
);

-- Tabla de relación colección-documentos
CREATE TABLE collection_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    collection_id INT NOT NULL,
    document_id INT NOT NULL,
    orden INT DEFAULT 0,
    agregado_por INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    UNIQUE KEY unique_collection_document (collection_id, document_id),
    INDEX idx_collection_id (collection_id),
    INDEX idx_document_id (document_id),
    INDEX idx_orden (orden)
);

-- Tabla de suscripciones a colecciones
CREATE TABLE collection_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    collection_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_collection (user_id, collection_id),
    INDEX idx_user_id (user_id),
    INDEX idx_collection_id (collection_id)
);

-- =====================================================
-- COMMENTS SERVICE DATABASE
-- =====================================================
USE museum_comments_db;

-- Tabla de comentarios
CREATE TABLE comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    user_id INT NOT NULL,
    contenido TEXT NOT NULL,
    parent_id INT DEFAULT NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    likes_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
    INDEX idx_document_id (document_id),
    INDEX idx_user_id (user_id),
    INDEX idx_parent_id (parent_id),
    INDEX idx_created_at (created_at),
    FULLTEXT(contenido)
);

-- Tabla de likes en comentarios
CREATE TABLE comment_likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    comment_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    UNIQUE KEY unique_comment_user (comment_id, user_id),
    INDEX idx_comment_id (comment_id),
    INDEX idx_user_id (user_id)
);

-- Tabla de notificaciones
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    tipo ENUM('comment', 'reply', 'like', 'mention') NOT NULL,
    mensaje TEXT NOT NULL,
    documento_id INT,
    comentario_id INT,
    from_user_id INT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_tipo (tipo),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
);

-- =====================================================
-- RESEARCH SERVICE DATABASE
-- =====================================================
USE museum_research_db;

-- Tabla de investigaciones
CREATE TABLE investigations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    titulo VARCHAR(500) NOT NULL,
    descripcion TEXT,
    investigador_principal_id INT NOT NULL,
    institucion VARCHAR(255),
    estado ENUM('activa', 'concluida', 'adjunta', 'pausada') NOT NULL DEFAULT 'activa',
    prioridad ENUM('baja', 'media', 'alta', 'critica') NOT NULL DEFAULT 'media',
    fecha_inicio DATE,
    fecha_fin_estimada DATE,
    fecha_fin_real DATE,
    presupuesto DECIMAL(12,2),
    progreso_porcentaje INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_investigador_id (investigador_principal_id),
    INDEX idx_estado (estado),
    INDEX idx_prioridad (prioridad),
    INDEX idx_codigo (codigo),
    FULLTEXT(titulo, descripcion)
);

-- Tabla de miembros del equipo de investigación
CREATE TABLE investigation_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    investigation_id INT NOT NULL,
    user_id INT NOT NULL,
    rol ENUM('principal', 'colaborador', 'asistente') NOT NULL DEFAULT 'colaborador',
    fecha_incorporacion DATE DEFAULT (CURRENT_DATE),
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
    UNIQUE KEY unique_investigation_user (investigation_id, user_id),
    INDEX idx_investigation_id (investigation_id),
    INDEX idx_user_id (user_id),
    INDEX idx_rol (rol)
);

-- Tabla de tickets/tareas
CREATE TABLE tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    investigation_id INT NOT NULL,
    titulo VARCHAR(500) NOT NULL,
    descripcion TEXT,
    proyecto VARCHAR(255),
    tipo ENUM('tarea', 'bug', 'mejora', 'investigacion') NOT NULL DEFAULT 'tarea',
    prioridad ENUM('baja', 'media', 'alta', 'critica') NOT NULL DEFAULT 'media',
    estado ENUM('pendiente', 'en_progreso', 'en_revision', 'completado', 'cancelado') NOT NULL DEFAULT 'pendiente',
    asignado_a INT,
    creado_por INT NOT NULL,
    fecha_estimada DATE,
    horas_estimadas INT,
    horas_trabajadas INT DEFAULT 0,
    etiquetas JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
    INDEX idx_investigation_id (investigation_id),
    INDEX idx_asignado_a (asignado_a),
    INDEX idx_creado_por (creado_por),
    INDEX idx_estado (estado),
    INDEX idx_prioridad (prioridad),
    INDEX idx_codigo (codigo),
    FULLTEXT(titulo, descripcion)
);

-- Tabla de comentarios en tickets
CREATE TABLE ticket_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    user_id INT NOT NULL,
    comentario TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    INDEX idx_ticket_id (ticket_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- Tabla de historial de cambios
CREATE TABLE investigation_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    investigation_id INT,
    ticket_id INT,
    user_id INT NOT NULL,
    accion VARCHAR(100) NOT NULL,
    campo_modificado VARCHAR(100),
    valor_anterior TEXT,
    valor_nuevo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_investigation_id (investigation_id),
    INDEX idx_ticket_id (ticket_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- Tabla de archivos de investigación
CREATE TABLE investigation_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    investigation_id INT NOT NULL,
    ticket_id INT DEFAULT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_type ENUM('document', 'image', 'data', 'other') NOT NULL DEFAULT 'document',
    uploaded_by INT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    INDEX idx_investigation_id (investigation_id),
    INDEX idx_ticket_id (ticket_id),
    INDEX idx_uploaded_by (uploaded_by),
    INDEX idx_file_type (file_type)
);

-- =====================================================
-- DATOS DE PRUEBA
-- =====================================================

-- Insertar usuario administrador por defecto
USE museum_auth_db;
INSERT INTO users (email, password_hash, nombre, rol, institucion, is_active, email_verified) 
VALUES ('admin@museo.edu', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LdMxCyf4kQjd1.N/W', 'Administrador Sistema', 'investigador', 'Museo Académico', TRUE, TRUE);

-- Insertar algunos tags básicos
USE museum_docs_db;
INSERT INTO tags (nombre, descripcion, color) VALUES 
('Arqueología', 'Estudios arqueológicos y hallazgos', '#8B5CF6'),
('Historia', 'Investigaciones históricas', '#EF4444'),
('Antropología', 'Estudios antropológicos', '#10B981'),
('Arte', 'Historia y análisis del arte', '#F59E0B'),
('Paleontología', 'Estudios paleontológicos', '#6366F1'),
('Etnografía', 'Estudios etnográficos', '#EC4899'),
('Conservación', 'Técnicas de conservación', '#14B8A6'),
('Museología', 'Estudios museológicos', '#F97316');

COMMIT;