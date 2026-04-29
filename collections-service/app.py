"""
Servicio de Colecciones - Plataforma de Investigaciones del Museo
Gestiona colecciones temáticas de documentos.
"""

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
DB_NAME = os.getenv('DB_NAME', 'museum_collections_db')

app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-key')
app.config['JSON_SORT_KEYS'] = False

# Configuración de archivos
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
MAX_FILE_SIZE = int(os.getenv('MAX_FILE_SIZE', 15728640))  # 15MB para imágenes
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'svg'}

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

# URL del servicio de documentos
DOCUMENTS_SERVICE_URL = os.getenv('DOCUMENTS_SERVICE_URL', 'http://localhost:5002')

# =============================================================================
# MODELOS DE BASE DE DATOS
# =============================================================================

class Collection(db.Model):
    __tablename__ = 'collections'
    
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(500), nullable=False)
    descripcion = db.Column(db.Text)
    portada_path = db.Column(db.String(1000))
    autor_id = db.Column(db.Integer, nullable=False)
    is_publica = db.Column(db.Boolean, default=True)
    total_documentos = db.Column(db.Integer, default=0)
    visualizaciones = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    documents = db.relationship('CollectionDocument', backref='collection', cascade='all, delete-orphan')
    subscriptions = db.relationship('CollectionSubscription', backref='collection', cascade='all, delete-orphan')
    
    def to_dict(self, include_documents=False):
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
    __tablename__ = 'collection_documents'
    
    id = db.Column(db.Integer, primary_key=True)
    collection_id = db.Column(db.Integer, db.ForeignKey('collections.id'), nullable=False)
    document_id = db.Column(db.Integer, nullable=False)
    orden = db.Column(db.Integer, default=0)
    agregado_por = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'collection_id': self.collection_id,
            'document_id': self.document_id,
            'orden': self.orden,
            'agregado_por': self.agregado_por,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class CollectionSubscription(db.Model):
    __tablename__ = 'collection_subscriptions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    collection_id = db.Column(db.Integer, db.ForeignKey('collections.id'), nullable=False)
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
    """Verificar si el tipo MIME es permitido"""
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

def resize_image(image_path, max_width=800, max_height=600):
    """Redimensionar imagen para optimizar espacio"""
    try:
        with Image.open(image_path) as img:
            # Convertir a RGB si es necesario
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            
            # Calcular nuevas dimensiones manteniendo proporción
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
    """Obtener información de un documento desde el servicio de documentos"""
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
    """Obtener lista de colecciones con paginación y filtros"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        
        # Parámetros de paginación
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 12, type=int), 100)
        
        # Filtros
        autor_id = request.args.get('autor_id', type=int)
        publicas_solo = request.args.get('publicas_solo', 'true').lower() == 'true'
        mis_colecciones = request.args.get('mis_colecciones', 'false').lower() == 'true'
        buscar = request.args.get('search', '').strip()
        
        # Construir query
        query = Collection.query
        
        # Si el usuario está autenticado y quiere ver solo sus colecciones
        if current_user and mis_colecciones:
            query = query.filter(Collection.autor_id == current_user['user_id'])
        else:
            # Para usuarios no autenticados o vista general, solo colecciones públicas
            if not current_user or publicas_solo:
                query = query.filter(Collection.is_publica == True)
            else:
                # Usuario autenticado puede ver sus propias colecciones (públicas y privadas) + públicas de otros
                query = query.filter(
                    db.or_(
                        Collection.is_publica == True,
                        Collection.autor_id == current_user['user_id']
                    )
                )
        
        if autor_id:
            query = query.filter(Collection.autor_id == autor_id)
        
        if buscar:
            query = query.filter(
                db.or_(
                    Collection.titulo.contains(buscar),
                    Collection.descripcion.contains(buscar)
                )
            )
        
        # Ordenar por fecha de creación descendente
        query = query.order_by(Collection.created_at.desc())
        
        # Paginar
        collections = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
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
    """Obtener una colección específica con sus documentos"""
    try:
        collection = Collection.query.get_or_404(collection_id)
        
        # Verificar si es pública o el usuario es el autor
        current_user = get_current_user()
        if not collection.is_publica and (not current_user or current_user['user_id'] != collection.autor_id):
            return jsonify({'error': 'Acceso denegado'}), 403
        
        # Incrementar visualizaciones
        collection.visualizaciones += 1
        db.session.commit()
        
        # Obtener documentos de la colección con su información completa
        documents_info = []
        auth_token = request.headers.get('Authorization', '').replace('Bearer ', '') if request.headers.get('Authorization') else None
        
        for col_doc in collection.documents:
            doc_info = get_document_info(col_doc.document_id, auth_token)
            if doc_info and 'document' in doc_info:
                document_data = doc_info['document']
                document_data['orden_en_coleccion'] = col_doc.orden
                document_data['agregado_en'] = col_doc.created_at.isoformat()
                documents_info.append(document_data)
        
        # Ordenar por orden en colección
        documents_info.sort(key=lambda x: x.get('orden_en_coleccion', 0))
        
        result = collection.to_dict()
        result['documents'] = documents_info
        
        return jsonify({
            'collection': result
        })
        
    except Exception as e:
        logger.error(f'Error obteniendo colección: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/collections', methods=['POST'])
def create_collection():
    """Crear nueva colección"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        # Obtener datos del formulario o JSON
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
        
        # Procesar archivo de portada si existe
        portada_path = None
        if portada_file and portada_file.filename != '':
            # Validar extensión del archivo
            if not allowed_file(portada_file.filename):
                logger.warning(f'Archivo rechazado por extensión: {portada_file.filename}')
                return jsonify({'error': 'Solo se permiten imágenes (PNG, JPG, JPEG, GIF, WebP)'}), 400
            
            # Validar tipo MIME si está disponible
            if hasattr(portada_file, 'content_type') and portada_file.content_type:
                if not allowed_mime_type(portada_file.content_type):
                    logger.warning(f'Archivo rechazado por MIME type: {portada_file.content_type}')
                    return jsonify({'error': f'Tipo de archivo no permitido: {portada_file.content_type}'}), 400
            
            logger.info(f'Procesando archivo: {portada_file.filename}, tipo: {portada_file.content_type if hasattr(portada_file, "content_type") else "desconocido"}')
            
            # Generar nombre único para archivo
            unique_filename = generate_unique_filename(portada_file.filename)
            portada_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            
            # Guardar archivo
            portada_file.save(portada_path)
            
            # Redimensionar imagen
            if not resize_image(portada_path):
                os.remove(portada_path)
                portada_path = None
        
        # Crear colección
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
        # Limpiar archivo si hubo error
        if 'portada_path' in locals() and portada_path and os.path.exists(portada_path):
            os.remove(portada_path)
        logger.error(f'Error creando colección: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/collections/<int:collection_id>', methods=['PUT'])
def update_collection(collection_id):
    """Actualizar colección"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        collection = Collection.query.get_or_404(collection_id)
        
        # Verificar que el usuario sea el autor
        if collection.autor_id != current_user['user_id']:
            return jsonify({'error': 'Solo el autor puede modificar la colección'}), 403
        
        data = request.get_json()
        
        # Actualizar campos permitidos
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
    """Eliminar colección"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        collection = Collection.query.get_or_404(collection_id)
        
        # Verificar que el usuario sea el autor
        if collection.autor_id != current_user['user_id']:
            return jsonify({'error': 'Solo el autor puede eliminar la colección'}), 403
        
        # Eliminar archivo de portada si existe
        if collection.portada_path and os.path.exists(collection.portada_path):
            os.remove(collection.portada_path)
        
        # Eliminar colección de la base de datos
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
    """Agregar documento a colección"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        collection = Collection.query.get_or_404(collection_id)
        
        # Verificar que el usuario sea el autor de la colección
        if collection.autor_id != current_user['user_id']:
            return jsonify({'error': 'Solo el autor puede modificar la colección'}), 403
        
        data = request.get_json()
        
        if 'document_id' not in data:
            return jsonify({'error': 'ID del documento requerido'}), 400
        
        document_id = data['document_id']
        orden = data.get('orden', 0)
        
        # Verificar que el documento existe y es accesible
        auth_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        doc_info = get_document_info(document_id, auth_token)
        
        if not doc_info:
            return jsonify({'error': 'Documento no encontrado o no accesible'}), 404
        
        # Verificar si el documento ya está en la colección
        existing = CollectionDocument.query.filter_by(
            collection_id=collection_id,
            document_id=document_id
        ).first()
        
        if existing:
            return jsonify({'error': 'El documento ya está en la colección'}), 409
        
        # Agregar documento a la colección
        collection_document = CollectionDocument(
            collection_id=collection_id,
            document_id=document_id,
            orden=orden,
            agregado_por=current_user['user_id']
        )
        
        db.session.add(collection_document)
        
        # Actualizar contador de documentos
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
    """Quitar documento de colección"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        collection = Collection.query.get_or_404(collection_id)
        
        # Verificar que el usuario sea el autor de la colección
        if collection.autor_id != current_user['user_id']:
            return jsonify({'error': 'Solo el autor puede modificar la colección'}), 403
        
        # Buscar relación
        collection_document = CollectionDocument.query.filter_by(
            collection_id=collection_id,
            document_id=document_id
        ).first()
        
        if not collection_document:
            return jsonify({'error': 'El documento no está en la colección'}), 404
        
        # Eliminar relación
        db.session.delete(collection_document)
        
        # Actualizar contador de documentos
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
    """Suscribirse/desuscribirse de colección"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        collection = Collection.query.get_or_404(collection_id)
        
        # Verificar que la colección sea pública o el usuario sea el autor
        if not collection.is_publica and collection.autor_id != current_user['user_id']:
            return jsonify({'error': 'Acceso denegado'}), 403
        
        # Buscar suscripción existente
        subscription = CollectionSubscription.query.filter_by(
            user_id=current_user['user_id'],
            collection_id=collection_id
        ).first()
        
        if subscription:
            # Desuscribirse
            db.session.delete(subscription)
            action = 'unsubscribed'
        else:
            # Suscribirse
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
    """Obtener imagen de portada de la colección"""
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
    """Obtener estadísticas de colecciones"""
    try:
        total_collections = Collection.query.filter_by(is_publica=True).count()
        total_documents = db.session.query(
            db.func.sum(Collection.total_documentos)
        ).filter_by(is_publica=True).scalar() or 0
        
        # Top colecciones más vistas
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
        logger.info('Tablas de base de datos creadas exitosamente')
    except Exception as e:
        logger.error(f'Error creando tablas: {str(e)}')

if __name__ == '__main__':
    # Crear tablas
    with app.app_context():
        create_tables()
    
    port = int(os.getenv('PORT', 5003))
    host = os.getenv('HOST', '0.0.0.0')
    debug = os.getenv('FLASK_ENV') == 'development'
    
    logger.info(f'Iniciando Collections Service en {host}:{port}')
    app.run(host=host, port=port, debug=debug)