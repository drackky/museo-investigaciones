"""
API Gateway para la plataforma de gestión de investigaciones del museo.
Punto de entrada único para todos los microservicios.
"""

import os
import logging
from functools import wraps
from datetime import datetime
from flask import Flask, request, jsonify, g
from flask_cors import CORS


from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import requests
import jwt
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

app = Flask(__name__)

# Configuración
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-key')
app.config['JSON_SORT_KEYS'] = False

# Configurar CORS - más permisivo para desarrollo
cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:5000').split(',')
CORS(app, 
     resources={
         r"/api/*": {
             "origins": cors_origins,
             "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
             "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
             "expose_headers": ["Content-Type", "Authorization"],
             "supports_credentials": True,
             "max_age": 3600
         },
         r"/*": {
             "origins": cors_origins,
             "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
             "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
             "supports_credentials": True
         }
     }
)

# Configurar rate limiting - más permisivo para desarrollo
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["1000 per day", "300 per hour"],
    storage_uri="memory://"
)

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# URLs de microservicios
SERVICE_URLS = {
    'auth': os.getenv('AUTH_SERVICE_URL', 'http://localhost:5001'),
    'documents': os.getenv('DOCUMENTS_SERVICE_URL', 'http://localhost:5002'),
    'collections': os.getenv('COLLECTIONS_SERVICE_URL', 'http://localhost:5003'),
    'comments': os.getenv('COMMENTS_SERVICE_URL', 'http://localhost:5004'),
    'research': os.getenv('RESEARCH_SERVICE_URL', 'http://localhost:5005')
}

def verify_token(token):
    """Verificar token JWT"""
    try:
        payload = jwt.decode(
            token, 
            app.config['SECRET_KEY'], 
            algorithms=['HS256']
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def auth_required(f):
    """Decorador para rutas que requieren autenticación"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token requerido'}), 401
        
        if token.startswith('Bearer '):
            token = token[7:]
        
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Token inválido o expirado'}), 401
        
        g.current_user = payload
        return f(*args, **kwargs)
    
    return decorated_function

def proxy_request(service_name, path, method='GET', data=None, files=None, params=None):
    """Proxy de peticiones a microservicios"""
    try:
        service_url = SERVICE_URLS.get(service_name)
        if not service_url:
            return {'error': f'Servicio {service_name} no disponible'}, 503
        
        url = f"{service_url}{path}"
        headers = {}
        
        # Pasar token de autorización si existe
        auth_header = request.headers.get('Authorization')
        if auth_header:
            headers['Authorization'] = auth_header
        
        # Configurar según el método HTTP
        if method == 'GET':
            response = requests.get(url, headers=headers, params=params, timeout=30)
        elif method == 'POST':
            if files:
                response = requests.post(url, headers=headers, data=data, files=files, timeout=30)
            else:
                headers['Content-Type'] = 'application/json'
                response = requests.post(url, headers=headers, json=data, timeout=30)
        elif method == 'PUT':
            headers['Content-Type'] = 'application/json'
            response = requests.put(url, headers=headers, json=data, timeout=30)
        elif method == 'DELETE':
            response = requests.delete(url, headers=headers, timeout=30)
        else:
            return {'error': 'Método no soportado'}, 400
        
        return response.json(), response.status_code
        
    except requests.exceptions.Timeout:
        logger.error(f'Timeout al conectar con {service_name}')
        return {'error': 'Servicio no disponible'}, 503
    except requests.exceptions.ConnectionError:
        logger.error(f'Error de conexión con {service_name}')
        return {'error': 'Servicio no disponible'}, 503
    except Exception as e:
        logger.error(f'Error en proxy_request: {str(e)}')
        return {'error': 'Error interno del servidor'}, 500

# =============================================================================
# RUTAS DE HEALTH CHECK
# =============================================================================

@app.route('/')
def home():
    """Información básica de la API"""
    return jsonify({
        'message': 'API Gateway - Plataforma de Investigaciones del Museo',
        'version': '1.0.0',
        'services': list(SERVICE_URLS.keys()),
        'status': 'active'
    })

@app.route('/health')
def health_check():
    """Health check del API Gateway y servicios"""
    status = {'gateway': 'healthy', 'services': {}}
    
    for service_name, service_url in SERVICE_URLS.items():
        try:
            response = requests.get(f"{service_url}/health", timeout=5)
            status['services'][service_name] = 'healthy' if response.status_code == 200 else 'unhealthy'
        except:
            status['services'][service_name] = 'unhealthy'
    
    return jsonify(status)

@app.route('/test-cors')
def test_cors():
    """Endpoint para probar CORS"""
    return jsonify({
        'message': 'CORS funcionando correctamente',
        'cors_origins': cors_origins,
        'request_origin': request.headers.get('Origin'),
        'timestamp': str(datetime.now())
    })

# =============================================================================
# RUTAS DE AUTENTICACIÓN
# =============================================================================

@app.route('/api/v1/auth/register', methods=['POST'])
@limiter.limit("5 per minute")
def register():
    """Registro de usuarios"""
    data = request.get_json()
    return proxy_request('auth', '/api/v1/auth/register', 'POST', data)

@app.route('/api/v1/auth/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    """Login de usuarios"""
    data = request.get_json()
    return proxy_request('auth', '/api/v1/auth/login', 'POST', data)

@app.route('/api/v1/auth/google', methods=['POST'])
@limiter.limit("10 per minute")
def google_auth():
    """Autenticación con Google"""
    data = request.get_json()
    return proxy_request('auth', '/api/v1/auth/google', 'POST', data)

@app.route('/api/v1/auth/logout', methods=['POST'])
@auth_required
def logout():
    """Logout de usuarios"""
    return proxy_request('auth', '/api/v1/auth/logout', 'POST')

@app.route('/api/v1/auth/me', methods=['GET'])
@auth_required
def auth_me():
    """Obtener perfil del usuario (alias para frontend)"""
    return proxy_request('auth', '/api/v1/auth/profile', 'GET')

@app.route('/api/v1/auth/refresh', methods=['POST'])
@auth_required
def auth_refresh():
    """Refrescar token"""
    data = request.get_json()
    return proxy_request('auth', '/api/v1/auth/refresh', 'POST', data)

@app.route('/api/v1/auth/profile', methods=['GET'])
@auth_required
def get_profile():
    """Obtener perfil del usuario"""
    return proxy_request('auth', '/api/v1/auth/profile', 'GET')

@app.route('/api/v1/auth/profile', methods=['PUT'])
@auth_required
def update_profile():
    """Actualizar perfil del usuario"""
    data = request.get_json()
    return proxy_request('auth', '/api/v1/auth/profile', 'PUT', data)

# =============================================================================
# RUTAS DE DOCUMENTOS
# =============================================================================

@app.route('/api/v1/documents', methods=['GET'])
def get_documents():
    """Obtener lista de documentos"""
    params = request.args.to_dict()
    return proxy_request('documents', '/api/v1/documents', 'GET', params=params)

@app.route('/api/v1/documents/<int:document_id>', methods=['GET'])
def get_document(document_id):
    """Obtener un documento específico"""
    return proxy_request('documents', f'/api/v1/documents/{document_id}', 'GET')

@app.route('/api/v1/documents', methods=['POST'])
@auth_required
def create_document():
    """Crear nuevo documento"""
    if 'file' in request.files:
        file = request.files['file']
        # Preservar el nombre original del archivo
        files = {'file': (file.filename, file.stream, file.content_type)}
        data = request.form.to_dict()
        return proxy_request('documents', '/api/v1/documents', 'POST', data, files)
    else:
        data = request.get_json()
        return proxy_request('documents', '/api/v1/documents', 'POST', data)

@app.route('/api/v1/documents/<int:document_id>', methods=['PUT'])
@auth_required
def update_document(document_id):
    """Actualizar documento"""
    data = request.get_json()
    return proxy_request('documents', f'/api/v1/documents/{document_id}', 'PUT', data)

@app.route('/api/v1/documents/<int:document_id>', methods=['DELETE'])
@auth_required
def delete_document(document_id):
    """Eliminar documento"""
    return proxy_request('documents', f'/api/v1/documents/{document_id}', 'DELETE')

@app.route('/api/v1/documents/search', methods=['GET'])
def search_documents():
    """Buscar documentos"""
    params = request.args.to_dict()
    return proxy_request('documents', '/api/v1/documents/search', 'GET', params=params)

@app.route('/api/v1/documents/<int:document_id>/favorite', methods=['POST'])
@auth_required
def toggle_favorite(document_id):
    """Agregar/quitar favorito"""
    return proxy_request('documents', f'/api/v1/documents/{document_id}/favorite', 'POST')

@app.route('/api/v1/documents/<int:document_id>/download', methods=['GET'])
def download_document(document_id):
    """Descargar documento"""
    return proxy_request('documents', f'/api/v1/documents/{document_id}/download', 'GET')

@app.route('/api/v1/documents/<int:document_id>/view', methods=['GET'])
def view_document(document_id):
    """Ver documento"""
    return proxy_request('documents', f'/api/v1/documents/{document_id}/view', 'GET')

# =============================================================================
# RUTAS DE TAGS
# =============================================================================

@app.route('/api/v1/tags', methods=['GET'])
def get_tags():
    """Obtener lista de tags"""
    return proxy_request('documents', '/api/v1/tags', 'GET')

@app.route('/api/v1/tags', methods=['POST'])
@auth_required
def create_tag():
    """Crear nuevo tag"""
    return proxy_request('documents', '/api/v1/tags', 'POST')

# =============================================================================
# RUTAS DE COLECCIONES
# =============================================================================

@app.route('/api/v1/collections', methods=['GET'])
def get_collections():
    """Obtener lista de colecciones"""
    params = request.args.to_dict()
    return proxy_request('collections', '/api/v1/collections', 'GET', params=params)

@app.route('/api/v1/collections/<int:collection_id>', methods=['GET'])
def get_collection(collection_id):
    """Obtener una colección específica"""
    return proxy_request('collections', f'/api/v1/collections/{collection_id}', 'GET')

@app.route('/api/v1/collections', methods=['POST'])
@auth_required
def create_collection():
    """Crear nueva colección"""
    if 'portada' in request.files:
        file = request.files['portada']
        # Preservar el nombre original del archivo
        files = {'portada': (file.filename, file.stream, file.content_type)}
        data = request.form.to_dict()
        return proxy_request('collections', '/api/v1/collections', 'POST', data, files)
    else:
        data = request.get_json()
        return proxy_request('collections', '/api/v1/collections', 'POST', data)

@app.route('/api/v1/collections/<int:collection_id>/documents', methods=['POST'])
@auth_required
def add_document_to_collection(collection_id):
    """Agregar documento a colección"""
    data = request.get_json()
    return proxy_request('collections', f'/api/v1/collections/{collection_id}/documents', 'POST', data)

@app.route('/api/v1/collections/<int:collection_id>/favorite', methods=['POST'])
@auth_required
def toggle_collection_favorite(collection_id):
    """Agregar/quitar favorito de colección"""
    return proxy_request('collections', f'/api/v1/collections/{collection_id}/favorite', 'POST')

@app.route('/api/v1/collections/<int:collection_id>/like', methods=['POST'])
@auth_required
def toggle_collection_like(collection_id):
    """Dar/quitar like a colección"""
    return proxy_request('collections', f'/api/v1/collections/{collection_id}/like', 'POST')

@app.route('/api/v1/collections/<int:collection_id>/subscribe', methods=['POST'])
@auth_required
def toggle_collection_subscription(collection_id):
    """Suscribirse/desuscribirse de colección"""
    return proxy_request('collections', f'/api/v1/collections/{collection_id}/subscribe', 'POST')

@app.route('/api/v1/collections/<int:collection_id>/rating', methods=['POST'])
@auth_required
def rate_collection(collection_id):
    """Calificar colección"""
    data = request.get_json()
    return proxy_request('collections', f'/api/v1/collections/{collection_id}/rating', 'POST', data)

@app.route('/api/v1/collections/<int:collection_id>/share', methods=['POST'])
@auth_required
def share_collection(collection_id):
    """Compartir colección"""
    data = request.get_json()
    return proxy_request('collections', f'/api/v1/collections/{collection_id}/share', 'POST', data)

@app.route('/api/v1/collections/<int:collection_id>', methods=['PUT'])
@auth_required
def update_collection(collection_id):
    """Actualizar colección"""
    data = request.get_json()
    return proxy_request('collections', f'/api/v1/collections/{collection_id}', 'PUT', data)

@app.route('/api/v1/collections/<int:collection_id>', methods=['DELETE'])
@auth_required
def delete_collection(collection_id):
    """Eliminar colección"""
    return proxy_request('collections', f'/api/v1/collections/{collection_id}', 'DELETE')

@app.route('/api/v1/collections/<int:collection_id>/comments', methods=['GET'])
def get_collection_comments(collection_id):
    """Obtener comentarios de colección"""
    params = request.args.to_dict()
    return proxy_request('comments', f'/api/v1/collections/{collection_id}/comments', 'GET', params=params)

@app.route('/api/v1/collections/<int:collection_id>/comments', methods=['POST'])
@auth_required
def create_collection_comment(collection_id):
    """Crear comentario en colección"""
    data = request.get_json()
    return proxy_request('comments', f'/api/v1/collections/{collection_id}/comments', 'POST', data)

@app.route('/api/v1/collections/<int:collection_id>/interactions', methods=['GET'])
def get_collection_interactions(collection_id):
    """Obtener interacciones de una colección"""
    return proxy_request('collections', f'/api/v1/collections/{collection_id}/interactions', 'GET')

@app.route('/api/v1/collections/<int:collection_id>/view', methods=['POST'])
def track_collection_view(collection_id):
    """Registrar vista de colección"""
    data = request.get_json() or {}
    return proxy_request('collections', f'/api/v1/collections/{collection_id}/view', 'POST', data)

@app.route('/api/v1/documents/<int:document_id>/interactions', methods=['GET'])
def get_document_interactions(document_id):
    """Obtener interacciones de un documento"""
    return proxy_request('documents', f'/api/v1/documents/{document_id}/interactions', 'GET')

@app.route('/api/v1/documents/<int:document_id>/view', methods=['POST'])
def track_document_view(document_id):
    """Registrar vista de documento"""
    data = request.get_json() or {}
    return proxy_request('documents', f'/api/v1/documents/{document_id}/view', 'POST', data)

# =============================================================================
# RUTAS DE COMENTARIOS
# =============================================================================

@app.route('/api/v1/documents/<int:document_id>/comments', methods=['GET'])
def get_comments(document_id):
    """Obtener comentarios de un documento"""
    params = request.args.to_dict()
    return proxy_request('comments', f'/api/v1/documents/{document_id}/comments', 'GET', params=params)

@app.route('/api/v1/documents/<int:document_id>/comments', methods=['POST'])
@auth_required
def create_comment(document_id):
    """Crear nuevo comentario"""
    data = request.get_json()
    return proxy_request('comments', f'/api/v1/documents/{document_id}/comments', 'POST', data)

@app.route('/api/v1/comments/<int:comment_id>/like', methods=['POST'])
@auth_required
def toggle_comment_like(comment_id):
    """Dar/quitar like a comentario"""
    return proxy_request('comments', f'/api/v1/comments/{comment_id}/like', 'POST')

@app.route('/api/v1/comments/<int:comment_id>', methods=['PUT'])
@auth_required
def update_comment(comment_id):
    """Actualizar comentario"""
    data = request.get_json()
    return proxy_request('comments', f'/api/v1/comments/{comment_id}', 'PUT', data)

@app.route('/api/v1/comments/<int:comment_id>', methods=['DELETE'])
@auth_required
def delete_comment(comment_id):
    """Eliminar comentario"""
    return proxy_request('comments', f'/api/v1/comments/{comment_id}', 'DELETE')

# =============================================================================
# RUTAS DE USUARIOS (alias para frontend)
# =============================================================================

@app.route('/api/v1/users/profile', methods=['GET'])
@auth_required
def users_get_profile():
    """Obtener perfil del usuario"""
    return proxy_request('auth', '/api/v1/auth/profile', 'GET')

@app.route('/api/v1/users/profile', methods=['PUT'])
@auth_required
def users_update_profile():
    """Actualizar perfil del usuario"""
    data = request.get_json()
    return proxy_request('auth', '/api/v1/auth/profile', 'PUT', data)

@app.route('/api/v1/users/password', methods=['PUT'])
@auth_required
def users_change_password():
    """Cambiar contraseña"""
    data = request.get_json()
    return proxy_request('auth', '/api/v1/auth/password', 'PUT', data)

# =============================================================================
# RUTAS DE ESTADÍSTICAS
# =============================================================================

@app.route('/api/v1/stats', methods=['GET'])
def get_general_stats():
    """Obtener estadísticas generales"""
    return proxy_request('documents', '/api/v1/documents/stats', 'GET')

@app.route('/api/v1/stats/documents', methods=['GET'])
def get_document_stats():
    """Obtener estadísticas de documentos"""
    return proxy_request('documents', '/api/v1/documents/stats', 'GET')

@app.route('/api/v1/stats/collections', methods=['GET'])
def get_collection_stats():
    """Obtener estadísticas de colecciones"""
    return proxy_request('collections', '/api/v1/collections/stats', 'GET')

@app.route('/api/v1/stats/users', methods=['GET'])
@auth_required
def get_user_stats():
    """Obtener estadísticas de usuarios"""
    return proxy_request('auth', '/api/v1/auth/users', 'GET')

# =============================================================================
# RUTAS DE INVESTIGACIONES (alias /research para frontend)
# =============================================================================

@app.route('/api/v1/research', methods=['GET'])
@auth_required
def get_research_list():
    """Obtener lista de investigaciones (alias frontend)"""
    params = request.args.to_dict()
    return proxy_request('research', '/api/v1/investigations', 'GET', params=params)

@app.route('/api/v1/research/search', methods=['GET'])
@auth_required
def search_research():
    """Buscar investigaciones (alias frontend)"""
    params = request.args.to_dict()
    return proxy_request('research', '/api/v1/investigations', 'GET', params=params)

@app.route('/api/v1/research/<int:investigation_id>', methods=['GET'])
@auth_required
def get_research_item(investigation_id):
    """Obtener una investigación (alias frontend)"""
    return proxy_request('research', f'/api/v1/investigations/{investigation_id}', 'GET')

@app.route('/api/v1/research', methods=['POST'])
@auth_required
def create_research_item():
    """Crear investigación (alias frontend)"""
    data = request.get_json()
    return proxy_request('research', '/api/v1/investigations', 'POST', data)

@app.route('/api/v1/research/<int:investigation_id>', methods=['PUT'])
@auth_required
def update_research_item(investigation_id):
    """Actualizar investigación (alias frontend)"""
    data = request.get_json()
    return proxy_request('research', f'/api/v1/investigations/{investigation_id}', 'PUT', data)

@app.route('/api/v1/research/<int:investigation_id>', methods=['DELETE'])
@auth_required
def delete_research_item(investigation_id):
    """Eliminar investigación (alias frontend)"""
    return proxy_request('research', f'/api/v1/investigations/{investigation_id}', 'DELETE')

# =============================================================================
# RUTAS DE INVESTIGACIONES (original)
# =============================================================================

@app.route('/api/v1/investigations/<int:investigation_id>/files', methods=['POST'])
@auth_required
def upload_investigation_file(investigation_id):
    """Subir archivo a investigación"""
    if 'file' in request.files:
        file = request.files['file']
        files = {'file': (file.filename, file.stream, file.content_type)}
        data = request.form.to_dict()
        return proxy_request('research', f'/api/v1/investigations/{investigation_id}/files', 'POST', data, files)
    else:
        return jsonify({'error': 'Archivo requerido'}), 400

@app.route('/api/v1/investigations/<int:investigation_id>/files', methods=['GET'])
@auth_required
def get_investigation_files(investigation_id):
    """Obtener archivos de investigación"""
    params = request.args.to_dict()
    return proxy_request('research', f'/api/v1/investigations/{investigation_id}/files', 'GET', params=params)

@app.route('/api/v1/investigations/<int:investigation_id>/files/<int:file_id>/download', methods=['GET'])
@auth_required
def download_investigation_file(investigation_id, file_id):
    """Descargar archivo de investigación"""
    return proxy_request('research', f'/api/v1/investigations/{investigation_id}/files/{file_id}/download', 'GET')

@app.route('/api/v1/investigations/<int:investigation_id>/files/<int:file_id>', methods=['DELETE'])
@auth_required
def delete_investigation_file(investigation_id, file_id):
    """Eliminar archivo de investigación"""
    return proxy_request('research', f'/api/v1/investigations/{investigation_id}/files/{file_id}', 'DELETE')

@app.route('/api/v1/investigations', methods=['GET'])
@auth_required
def get_investigations():
    """Obtener lista de investigaciones"""
    params = request.args.to_dict()
    return proxy_request('research', '/api/v1/investigations', 'GET', params=params)

@app.route('/api/v1/investigations/<int:investigation_id>', methods=['GET'])
@auth_required
def get_investigation(investigation_id):
    """Obtener una investigación específica"""
    return proxy_request('research', f'/api/v1/investigations/{investigation_id}', 'GET')

@app.route('/api/v1/investigations', methods=['POST'])
@auth_required
def create_investigation():
    """Crear nueva investigación"""
    data = request.get_json()
    return proxy_request('research', '/api/v1/investigations', 'POST', data)

@app.route('/api/v1/investigations/<int:investigation_id>/tickets', methods=['GET'])
@auth_required
def get_tickets(investigation_id):
    """Obtener tickets de una investigación"""
    params = request.args.to_dict()
    return proxy_request('research', f'/api/v1/investigations/{investigation_id}/tickets', 'GET', params=params)

@app.route('/api/v1/investigations/<int:investigation_id>/tickets', methods=['POST'])
@auth_required
def create_ticket(investigation_id):
    """Crear nuevo ticket"""
    data = request.get_json()
    return proxy_request('research', f'/api/v1/investigations/{investigation_id}/tickets', 'POST', data)

@app.route('/api/v1/investigations/dashboard', methods=['GET'])
@auth_required
def get_research_dashboard():
    """Obtener estadísticas del dashboard de investigaciones"""
    return proxy_request('research', '/api/v1/investigations/dashboard', 'GET')

# =============================================================================
# MANEJADORES DE ERRORES
# =============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint no encontrado'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Error interno del servidor'}), 500

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({'error': 'Demasiadas peticiones, intente más tarde'}), 429

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '0.0.0.0')
    debug = os.getenv('FLASK_ENV') == 'development'
    
    logger.info(f'Iniciando API Gateway en {host}:{port}')
    logger.info(f'Servicios configurados: {list(SERVICE_URLS.keys())}')
    
    app.run(host=host, port=port, debug=debug)
