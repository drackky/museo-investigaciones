"""
Servicio de Documentos - Plataforma de Investigaciones del Museo
Gestiona documentos PDF, metadatos, tags y favoritos.
"""

import os
import logging
from datetime import datetime
from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify, send_file, g
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import jwt
import pymysql
from dotenv import load_dotenv
import magic
import hashlib
from PyPDF2 import PdfReader
import uuid

# Instalar PyMySQL como MySQLdb
pymysql.install_as_MySQLdb()

# Cargar variables de entorno
load_dotenv()

app = Flask(__name__)

# Configuración de la base de datos
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '3306')
DB_USER = os.getenv('DB_USER', 'root')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME = os.getenv('DB_NAME', 'museum_docs_db')

app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-key')
app.config['JSON_SORT_KEYS'] = False

# Configuración de archivos
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
MAX_FILE_SIZE = int(os.getenv('MAX_FILE_SIZE', 52428800))  # 50MB por defecto
ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'}  # Expandido para documentos académicos

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Crear directorio de uploads si no existe
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Inicializar extensiones
db = SQLAlchemy(app)
CORS(app)

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============================================================================
# MODELOS DE BASE DE DATOS
# =============================================================================

class Document(db.Model):
    __tablename__ = 'documents'
    
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(500), nullable=False)
    autor_id = db.Column(db.Integer, nullable=False)
    autor = db.Column(db.String(255))  # Nombre del autor
    institucion = db.Column(db.String(255))
    archivo_path = db.Column(db.String(1000), nullable=False)
    archivo_original = db.Column(db.String(255), nullable=False)
    descripcion = db.Column(db.Text)
    abstract = db.Column(db.Text)
    fecha_publicacion = db.Column(db.Date)
    tamaño_archivo = db.Column(db.BigInteger)
    tipo_mime = db.Column(db.String(100))
    visualizaciones = db.Column(db.Integer, default=0)
    descargas = db.Column(db.Integer, default=0)
    is_publico = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    tags = db.relationship('Tag', secondary='document_tags', backref='documents')
    favorites = db.relationship('Favorite', backref='document', cascade='all, delete-orphan')
    
    def to_dict(self, include_content=False):
        result = {
            'id': self.id,
            'titulo': self.titulo,
            'autor_id': self.autor_id,
            'autor': self.autor,
            'institucion': self.institucion,
            'archivo_original': self.archivo_original,
            'descripcion': self.descripcion,
            'abstract': self.abstract,
            'fecha_publicacion': self.fecha_publicacion.isoformat() if self.fecha_publicacion else None,
            'tamaño_archivo': self.tamaño_archivo,
            'tipo_mime': self.tipo_mime,
            'visualizaciones': self.visualizaciones,
            'descargas': self.descargas,
            'is_publico': self.is_publico,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'tags': [tag.to_dict() for tag in self.tags]
        }
        
        if include_content:
            result['archivo_path'] = self.archivo_path
            
        return result

class Tag(db.Model):
    __tablename__ = 'tags'
    
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), unique=True, nullable=False)
    descripcion = db.Column(db.Text)
    color = db.Column(db.String(7), default='#6B7280')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'descripcion': self.descripcion,
            'color': self.color,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class DocumentTag(db.Model):
    __tablename__ = 'document_tags'
    
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False)
    tag_id = db.Column(db.Integer, db.ForeignKey('tags.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Favorite(db.Model):
    __tablename__ = 'favorites'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# =============================================================================
# UTILIDADES
# =============================================================================

def allowed_file(filename):
    """Verificar si el archivo tiene una extensión permitida"""
    if not filename or '.' not in filename:
        return False
    extension = filename.rsplit('.', 1)[1].lower()
    return extension in ALLOWED_EXTENSIONS

def allowed_mime_type(mime_type):
    """Verificar si el tipo MIME es permitido para documentos académicos"""
    allowed_mimes = {
        'application/pdf',
        'application/x-pdf',
        'application/acrobat',
        'application/vnd.pdf',
        'text/pdf',
        'text/x-pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/rtf',
        'application/rtf',
        'application/vnd.oasis.opendocument.text'
    }
    return mime_type in allowed_mimes

def verify_token(token):
    """Verificar token JWT"""
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_current_user():
    """Obtener usuario actual del token"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header[7:]
    payload = verify_token(token)
    return payload

def generate_unique_filename(original_filename):
    """Generar nombre único para archivo"""
    name, ext = os.path.splitext(secure_filename(original_filename))
    unique_id = str(uuid.uuid4())
    return f"{unique_id}_{name}{ext}"

def extract_pdf_info(file_path):
    """Extraer información básica del PDF"""
    try:
        with open(file_path, 'rb') as file:
            reader = PdfReader(file)
            info = {
                'pages': len(reader.pages),
                'title': reader.metadata.title if reader.metadata else None,
                'author': reader.metadata.author if reader.metadata else None,
                'subject': reader.metadata.subject if reader.metadata else None
            }
            return info
    except Exception as e:
        logger.error(f'Error extrayendo info del PDF: {str(e)}')
        return None

# =============================================================================
# RUTAS DE DOCUMENTOS
# =============================================================================

@app.route('/health')
def health_check():
    """Health check del servicio"""
    try:
        # Verificar conexión a la base de datos
        db.session.execute(db.text('SELECT 1'))
        return jsonify({'status': 'healthy', 'service': 'documents-service'})
    except Exception as e:
        logger.error(f'Health check failed: {str(e)}')
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

@app.route('/api/v1/documents', methods=['GET'])
def get_documents():
    """Obtener lista de documentos con paginación y filtros"""
    try:
        # Parámetros de paginación
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 100, type=int), 100)  # Aumentado a 100 por defecto
        
        # Filtros
        autor_id = request.args.get('autor_id', type=int)
        tag = request.args.get('tag')
        institucion = request.args.get('institucion')
        publico_solo = request.args.get('publico_solo', 'true').lower() == 'true'
        
        logger.info(f'GET /api/v1/documents - Parámetros: page={page}, per_page={per_page}, autor_id={autor_id}, publico_solo={publico_solo}')
        
        # Construir query
        query = Document.query
        
        if publico_solo:
            query = query.filter(Document.is_publico == True)
        
        if autor_id:
            query = query.filter(Document.autor_id == autor_id)
        
        if institucion:
            query = query.filter(Document.institucion.contains(institucion))
        
        if tag:
            query = query.join(Document.tags).filter(Tag.nombre == tag)
        
        # Ordenar por ID descendente (más reciente primero)
        query = query.order_by(Document.id.desc())
        
        # Obtener todos los documentos sin paginar si es necesario
        total_count = query.count()
        logger.info(f'Total documentos encontrados antes de paginar: {total_count}')
        
        # Paginar
        documents = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        logger.info(f'Documentos en respuesta: {len(documents.items)} de {documents.total} total, Página: {page}/{documents.pages}')
        
        # Log de los primeros documentos para debug
        for doc in documents.items[:3]:
            logger.info(f'  - Doc ID {doc.id}: {doc.titulo} (publico={doc.is_publico})')
        
        return jsonify({
            'documents': [doc.to_dict() for doc in documents.items],
            'total': documents.total,
            'pages': documents.pages,
            'current_page': page,
            'per_page': per_page
        })
        
    except Exception as e:
        logger.error(f'Error obteniendo documentos: {str(e)}')
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'error': 'Error interno del servidor', 'details': str(e)}), 500

@app.route('/api/v1/documents/<int:document_id>', methods=['GET'])
def get_document(document_id):
    """Obtener un documento específico"""
    try:
        document = Document.query.get_or_404(document_id)
        
        # Verificar si es público o el usuario es el autor
        current_user = get_current_user()
        if not document.is_publico and (not current_user or current_user['user_id'] != document.autor_id):
            return jsonify({'error': 'Acceso denegado'}), 403
        
        # Incrementar visualizaciones
        document.visualizaciones += 1
        db.session.commit()
        
        return jsonify({
            'document': document.to_dict(include_content=True)
        })
        
    except Exception as e:
        logger.error(f'Error obteniendo documento: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/documents', methods=['POST'])
def create_document():
    """Crear nuevo documento"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        # Log de todos los archivos en request
        logger.info(f'Archivos en request.files: {list(request.files.keys())}')
        logger.info(f'Datos en request.form: {list(request.form.keys())}')
        
        # Verificar si hay archivo
        if 'file' not in request.files:
            return jsonify({'error': 'Archivo requerido'}), 400
        
        file = request.files['file']
        logger.info(f'FileStorage object: {file}')
        logger.info(f'file.filename: {file.filename}')
        logger.info(f'file.content_type: {file.content_type}')
        
        if file.filename == '':
            return jsonify({'error': 'Archivo no seleccionado'}), 400
        
        # Log detallado del archivo recibido
        logger.info(f'Archivo recibido - Nombre: {file.filename}, Tipo: {file.content_type}')
        
        # Validar extensión
        if not allowed_file(file.filename):
            logger.warning(f'Extensión rechazada: {file.filename}')
            return jsonify({'error': 'Solo se permiten archivos PDF'}), 400
        
        # Validar tipo MIME
        if not allowed_mime_type(file.content_type):
            logger.warning(f'Tipo MIME rechazado: {file.content_type} para archivo {file.filename}')
            return jsonify({'error': f'Tipo de archivo no válido: {file.content_type}. Solo se permiten documentos académicos (PDF, DOC, DOCX, TXT)'}), 400
        
        logger.info(f'Archivo validado exitosamente: {file.filename}')
        
        # Obtener datos del formulario
        titulo = request.form.get('titulo', '').strip()
        autor = request.form.get('autor', '').strip()
        descripcion = request.form.get('descripcion', '').strip()
        abstract = request.form.get('abstract', '').strip()
        institucion = request.form.get('institucion', '').strip()
        fecha_publicacion = request.form.get('fecha_publicacion')
        tags_string = request.form.get('tags', '')
        is_publico = request.form.get('is_publico', 'true').lower() == 'true'
        
        if not titulo:
            return jsonify({'error': 'Título es requerido'}), 400
        
        # Generar nombre único para archivo
        unique_filename = generate_unique_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        # Guardar archivo
        file.save(file_path)
        
        # Obtener información del archivo
        file_size = os.path.getsize(file_path)
        mime_type = magic.from_file(file_path, mime=True)
        
        # Extraer información del PDF
        pdf_info = extract_pdf_info(file_path)
        
        # Procesar fecha de publicación
        fecha_pub = None
        if fecha_publicacion:
            try:
                fecha_pub = datetime.strptime(fecha_publicacion, '%Y-%m-%d').date()
            except ValueError:
                pass
        
        # Crear documento
        document = Document(
            titulo=titulo,
            autor_id=current_user['user_id'],
            autor=autor,
            institucion=institucion,
            archivo_path=file_path,
            archivo_original=file.filename,
            descripcion=descripcion,
            abstract=abstract,
            fecha_publicacion=fecha_pub,
            tamaño_archivo=file_size,
            tipo_mime=mime_type,
            is_publico=is_publico
        )
        
        db.session.add(document)
        db.session.flush()  # Para obtener el ID
        
        # Procesar tags
        if tags_string:
            tag_names = [tag.strip() for tag in tags_string.split(',') if tag.strip()]
            for tag_name in tag_names:
                # Buscar o crear tag
                tag = Tag.query.filter_by(nombre=tag_name).first()
                if not tag:
                    tag = Tag(nombre=tag_name)
                    db.session.add(tag)
                    db.session.flush()
                
                # Agregar relación
                document_tag = DocumentTag(document_id=document.id, tag_id=tag.id)
                db.session.add(document_tag)
        
        db.session.commit()
        
        logger.info(f'Documento creado: {document.id} por usuario {current_user["user_id"]}')
        
        return jsonify({
            'message': 'Documento creado exitosamente',
            'document': document.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        # Limpiar archivo si hubo error
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        logger.error(f'Error creando documento: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/documents/<int:document_id>', methods=['PUT'])
def update_document(document_id):
    """Actualizar documento"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        document = Document.query.get_or_404(document_id)
        
        # Verificar que el usuario sea el autor
        if document.autor_id != current_user['user_id']:
            return jsonify({'error': 'Solo el autor puede modificar el documento'}), 403
        
        data = request.get_json()
        
        # Actualizar campos permitidos
        if 'titulo' in data:
            document.titulo = data['titulo'].strip()
        if 'descripcion' in data:
            document.descripcion = data['descripcion'].strip()
        if 'abstract' in data:
            document.abstract = data['abstract'].strip()
        if 'institucion' in data:
            document.institucion = data['institucion'].strip()
        if 'is_publico' in data:
            document.is_publico = bool(data['is_publico'])
        if 'fecha_publicacion' in data and data['fecha_publicacion']:
            try:
                document.fecha_publicacion = datetime.strptime(data['fecha_publicacion'], '%Y-%m-%d').date()
            except ValueError:
                pass
        
        document.updated_at = datetime.utcnow()
        
        # Actualizar tags si se proporcionan
        if 'tags' in data:
            # Eliminar tags existentes
            DocumentTag.query.filter_by(document_id=document.id).delete()
            
            # Agregar nuevos tags
            tag_names = [tag.strip() for tag in data['tags'] if tag.strip()]
            for tag_name in tag_names:
                tag = Tag.query.filter_by(nombre=tag_name).first()
                if not tag:
                    tag = Tag(nombre=tag_name)
                    db.session.add(tag)
                    db.session.flush()
                
                document_tag = DocumentTag(document_id=document.id, tag_id=tag.id)
                db.session.add(document_tag)
        
        db.session.commit()
        
        logger.info(f'Documento actualizado: {document.id}')
        
        return jsonify({
            'message': 'Documento actualizado exitosamente',
            'document': document.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error actualizando documento: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/documents/<int:document_id>', methods=['DELETE'])
def delete_document(document_id):
    """Eliminar documento"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        document = Document.query.get_or_404(document_id)
        
        # Verificar que el usuario sea el autor
        if document.autor_id != current_user['user_id']:
            return jsonify({'error': 'Solo el autor puede eliminar el documento'}), 403
        
        # Eliminar archivo físico
        if os.path.exists(document.archivo_path):
            os.remove(document.archivo_path)
        
        # Eliminar documento de la base de datos
        db.session.delete(document)
        db.session.commit()
        
        logger.info(f'Documento eliminado: {document_id}')
        
        return jsonify({'message': 'Documento eliminado exitosamente'})
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error eliminando documento: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/documents/<int:document_id>/download', methods=['GET'])
def download_document(document_id):
    """Descargar documento"""
    try:
        document = Document.query.get_or_404(document_id)
        
        # Verificar si es público o el usuario es el autor
        current_user = get_current_user()
        if not document.is_publico and (not current_user or current_user['user_id'] != document.autor_id):
            return jsonify({'error': 'Acceso denegado'}), 403
        
        # Incrementar contador de descargas
        document.descargas += 1
        db.session.commit()
        
        return send_file(
            document.archivo_path,
            as_attachment=True,
            download_name=document.archivo_original
        )
        
    except Exception as e:
        logger.error(f'Error descargando documento: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/documents/search', methods=['GET'])
def search_documents():
    """Buscar documentos"""
    try:
        query_text = request.args.get('q', '').strip()
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 10, type=int), 100)
        
        if not query_text:
            return jsonify({'error': 'Parámetro de búsqueda requerido'}), 400
        
        # Buscar en título, descripción y abstract
        search_query = Document.query.filter(
            db.or_(
                Document.titulo.contains(query_text),
                Document.descripcion.contains(query_text),
                Document.abstract.contains(query_text)
            )
        ).filter(Document.is_publico == True)
        
        # También buscar por tags
        tag_query = Document.query.join(Document.tags).filter(
            Tag.nombre.contains(query_text)
        ).filter(Document.is_publico == True)
        
        # Combinar queries y ordenar por ID descendente
        final_query = search_query.union(tag_query).order_by(Document.id.desc())
        
        documents = final_query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        return jsonify({
            'documents': [doc.to_dict() for doc in documents.items],
            'total': documents.total,
            'pages': documents.pages,
            'current_page': page,
            'query': query_text
        })
        
    except Exception as e:
        logger.error(f'Error buscando documentos: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/documents/<int:document_id>/favorite', methods=['POST'])
def toggle_favorite(document_id):
    """Agregar/quitar favorito"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        document = Document.query.get_or_404(document_id)
        
        # Buscar favorito existente
        favorite = Favorite.query.filter_by(
            user_id=current_user['user_id'],
            document_id=document_id
        ).first()
        
        if favorite:
            # Quitar favorito
            db.session.delete(favorite)
            action = 'removed'
        else:
            # Agregar favorito
            favorite = Favorite(
                user_id=current_user['user_id'],
                document_id=document_id
            )
            db.session.add(favorite)
            action = 'added'
        
        db.session.commit()
        
        return jsonify({
            'message': f'Favorito {action}',
            'is_favorite': action == 'added'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error con favorito: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

# =============================================================================
# RUTAS DE TAGS
# =============================================================================

@app.route('/api/v1/tags', methods=['GET'])
def get_tags():
    """Obtener lista de tags"""
    try:
        tags = Tag.query.order_by(Tag.nombre).all()
        return jsonify({
            'tags': [tag.to_dict() for tag in tags]
        })
    except Exception as e:
        logger.error(f'Error obteniendo tags: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

# =============================================================================
# MANEJADORES DE ERRORES
# =============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Recurso no encontrado'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Error interno del servidor'}), 500

@app.errorhandler(413)
def too_large(error):
    return jsonify({'error': 'Archivo demasiado grande'}), 413

# =============================================================================
# INICIALIZACIÓN
# =============================================================================

def create_tables():
    """Crear tablas de la base de datos"""
    try:
        db.create_all()
        
        # Migración: Agregar columna 'autor' si no existe
        with db.engine.connect() as conn:
            # Verificar si la columna existe
            result = conn.execute(db.text(
                "SELECT COUNT(*) as count FROM information_schema.columns "
                "WHERE table_name='documents' AND column_name='autor'"
            ))
            row = result.fetchone()
            
            if row[0] == 0:
                # La columna no existe, agregarla
                logger.info('Agregando columna autor a la tabla documents...')
                conn.execute(db.text(
                    "ALTER TABLE documents ADD COLUMN autor VARCHAR(255)"
                ))
                conn.commit()
                logger.info('Columna autor agregada exitosamente')
            else:
                logger.info('Columna autor ya existe en la tabla documents')
        
        logger.info('Tablas de base de datos creadas exitosamente')
    except Exception as e:
        logger.error(f'Error creando tablas: {str(e)}')

# =============================================================================
# RUTAS DE ESTADÍSTICAS
# =============================================================================

@app.route('/api/v1/documents/stats', methods=['GET'])
def get_documents_stats():
    """Obtener estadísticas de documentos"""
    try:
        total_documents = Document.query.filter_by(is_publico=True).count()
        total_private = Document.query.filter_by(is_publico=False).count()
        total_views = db.session.query(db.func.sum(Document.visualizaciones)).scalar() or 0
        
        # Documentos por categoría
        category_stats = db.session.query(
            Document.categoria,
            db.func.count(Document.id).label('count')
        ).filter_by(is_publico=True).group_by(Document.categoria).all()
        
        return jsonify({
            'total_documents': total_documents,
            'total_private': total_private,
            'total_views': total_views,
            'categories': {
                cat: count for cat, count in category_stats if cat
            }
        })
        
    except Exception as e:
        logger.error(f'Error obteniendo estadísticas: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

# =============================================================================
# RUTAS DE INTERACCIONES Y VISTAS
# =============================================================================

@app.route('/api/v1/documents/<int:document_id>/interactions', methods=['GET'])
def get_document_interactions(document_id):
    """Obtener estadísticas de interacciones de un documento"""
    try:
        document = Document.query.get_or_404(document_id)
        
        # Por ahora devolvemos datos mock ya que no tenemos tablas de interacciones
        # En el futuro se conectará a las tablas reales
        interactions = {
            'document_id': document_id,
            'views': document.visualizaciones or 0,
            'likes': 0,
            'favorites': 0,
            'downloads': 0,
            'shares': 0,
            'comments_count': 0,
            'is_liked': False,
            'is_favorited': False,
            'average_rating': 0.0,
            'user_rating': None
        }
        
        return jsonify(interactions)
        
    except Exception as e:
        logger.error(f'Error obteniendo interacciones del documento {document_id}: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/documents/<int:document_id>/view', methods=['POST'])
def track_document_view(document_id):
    """Registrar una nueva vista del documento"""
    try:
        document = Document.query.get_or_404(document_id)
        
        # Incrementar contador de visualizaciones
        if document.visualizaciones is None:
            document.visualizaciones = 0
        document.visualizaciones += 1
        
        db.session.commit()
        
        logger.info(f'Vista registrada para documento {document_id}')
        
        return jsonify({
            'message': 'Vista registrada exitosamente',
            'views': document.visualizaciones
        })
        
    except Exception as e:
        logger.error(f'Error registrando vista del documento {document_id}: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/documents/<int:document_id>/view', methods=['GET'])
def get_document_view_content(document_id):
    """Obtener contenido del documento para visualización"""
    try:
        document = Document.query.get_or_404(document_id)
        
        # Verificar si es público o si el usuario tiene acceso
        current_user = get_current_user()
        if not document.is_publico and (not current_user or current_user['user_id'] != document.autor_id):
            return jsonify({'error': 'No tienes permisos para ver este documento'}), 403
        
        # Incrementar visualizaciones automáticamente
        if document.visualizaciones is None:
            document.visualizaciones = 0
        document.visualizaciones += 1
        db.session.commit()
        
        return jsonify({
            'document': document.to_dict(),
            'content_url': f'/api/v1/documents/{document_id}/download',
            'views': document.visualizaciones
        })
        
    except Exception as e:
        logger.error(f'Error obteniendo vista del documento {document_id}: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

if __name__ == '__main__':
    # Crear tablas
    with app.app_context():
        create_tables()
    
    port = int(os.getenv('PORT', 5002))
    host = os.getenv('HOST', '0.0.0.0')
    debug = os.getenv('FLASK_ENV') == 'development'
    
    logger.info(f'Iniciando Documents Service en {host}:{port}')
    app.run(host=host, port=port, debug=debug)