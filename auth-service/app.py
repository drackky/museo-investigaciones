"""
Servicio de Autenticación - Plataforma de Investigaciones del Museo
Gestiona usuarios, autenticación, sesiones y autorización.
"""

import os
import logging
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, g
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_bcrypt import Bcrypt
import jwt
import pymysql
from dotenv import load_dotenv
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import re

# Instalar PyMySQL como MySQLdb
pymysql.install_as_MySQLdb()

# Cargar variables de entorno
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

app = Flask(__name__)

# Configuración de la base de datos
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '3306')
DB_USER = os.getenv('DB_USER', 'root')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME = os.getenv('DB_NAME', 'museum_auth_db')

app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-key')
app.config['JSON_SORT_KEYS'] = False

# Inicializar extensiones
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
CORS(app)

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuración OAuth
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')

# =============================================================================
# MODELOS DE BASE DE DATOS
# =============================================================================

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255))
    nombre = db.Column(db.String(255), nullable=False)
    rol = db.Column(db.Enum('investigador', 'invitado', name='user_roles'), nullable=False, default='invitado')
    institucion = db.Column(db.String(255))
    google_id = db.Column(db.String(255), unique=True)
    avatar_url = db.Column(db.String(500))
    is_active = db.Column(db.Boolean, default=True)
    email_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    sessions = db.relationship('Session', backref='user', lazy=True, cascade='all, delete-orphan')
    login_attempts = db.relationship('LoginAttempt', backref='user_account', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'nombre': self.nombre,
            'rol': self.rol,
            'tipo': self.rol,
            'institucion': self.institucion,
            'avatar_url': self.avatar_url,
            'is_active': self.is_active,
            'email_verified': self.email_verified,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Session(db.Model):
    __tablename__ = 'sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token_hash = db.Column(db.String(255), nullable=False)
    refresh_token_hash = db.Column(db.String(255))
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)

class LoginAttempt(db.Model):
    __tablename__ = 'login_attempts'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    email = db.Column(db.String(255), nullable=False)
    ip_address = db.Column(db.String(45), nullable=False)
    success = db.Column(db.Boolean, default=False)
    attempted_at = db.Column(db.DateTime, default=datetime.utcnow)

# =============================================================================
# UTILIDADES Y VALIDACIONES
# =============================================================================

def validate_email(email):
    """Validar formato de email"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    """Validar fortaleza de contraseña"""
    if len(password) < 8:
        return False, "La contraseña debe tener al menos 8 caracteres"
    if not re.search(r'[A-Za-z]', password):
        return False, "La contraseña debe contener al menos una letra"
    if not re.search(r'\d', password):
        return False, "La contraseña debe contener al menos un número"
    return True, "Contraseña válida"

def generate_token(user_id, expires_in=3600):
    """Generar token JWT"""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(seconds=expires_in),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def verify_token(token):
    """Verificar token JWT"""
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def check_rate_limit(email, ip_address, max_attempts=5, window_minutes=15):
    """Verificar límite de intentos de login"""
    window_start = datetime.utcnow() - timedelta(minutes=window_minutes)
    attempts = LoginAttempt.query.filter(
        LoginAttempt.email == email,
        LoginAttempt.ip_address == ip_address,
        LoginAttempt.attempted_at > window_start,
        LoginAttempt.success == False
    ).count()
    
    return attempts < max_attempts

def log_login_attempt(email, ip_address, success):
    """Registrar intento de login"""
    attempt = LoginAttempt(
        email=email,
        ip_address=ip_address,
        success=success
    )
    db.session.add(attempt)
    db.session.commit()

# =============================================================================
# RUTAS DE AUTENTICACIÓN
# =============================================================================

@app.route('/health')
def health_check():
    """Health check del servicio"""
    try:
        # Verificar conexión a la base de datos
        db.session.execute(db.text('SELECT 1'))
        return jsonify({'status': 'healthy', 'service': 'auth-service'})
    except Exception as e:
        logger.error(f'Health check failed: {str(e)}')
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

@app.route('/api/v1/auth/register', methods=['POST'])
def register():
    """Registro de nuevos usuarios"""
    try:
        data = request.get_json()
        
        # Validar datos requeridos
        required_fields = ['email', 'password', 'nombre']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'Campo {field} es requerido'}), 400
        
        email = data['email'].lower().strip()
        password = data['password']
        nombre = data['nombre'].strip()
        
        # Validar email
        if not validate_email(email):
            return jsonify({'error': 'Formato de email inválido'}), 400
        
        # Validar contraseña
        is_valid, message = validate_password(password)
        if not is_valid:
            return jsonify({'error': message}), 400
        
        # Verificar si el usuario ya existe
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({'error': 'El email ya está registrado'}), 409
        
        # Validar longitud de contraseña para bcrypt (máximo 72 bytes)
        if len(password.encode('utf-8')) > 72:
            app.logger.warning(f"Contraseña demasiado larga en registro para {email}: {len(password.encode('utf-8'))} bytes")
            password = password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
        
        # Crear nuevo usuario
        password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        
        user = User(
            email=email,
            password_hash=password_hash,
            nombre=nombre,
            rol=data.get('rol', 'invitado'),
            institucion=data.get('institucion', ''),
            email_verified=False
        )
        
        db.session.add(user)
        db.session.commit()
        
        # Generar token
        token = generate_token(user.id)
        
        # Registrar intento exitoso
        log_login_attempt(email, request.remote_addr, True)
        
        logger.info(f'Usuario registrado: {email}')
        
        return jsonify({
            'message': 'Usuario registrado exitosamente',
            'user': user.to_dict(),
            'token': token
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error en registro: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/auth/login', methods=['POST'])
def login():
    """Login de usuarios"""
    try:
        data = request.get_json()
        
        # Validar datos requeridos
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email y contraseña son requeridos'}), 400
        
        email = data['email'].lower().strip()
        password = data['password']
        
        # Validar longitud de contraseña para bcrypt (máximo 72 bytes)
        if len(password.encode('utf-8')) > 72:
            app.logger.warning(f"Contraseña demasiado larga para {email}: {len(password.encode('utf-8'))} bytes")
            password = password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
        
        ip_address = request.remote_addr
        
        # Verificar rate limiting
        if not check_rate_limit(email, ip_address):
            return jsonify({'error': 'Demasiados intentos fallidos. Intente más tarde'}), 429
        
        # Buscar usuario
        user = User.query.filter_by(email=email).first()
        
        if not user or not bcrypt.check_password_hash(user.password_hash, password):
            log_login_attempt(email, ip_address, False)
            return jsonify({'error': 'Credenciales inválidas'}), 401
        
        if not user.is_active:
            log_login_attempt(email, ip_address, False)
            return jsonify({'error': 'Cuenta desactivada'}), 401
        
        # Login exitoso
        log_login_attempt(email, ip_address, True)
        
        # Generar token
        token = generate_token(user.id)
        
        # Crear sesión
        # Truncar token si es necesario para bcrypt
        token_for_hash = token.encode('utf-8')[:72].decode('utf-8', errors='ignore')
        session = Session(
            user_id=user.id,
            token_hash=bcrypt.generate_password_hash(token_for_hash).decode('utf-8'),
            expires_at=datetime.utcnow() + timedelta(hours=24),
            ip_address=ip_address,
            user_agent=request.headers.get('User-Agent', '')
        )
        
        db.session.add(session)
        db.session.commit()
        
        logger.info(f'Login exitoso: {email}')
        
        # Crear respuesta del usuario de forma segura
        user_data = {
            'id': user.id,
            'email': user.email,
            'nombre': user.nombre,
            'tipo': user.rol,  # Mapear rol a tipo para compatibilidad
            'rol': user.rol,
            'institucion': user.institucion,
            'avatar_url': user.avatar_url,
            'is_active': user.is_active,
            'email_verified': user.email_verified
        }
        
        return jsonify({
            'message': 'Login exitoso',
            'user': user_data,
            'token': token
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error en login: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/auth/google', methods=['POST'])
def google_login():
    """Autenticación con Google OAuth"""
    try:
        data = request.get_json()
        
        if not data.get('token'):
            return jsonify({'error': 'Token de Google requerido'}), 400
        
        # Verificar token con Google
        try:
            idinfo = id_token.verify_oauth2_token(
                data['token'], 
                google_requests.Request(), 
                GOOGLE_CLIENT_ID
            )
            
            google_user_id = idinfo['sub']
            email = idinfo['email'].lower()
            nombre = idinfo.get('name', '')
            avatar_url = idinfo.get('picture', '')
            
        except ValueError as e:
            logger.error(f'Token de Google inválido: {str(e)}')
            return jsonify({'error': 'Token de Google inválido'}), 401
        
        # Buscar usuario existente
        user = User.query.filter(
            (User.email == email) | (User.google_id == google_user_id)
        ).first()
        
        if user:
            # Usuario existente - actualizar información
            user.google_id = google_user_id
            user.avatar_url = avatar_url
            user.email_verified = True
            user.updated_at = datetime.utcnow()
        else:
            # Nuevo usuario
            user = User(
                email=email,
                nombre=nombre,
                google_id=google_user_id,
                avatar_url=avatar_url,
                rol='invitado',
                email_verified=True
            )
            db.session.add(user)
        
        db.session.commit()
        
        # Generar token
        token = generate_token(user.id)
        
        logger.info(f'Login con Google exitoso: {email}')
        
        return jsonify({
            'message': 'Autenticación con Google exitosa',
            'user': user.to_dict(),
            'token': token
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error en Google login: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/auth/logout', methods=['POST'])
def logout():
    """Logout de usuarios"""
    try:
        # Obtener token del header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Token requerido'}), 401
        
        token = auth_header[7:]
        payload = verify_token(token)
        
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401
        
        # Desactivar sesión
        # Truncar token si es necesario para bcrypt
        token_for_hash = token.encode('utf-8')[:72].decode('utf-8', errors='ignore')
        token_hash = bcrypt.generate_password_hash(token_for_hash).decode('utf-8')
        session = Session.query.filter_by(
            user_id=payload['user_id'],
            token_hash=token_hash
        ).first()
        
        if session:
            session.is_active = False
            db.session.commit()
        
        logger.info(f'Logout exitoso para usuario {payload["user_id"]}')
        
        return jsonify({'message': 'Logout exitoso'})
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error en logout: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/auth/refresh', methods=['POST'])
def refresh_token():
    """Refrescar token JWT"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Token requerido'}), 401
        
        token = auth_header[7:]
        payload = verify_token(token)
        
        if not payload:
            return jsonify({'error': 'Token inválido o expirado'}), 401
        
        # Generar nuevo token
        new_token = generate_token(payload['user_id'])
        
        return jsonify({
            'message': 'Token refrescado exitosamente',
            'token': new_token
        })
        
    except Exception as e:
        logger.error(f'Error refrescando token: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/auth/password', methods=['PUT'])
def change_password():
    """Cambiar contraseña del usuario"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Token requerido'}), 401
        
        token = auth_header[7:]
        payload = verify_token(token)
        
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401
        
        data = request.get_json()
        
        if not data.get('current_password') or not data.get('new_password'):
            return jsonify({'error': 'Contraseña actual y nueva son requeridas'}), 400
        
        user = User.query.get(payload['user_id'])
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        if not bcrypt.check_password_hash(user.password_hash, data['current_password']):
            return jsonify({'error': 'Contraseña actual incorrecta'}), 401
        
        new_password = data['new_password']
        is_valid, message = validate_password(new_password)
        if not is_valid:
            return jsonify({'error': message}), 400
        
        user.password_hash = bcrypt.generate_password_hash(new_password).decode('utf-8')
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f'Contraseña cambiada para usuario {user.id}')
        
        return jsonify({'message': 'Contraseña actualizada exitosamente'})
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error cambiando contraseña: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/auth/users/<int:user_id>', methods=['GET'])
def get_user_by_id(user_id):
    """Obtener información de un usuario por ID"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        return jsonify({
            'user': user.to_dict()
        })
        
    except Exception as e:
        logger.error(f'Error obteniendo usuario {user_id}: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/auth/profile', methods=['GET'])
def get_profile():
    """Obtener perfil del usuario autenticado"""
    try:
        # Obtener token del header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Token requerido'}), 401
        
        token = auth_header[7:]
        payload = verify_token(token)
        
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401
        
        # Buscar usuario
        user = User.query.get(payload['user_id'])
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        return jsonify({
            'user': user.to_dict()
        })
        
    except Exception as e:
        logger.error(f'Error obteniendo perfil: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/auth/profile', methods=['PUT'])
def update_profile():
    """Actualizar perfil del usuario"""
    try:
        # Obtener token del header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Token requerido'}), 401
        
        token = auth_header[7:]
        payload = verify_token(token)
        
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401
        
        data = request.get_json()
        
        # Buscar usuario
        user = User.query.get(payload['user_id'])
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        # Actualizar campos permitidos
        if 'nombre' in data:
            user.nombre = data['nombre'].strip()
        if 'institucion' in data:
            user.institucion = data['institucion'].strip()
        
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f'Perfil actualizado para usuario {user.id}')
        
        return jsonify({
            'message': 'Perfil actualizado exitosamente',
            'user': user.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error actualizando perfil: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

# =============================================================================
# RUTAS ADMINISTRATIVAS
# =============================================================================

@app.route('/api/v1/auth/users', methods=['GET'])
def list_users():
    """Listar usuarios (solo para administradores)"""
    try:
        # Obtener token del header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Token requerido'}), 401
        
        token = auth_header[7:]
        payload = verify_token(token)
        
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401
        
        # Verificar que el usuario sea investigador (para esta funcionalidad)
        user = User.query.get(payload['user_id'])
        if not user or user.rol != 'investigador':
            return jsonify({'error': 'Acceso denegado'}), 403
        
        # Obtener parámetros de paginación
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 10, type=int), 100)
        
        # Obtener usuarios
        users = User.query.paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
        
        return jsonify({
            'users': [user.to_dict() for user in users.items],
            'total': users.total,
            'pages': users.pages,
            'current_page': page
        })
        
    except Exception as e:
        logger.error(f'Error listando usuarios: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

# =============================================================================
# MANEJADORES DE ERRORES
# =============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint no encontrado'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Error interno del servidor'}), 500

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
    
    port = int(os.getenv('PORT', 5001))
    host = os.getenv('HOST', '0.0.0.0')
    debug = os.getenv('FLASK_ENV') == 'development'
    
    logger.info(f'Iniciando Auth Service en {host}:{port}')
    app.run(host=host, port=port, debug=debug)
