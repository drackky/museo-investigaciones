"""
Servicio de Colecciones - Plataforma de Investigaciones del Museo
Gestiona colecciones temáticas de documentos.
"""

# =============================================================================
# IMPORTS
# =============================================================================
import os
import logging
from datetime import datetime
from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import jwt
import pymysql
from dotenv import load_dotenv
import magic
import uuid
from PIL import Image
import requests

# PyMySQL debe registrarse como MySQLdb antes de que SQLAlchemy lo use
pymysql.install_as_MySQLdb()

# Cargar variables de entorno desde el archivo .env
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# =============================================================================
# CONFIGURACIÓN DE LA APLICACIÓN
# =============================================================================

app = Flask(__name__)

# --- Configuración de base de datos MySQL ---
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '3306')
DB_USER = os.getenv('DB_USER', 'root')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME = os.getenv('DB_NAME', 'museum_collections_db')

app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False  # Deshabilitar tracking para ahorrar memoria
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-key')  # Clave para firmar JWT
app.config['JSON_SORT_KEYS'] = False  # Mantener orden de campos en respuestas JSON

# --- Configuración de subida de archivos (imágenes de portada) ---
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
MAX_FILE_SIZE = int(os.getenv('MAX_FILE_SIZE', 15728640))  # 15MB máximo para imágenes
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'svg'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Crear directorio de uploads si no existe
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- Inicializar extensiones ---
db = SQLAlchemy(app)
CORS(app)

# --- Configurar logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# URL base del servicio de documentos para consultas internas entre microservicios
DOCUMENTS_SERVICE_URL = os.getenv('DOCUMENTS_SERVICE_URL', 'http://localhost:5002')

# =============================================================================
# MODELOS DE BASE DE DATOS
# =============================================================================

class Collection(db.Model):
    """Modelo que representa una colección temática de documentos."""
    __tablename__ = 'collections'
    
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(500), nullable=False)               # Título de la colección
    descripcion = db.Column(db.Text)                                  # Descripción detallada
    portada_path = db.Column(db.String(1000))                         # Ruta al archivo de imagen de portada
    autor_id = db.Column(db.Integer, nullable=False)                  # ID del usuario creador (desnormalizado)
    is_publica = db.Column(db.Boolean, default=True)                  # Visibilidad: true=pública, false=privada
    total_documentos = db.Column(db.Integer, default=0)               # Contador cacheado de documentos
    visualizaciones = db.Column(db.Integer, default=0)                # Contador de visitas
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones ORM (cascade elimina documentos suscritos al eliminar la colección)
    documents = db.relationship('CollectionDocument', backref='collection', cascade='all, delete-orphan')
    subscriptions = db.relationship('CollectionSubscription', backref='collection', cascade='all, delete-orphan')
    
    def to_dict(self, include_documents=False):
        """Convierte la colección a diccionario serializable."""
        result = {
            'id': self.id,
            'titulo': self.titulo,
            'descripcion': self.descripcion,
            'portada_path': self.portada_path,
            'autor_id': self.autor_id,
            'is_publica': self.is_publica,
            'total_documentos': self.total_documentos,
            'visualizaciones': self.visualizaciones,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_documents:
            result['documents'] = [doc.to_dict() for doc in self.documents]
            
        return result

class CollectionDocument(db.Model):
    """Tabla pivote muchos-a-muchos entre colecciones y documentos."""
    __tablename__ = 'collection_documents'
    
    id = db.Column(db.Integer, primary_key=True)
    collection_id = db.Column(db.Integer, db.ForeignKey('collections.id'), nullable=False)
    document_id = db.Column(db.Integer, nullable=False)      # ID del documento (referencia al documents-service)
    orden = db.Column(db.Integer, default=0)                  # Posición dentro de la colección
    agregado_por = db.Column(db.Integer, nullable=False)      # ID del usuario que agregó el documento
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """Convierte la relación documento-colección a diccionario."""
        return {
            'id': self.id,
            'collection_id': self.collection_id,
            'document_id': self.document_id,
            'orden': self.orden,
            'agregado_por': self.agregado_por,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class CollectionSubscription(db.Model):
    """Modelo que registra suscripciones de usuarios a colecciones."""
    __tablename__ = 'collection_subscriptions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)                    # ID del usuario suscrito
    collection_id = db.Column(db.Integer, db.ForeignKey('collections.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# =============================================================================
# UTILIDADES
# =============================================================================

def allowed_file(filename):
    """Verifica si la extensión del archivo está en la lista de permitidas."""
    if not filename or '.' not in filename:
        return False
    extension = filename.rsplit('.', 1)[1].lower()
    return extension in ALLOWED_EXTENSIONS

def allowed_mime_type(mime_type):
    """Verifica si el tipo MIME corresponde a una imagen válida."""
    allowed_mimes = {
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/tiff',
        'image/svg+xml'
    }
    return mime_type in allowed_mimes

def verify_token(token):
    """Decodifica y verifica un token JWT usando la clave secreta compartida.
    Retorna el payload si es válido, None si expiró o es inválido.
    """
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_current_user():
    """Extrae el usuario autenticado desde el header Authorization.
    Retorna el payload del JWT o None si no hay token válido.
    """
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header[7:]  # Remover 'Bearer ' del inicio
    payload = verify_token(token)
    return payload

def generate_unique_filename(original_filename):
    """Genera un nombre único para evitar colisiones al guardar archivos."""
    name, ext = os.path.splitext(secure_filename(original_filename))
    unique_id = str(uuid.uuid4())
    return f"{unique_id}_{name}{ext}"

def resize_image(image_path, max_width=800, max_height=600):
    """Redimensiona una imagen manteniendo la proporción si excede las dimensiones máximas."""
    try:
        with Image.open(image_path) as img:
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            
            width, height = img.size
            ratio = min(max_width/width, max_height/height)
            
            if ratio < 1:
                new_width = int(width * ratio)
                new_height = int(height * ratio)
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                img.save(image_path, 'JPEG', quality=85, optimize=True)
            
        return True
    except Exception as e:
        logger.error(f'Error redimensionando imagen: {str(e)}')
        return False

def get_document_info(document_id, auth_token=None):
    """Consulta el servicio de documentos para obtener información de un documento.
    Usa comunicación HTTP interna entre microservicios.
    """
    try:
        headers = {}
        if auth_token:
            headers['Authorization'] = f'Bearer {auth_token}'
        
        response = requests.get(
            f'{DOCUMENTS_SERVICE_URL}/api/v1/documents/{document_id}',
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return None
    except Exception as e:
        logger.error(f'Error obteniendo info del documento {document_id}: {str(e)}')
        return None

# =============================================================================
# RUTAS DE COLECCIONES
# =============================================================================

@app.route('/health')
def health_check():
    """Health check del servicio"""
    try:
        # Verificar conexión a la base de datos
        db.session.execute(db.text('SELECT 1'))
        return jsonify({'status': 'healthy', 'service': 'collections-service'})
    except Exception as e:
        logger.error(f'Health check failed: {str(e)}')
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

@app.route('/api/v1/collections', methods=['GET'])
def get_collections():
    """Obtiene lista paginada de colecciones con filtros opcionales (autor, búsqueda, visibilidad)."""
    try:
        current_user = get_current_user()
        
        # Parámetros de paginación con límite máximo de 100 por página
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 12, type=int), 100)
        
        # Filtros desde query string
        autor_id = request.args.get('autor_id', type=int)
        publicas_solo = request.args.get('publicas_solo', 'true').lower() == 'true'
        mis_colecciones = request.args.get('mis_colecciones', 'false').lower() == 'true'
        buscar = request.args.get('search', '').strip()
        
        query = Collection.query
        
        # Lógica de visibilidad:
        # - Si pide "mis colecciones", filtra por autor
        # - Si no está autenticado o pide solo públicas: solo colecciones públicas
        # - Si está autenticado: muestra sus colecciones (públicas + privadas) y las públicas de otros
        if current_user and mis_colecciones:
            query = query.filter(Collection.autor_id == current_user['user_id'])
        else:
            if not current_user or publicas_solo:
                query = query.filter(Collection.is_publica == True)
            else:
                query = query.filter(
                    db.or_(
                        Collection.is_publica == True,
                        Collection.autor_id == current_user['user_id']
                    )
                )
        
        if autor_id:
            query = query.filter(Collection.autor_id == autor_id)
        
        # Búsqueda por texto en título o descripción
        if buscar:
            query = query.filter(
                db.or_(
                    Collection.titulo.contains(buscar),
                    Collection.descripcion.contains(buscar)
                )
            )
        
        query = query.order_by(Collection.created_at.desc())
        collections = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'collections': [col.to_dict() for col in collections.items],
            'total': collections.total,
            'pages': collections.pages,
            'current_page': page,
            'per_page': per_page
        })
        
    except Exception as e:
        logger.error(f'Error obteniendo colecciones: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/collections/<int:collection_id>', methods=['GET'])
def get_collection(collection_id):
    """Obtiene una colección por ID, incluyendo sus documentos enriquecidos con datos del documents-service."""
    try:
        collection = Collection.query.get_or_404(collection_id)
        
        # Verificar acceso: solo el autor puede ver colecciones privadas
        current_user = get_current_user()
        if not collection.is_publica and (not current_user or current_user['user_id'] != collection.autor_id):
            return jsonify({'error': 'Acceso denegado'}), 403
        
        # Incrementar contador de visitas
        collection.visualizaciones += 1
        db.session.commit()
        
        # Obtener información completa de cada documento desde el documents-service
        documents_info = []
        auth_token = request.headers.get('Authorization', '').replace('Bearer ', '') if request.headers.get('Authorization') else None
        
        for col_doc in collection.documents:
            doc_info = get_document_info(col_doc.document_id, auth_token)
            if doc_info and 'document' in doc_info:
                document_data = doc_info['document']
                document_data['orden_en_coleccion'] = col_doc.orden
                document_data['agregado_en'] = col_doc.created_at.isoformat()
                documents_info.append(document_data)
        
        documents_info.sort(key=lambda x: x.get('orden_en_coleccion', 0))
        
        result = collection.to_dict()
        result['documents'] = documents_info
        
        return jsonify({'collection': result})
        
    except Exception as e:
        logger.error(f'Error obteniendo colección: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/collections', methods=['POST'])
def create_collection():
    """Crea una nueva colección. Soporta JSON y multipart/form-data (para imagen de portada)."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        # Soporta dos formatos de entrada: JSON (sin portada) o multipart (con portada)
        if request.content_type and 'multipart/form-data' in request.content_type:
            titulo = request.form.get('titulo', '').strip()
            descripcion = request.form.get('descripcion', '').strip()
            is_publica = request.form.get('is_publica', 'true').lower() == 'true'
            portada_file = request.files.get('portada')
        else:
            data = request.get_json()
            titulo = data.get('titulo', '').strip()
            descripcion = data.get('descripcion', '').strip()
            is_publica = data.get('is_publica', True)
            portada_file = None
        
        if not titulo:
            return jsonify({'error': 'Título es requerido'}), 400
        
        # Procesar imagen de portada (validación de tipo, almacenamiento y redimensionamiento)
        portada_path = None
        if portada_file and portada_file.filename != '':
            if not allowed_file(portada_file.filename):
                logger.warning(f'Archivo rechazado por extensión: {portada_file.filename}')
                return jsonify({'error': 'Solo se permiten imágenes (PNG, JPG, JPEG, GIF, WebP)'}), 400
            
            if hasattr(portada_file, 'content_type') and portada_file.content_type:
                if not allowed_mime_type(portada_file.content_type):
                    logger.warning(f'Archivo rechazado por MIME type: {portada_file.content_type}')
                    return jsonify({'error': f'Tipo de archivo no permitido: {portada_file.content_type}'}), 400
            
            logger.info(f'Procesando archivo: {portada_file.filename}, tipo: {portada_file.content_type if hasattr(portada_file, "content_type") else "desconocido"}')
            
            unique_filename = generate_unique_filename(portada_file.filename)
            portada_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            portada_file.save(portada_path)
            
            if not resize_image(portada_path):
                os.remove(portada_path)
                portada_path = None
        
        collection = Collection(
            titulo=titulo,
            descripcion=descripcion,
            portada_path=portada_path,
            autor_id=current_user['user_id'],
            is_publica=is_publica
        )
        
        db.session.add(collection)
        db.session.commit()
        
        logger.info(f'Colección creada: {collection.id} por usuario {current_user["user_id"]}')
        
        return jsonify({
            'message': 'Colección creada exitosamente',
            'collection': collection.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        if 'portada_path' in locals() and portada_path and os.path.exists(portada_path):
            os.remove(portada_path)
        logger.error(f'Error creando colección: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/collections/<int:collection_id>', methods=['PUT'])
def update_collection(collection_id):
    """Actualiza los metadatos de una colección (solo el autor puede hacerlo)."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        collection = Collection.query.get_or_404(collection_id)
        
        # Solo el autor de la colección puede modificarla
        if collection.autor_id != current_user['user_id']:
            return jsonify({'error': 'Solo el autor puede modificar la colección'}), 403
        
        data = request.get_json()
        
        # Actualizar solo los campos permitidos
        if 'titulo' in data:
            collection.titulo = data['titulo'].strip()
        if 'descripcion' in data:
            collection.descripcion = data['descripcion'].strip()
        if 'is_publica' in data:
            collection.is_publica = bool(data['is_publica'])
        
        collection.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f'Colección actualizada: {collection.id}')
        
        return jsonify({
            'message': 'Colección actualizada exitosamente',
            'collection': collection.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error actualizando colección: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/collections/<int:collection_id>', methods=['DELETE'])
def delete_collection(collection_id):
    """Elimina una colección y su archivo de portada asociado (solo el autor)."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        collection = Collection.query.get_or_404(collection_id)
        
        if collection.autor_id != current_user['user_id']:
            return jsonify({'error': 'Solo el autor puede eliminar la colección'}), 403
        
        # Eliminar archivo de portada del sistema de archivos
        if collection.portada_path and os.path.exists(collection.portada_path):
            os.remove(collection.portada_path)
        
        db.session.delete(collection)
        db.session.commit()
        
        logger.info(f'Colección eliminada: {collection_id}')
        
        return jsonify({'message': 'Colección eliminada exitosamente'})
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error eliminando colección: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/collections/<int:collection_id>/documents', methods=['POST'])
def add_document_to_collection(collection_id):
    """Agrega un documento existente a una colección. Evita duplicados."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        collection = Collection.query.get_or_404(collection_id)
        
        if collection.autor_id != current_user['user_id']:
            return jsonify({'error': 'Solo el autor puede modificar la colección'}), 403
        
        data = request.get_json()
        
        if 'document_id' not in data:
            return jsonify({'error': 'ID del documento requerido'}), 400
        
        document_id = data['document_id']
        orden = data.get('orden', 0)
        
        # Validar que el documento exista consultando al documents-service
        auth_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        doc_info = get_document_info(document_id, auth_token)
        
        if not doc_info:
            return jsonify({'error': 'Documento no encontrado o no accesible'}), 404
        
        # Prevenir duplicados en la colección
        existing = CollectionDocument.query.filter_by(
            collection_id=collection_id,
            document_id=document_id
        ).first()
        
        if existing:
            return jsonify({'error': 'El documento ya está en la colección'}), 409
        
        collection_document = CollectionDocument(
            collection_id=collection_id,
            document_id=document_id,
            orden=orden,
            agregado_por=current_user['user_id']
        )
        
        db.session.add(collection_document)
        collection.total_documentos += 1
        collection.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f'Documento {document_id} agregado a colección {collection_id}')
        
        return jsonify({
            'message': 'Documento agregado a la colección exitosamente',
            'collection_document': collection_document.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error agregando documento a colección: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/collections/<int:collection_id>/documents/<int:document_id>', methods=['DELETE'])
def remove_document_from_collection(collection_id, document_id):
    """Quita un documento de una colección y actualiza el contador."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        collection = Collection.query.get_or_404(collection_id)
        
        if collection.autor_id != current_user['user_id']:
            return jsonify({'error': 'Solo el autor puede modificar la colección'}), 403
        
        collection_document = CollectionDocument.query.filter_by(
            collection_id=collection_id,
            document_id=document_id
        ).first()
        
        if not collection_document:
            return jsonify({'error': 'El documento no está en la colección'}), 404
        
        db.session.delete(collection_document)
        collection.total_documentos = max(0, collection.total_documentos - 1)
        collection.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f'Documento {document_id} quitado de colección {collection_id}')
        
        return jsonify({'message': 'Documento quitado de la colección exitosamente'})
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error quitando documento de colección: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/collections/<int:collection_id>/subscribe', methods=['POST'])
def toggle_subscription(collection_id):
    """Activa o desactiva la suscripción de un usuario a una colección (toggle)."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        collection = Collection.query.get_or_404(collection_id)
        
        # Solo colecciones públicas o propias pueden recibir suscripciones
        if not collection.is_publica and collection.autor_id != current_user['user_id']:
            return jsonify({'error': 'Acceso denegado'}), 403
        
        subscription = CollectionSubscription.query.filter_by(
            user_id=current_user['user_id'],
            collection_id=collection_id
        ).first()
        
        if subscription:
            db.session.delete(subscription)
            action = 'unsubscribed'
        else:
            subscription = CollectionSubscription(
                user_id=current_user['user_id'],
                collection_id=collection_id
            )
            db.session.add(subscription)
            action = 'subscribed'
        
        db.session.commit()
        
        return jsonify({
            'message': f'Successfully {action}',
            'is_subscribed': action == 'subscribed'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error con suscripción: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/collections/<int:collection_id>/portada', methods=['GET'])
def get_collection_cover(collection_id):
    """Sirve la imagen de portada de una colección como archivo estático."""
    try:
        collection = Collection.query.get_or_404(collection_id)
        
        if not collection.portada_path or not os.path.exists(collection.portada_path):
            return jsonify({'error': 'Portada no encontrada'}), 404
        
        return send_file(collection.portada_path)
        
    except Exception as e:
        logger.error(f'Error obteniendo portada: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

# =============================================================================
# RUTAS DE ESTADÍSTICAS
# =============================================================================

@app.route('/api/v1/collections/stats', methods=['GET'])
def get_collections_stats():
    """Obtiene estadísticas globales de colecciones (totales, documentos, top más vistas)."""
    try:
        total_collections = Collection.query.filter_by(is_publica=True).count()
        total_documents = db.session.query(
            db.func.sum(Collection.total_documentos)
        ).filter_by(is_publica=True).scalar() or 0
        
        top_collections = Collection.query.filter_by(is_publica=True)\
            .order_by(Collection.visualizaciones.desc())\
            .limit(5).all()
        
        return jsonify({
            'total_collections': total_collections,
            'total_documents_in_collections': total_documents,
            'top_collections': [col.to_dict() for col in top_collections]
        })
        
    except Exception as e:
        logger.error(f'Error obteniendo estadísticas: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

# =============================================================================
# MANEJADORES DE ERRORES GLOBALES
# =============================================================================

@app.errorhandler(404)
def not_found(error):
    """Responde con JSON cuando no se encuentra un recurso."""
    return jsonify({'error': 'Recurso no encontrado'}), 404

@app.errorhandler(500)
def internal_error(error):
    """Responde con JSON ante errores internos no capturados."""
    return jsonify({'error': 'Error interno del servidor'}), 500

@app.errorhandler(413)
def too_large(error):
    """Responde cuando el archivo subido excede el tamaño máximo permitido."""
    return jsonify({'error': 'Archivo demasiado grande'}), 413

# =============================================================================
# INICIALIZACIÓN Y ARRANQUE
# =============================================================================

def create_tables():
    """Crea las tablas en la base de datos si no existen (sincronización del modelo)."""
    try:
        db.create_all()
        logger.info('Tablas de base de datos creadas exitosamente')
    except Exception as e:
        logger.error(f'Error creando tablas: {str(e)}')

if __name__ == '__main__':
    with app.app_context():
        create_tables()
    
    port = int(os.getenv('PORT', 5003))
    host = os.getenv('HOST', '0.0.0.0')
    debug = os.getenv('FLASK_ENV') == 'development'
    
    logger.info(f'Iniciando Collections Service en {host}:{port}')
    app.run(host=host, port=port, debug=debug)
