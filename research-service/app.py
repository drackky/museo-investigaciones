"""
Servicio de Investigaciones - Plataforma de Investigaciones del Museo
Gestiona investigaciones activas, tickets y proyectos tipo Jira.
"""

import os
import logging
from datetime import datetime, date
from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import jwt
import pymysql
from dotenv import load_dotenv
import requests
import json
import magic
import uuid

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
DB_NAME = os.getenv('DB_NAME', 'museum_research_db')

app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-key')
app.config['JSON_SORT_KEYS'] = False

# Configuración de archivos
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
MAX_FILE_SIZE = int(os.getenv('MAX_FILE_SIZE', 52428800))  # 50MB por defecto
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'}

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

# URL del servicio de autenticación
AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', 'http://localhost:5001')

# =============================================================================
# MODELOS DE BASE DE DATOS
# =============================================================================

class Investigation(db.Model):
    __tablename__ = 'investigations'
    
    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(50), unique=True, nullable=False)
    titulo = db.Column(db.String(500), nullable=False)
    descripcion = db.Column(db.Text)
    investigador_principal_id = db.Column(db.Integer, nullable=False)
    institucion = db.Column(db.String(255))
    estado = db.Column(db.Enum('planificacion', 'en_progreso', 'revision', 'completada', 'pausada', name='investigation_states'), 
                      nullable=False, default='planificacion')
    prioridad = db.Column(db.Enum('baja', 'media', 'alta', 'critica', name='priority_levels'), 
                         nullable=False, default='media')
    fecha_inicio = db.Column(db.Date)
    fecha_fin_estimada = db.Column(db.Date)
    fecha_fin_real = db.Column(db.Date)
    presupuesto = db.Column(db.Numeric(12, 2))
    progreso_porcentaje = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    members = db.relationship('InvestigationMember', backref='investigation', cascade='all, delete-orphan')
    tickets = db.relationship('Ticket', backref='investigation', cascade='all, delete-orphan')
    history = db.relationship('InvestigationHistory', backref='investigation', cascade='all, delete-orphan')
    
    def to_dict(self, include_members=False, include_tickets=False):
        # Contar colaboradores activos
        total_colaboradores = len([m for m in self.members if m.is_active]) if self.members else 1
        
        # Contar tickets
        total_tickets = len(self.tickets) if self.tickets else 0
        
        result = {
            'id': self.id,
            'codigo': self.codigo,
            'titulo': self.titulo,
            'descripcion': self.descripcion,
            'investigador_principal_id': self.investigador_principal_id,
            'institucion': self.institucion,
            'estado': self.estado,
            'prioridad': self.prioridad,
            'fecha_inicio': self.fecha_inicio.isoformat() if self.fecha_inicio else None,
            'fecha_fin_estimada': self.fecha_fin_estimada.isoformat() if self.fecha_fin_estimada else None,
            'fecha_fin_real': self.fecha_fin_real.isoformat() if self.fecha_fin_real else None,
            'presupuesto': float(self.presupuesto) if self.presupuesto else None,
            'progreso': self.progreso_porcentaje,
            'progreso_porcentaje': self.progreso_porcentaje,
            'total_colaboradores': total_colaboradores,
            'total_tickets': total_tickets,
            'fecha_creacion': self.created_at.isoformat() if self.created_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_members:
            result['members'] = [member.to_dict() for member in self.members if member.is_active]
        
        if include_tickets:
            result['tickets'] = [ticket.to_dict() for ticket in self.tickets]
        
        return result

class InvestigationMember(db.Model):
    __tablename__ = 'investigation_members'
    
    id = db.Column(db.Integer, primary_key=True)
    investigation_id = db.Column(db.Integer, db.ForeignKey('investigations.id'), nullable=False)
    user_id = db.Column(db.Integer, nullable=False)
    rol = db.Column(db.Enum('principal', 'colaborador', 'asistente', name='member_roles'), 
                   nullable=False, default='colaborador')
    fecha_incorporacion = db.Column(db.Date, default=date.today)
    is_active = db.Column(db.Boolean, default=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'investigation_id': self.investigation_id,
            'user_id': self.user_id,
            'rol': self.rol,
            'fecha_incorporacion': self.fecha_incorporacion.isoformat() if self.fecha_incorporacion else None,
            'is_active': self.is_active
        }

class Ticket(db.Model):
    __tablename__ = 'tickets'
    
    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(50), unique=True, nullable=False)
    investigation_id = db.Column(db.Integer, db.ForeignKey('investigations.id'), nullable=False)
    titulo = db.Column(db.String(500), nullable=False)
    descripcion = db.Column(db.Text)
    proyecto = db.Column(db.String(255))
    tipo = db.Column(db.Enum('tarea', 'bug', 'mejora', 'investigacion', name='ticket_types'), 
                    nullable=False, default='tarea')
    prioridad = db.Column(db.Enum('baja', 'media', 'alta', 'critica', name='ticket_priorities'), 
                         nullable=False, default='media')
    estado = db.Column(db.Enum('pendiente', 'en_progreso', 'en_revision', 'completado', 'cancelado', name='ticket_states'), 
                      nullable=False, default='pendiente')
    asignado_a = db.Column(db.Integer)
    creado_por = db.Column(db.Integer, nullable=False)
    fecha_estimada = db.Column(db.Date)
    horas_estimadas = db.Column(db.Integer)
    horas_trabajadas = db.Column(db.Integer, default=0)
    etiquetas = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    comments = db.relationship('TicketComment', backref='ticket', cascade='all, delete-orphan')
    
    def to_dict(self, include_comments=False):
        result = {
            'id': self.id,
            'codigo': self.codigo,
            'investigation_id': self.investigation_id,
            'titulo': self.titulo,
            'descripcion': self.descripcion,
            'proyecto': self.proyecto,
            'tipo': self.tipo,
            'prioridad': self.prioridad,
            'estado': self.estado,
            'asignado_a': self.asignado_a,
            'creado_por': self.creado_por,
            'fecha_estimada': self.fecha_estimada.isoformat() if self.fecha_estimada else None,
            'horas_estimadas': self.horas_estimadas,
            'horas_trabajadas': self.horas_trabajadas,
            'etiquetas': self.etiquetas,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_comments:
            result['comments'] = [comment.to_dict() for comment in self.comments]
        
        return result

class TicketComment(db.Model):
    __tablename__ = 'ticket_comments'
    
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False)
    user_id = db.Column(db.Integer, nullable=False)
    comentario = db.Column(db.Text, nullable=False)
    is_internal = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'ticket_id': self.ticket_id,
            'user_id': self.user_id,
            'comentario': self.comentario,
            'is_internal': self.is_internal,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class InvestigationHistory(db.Model):
    __tablename__ = 'investigation_history'
    
    id = db.Column(db.Integer, primary_key=True)
    investigation_id = db.Column(db.Integer, db.ForeignKey('investigations.id'))
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'))
    user_id = db.Column(db.Integer, nullable=False)
    accion = db.Column(db.String(100), nullable=False)
    campo_modificado = db.Column(db.String(100))
    valor_anterior = db.Column(db.Text)
    valor_nuevo = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'investigation_id': self.investigation_id,
            'ticket_id': self.ticket_id,
            'user_id': self.user_id,
            'accion': self.accion,
            'campo_modificado': self.campo_modificado,
            'valor_anterior': self.valor_anterior,
            'valor_nuevo': self.valor_nuevo,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class InvestigationFile(db.Model):
    __tablename__ = 'investigation_files'
    
    id = db.Column(db.Integer, primary_key=True)
    investigation_id = db.Column(db.Integer, db.ForeignKey('investigations.id'), nullable=False)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=True)
    filename = db.Column(db.String(255), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(1000), nullable=False)
    file_size = db.Column(db.BigInteger, nullable=False)
    mime_type = db.Column(db.String(100), nullable=False)
    file_type = db.Column(db.Enum('document', 'image', 'data', 'other', name='file_types'), 
                         nullable=False, default='document')
    uploaded_by = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'investigation_id': self.investigation_id,
            'ticket_id': self.ticket_id,
            'filename': self.filename,
            'original_name': self.original_name,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'file_type': self.file_type,
            'uploaded_by': self.uploaded_by,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# =============================================================================
# UTILIDADES
# =============================================================================

def allowed_file(filename):
    """Verificar si el archivo tiene una extensión permitida"""
    if not filename or '.' not in filename:
        return False
    extension = filename.rsplit('.', 1)[1].lower()
    return extension in ALLOWED_EXTENSIONS

def get_file_type(mime_type, filename):
    """Determinar el tipo de archivo basado en MIME type y extensión"""
    if mime_type.startswith('image/'):
        return 'image'
    elif mime_type in ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']:
        return 'document'
    elif mime_type in ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']:
        return 'data'
    else:
        return 'other'

def generate_unique_filename(original_filename):
    """Generar nombre único para archivo"""
    name, ext = os.path.splitext(secure_filename(original_filename))
    unique_id = str(uuid.uuid4())
    return f"{unique_id}_{name}{ext}"

def format_file_size(bytes_size):
    """Formatear tamaño de archivo"""
    if bytes_size == 0:
        return "0 B"
    size_names = ["B", "KB", "MB", "GB", "TB"]
    import math
    i = int(math.floor(math.log(bytes_size, 1024)))
    p = math.pow(1024, i)
    s = round(bytes_size / p, 2)
    return f"{s} {size_names[i]}"

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

def generate_investigation_code(titulo):
    """Generar código único para investigación"""
    # Tomar las primeras 3 letras del título
    prefix = ''.join([c.upper() for c in titulo if c.isalpha()])[:3]
    if len(prefix) < 3:
        prefix = 'INV'
    
    # Encontrar el siguiente número disponible
    counter = 1
    while True:
        code = f"{prefix}-{counter:04d}"
        existing = Investigation.query.filter_by(codigo=code).first()
        if not existing:
            return code
        counter += 1

def generate_ticket_code(investigation_id):
    """Generar código único para ticket"""
    investigation = Investigation.query.get(investigation_id)
    if not investigation:
        return None
    
    # Usar código de investigación como base
    inv_code = investigation.codigo
    
    # Contar tickets existentes en la investigación
    ticket_count = Ticket.query.filter_by(investigation_id=investigation_id).count()
    
    return f"{inv_code}-T{ticket_count + 1:03d}"

def log_history(user_id, accion, investigation_id=None, ticket_id=None, campo=None, valor_anterior=None, valor_nuevo=None):
    """Registrar cambio en historial"""
    try:
        history = InvestigationHistory(
            investigation_id=investigation_id,
            ticket_id=ticket_id,
            user_id=user_id,
            accion=accion,
            campo_modificado=campo,
            valor_anterior=valor_anterior,
            valor_nuevo=valor_nuevo
        )
        db.session.add(history)
        db.session.flush()
        return history
    except Exception as e:
        logger.error(f'Error registrando historial: {str(e)}')
        return None

def user_has_access(user_id, investigation_id):
    """Verificar si el usuario tiene acceso a la investigación"""
    investigation = Investigation.query.get(investigation_id)
    if not investigation:
        return False
    
    # El investigador principal siempre tiene acceso
    if investigation.investigador_principal_id == user_id:
        return True
    
    # Verificar si es miembro del equipo
    member = InvestigationMember.query.filter_by(
        investigation_id=investigation_id,
        user_id=user_id,
        is_active=True
    ).first()
    
    return bool(member)

# =============================================================================
# RUTAS DE INVESTIGACIONES
# =============================================================================

@app.route('/health')
def health_check():
    """Health check del servicio"""
    try:
        # Verificar conexión a la base de datos
        db.session.execute(db.text('SELECT 1'))
        return jsonify({'status': 'healthy', 'service': 'research-service'})
    except Exception as e:
        logger.error(f'Health check failed: {str(e)}')
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

@app.route('/api/v1/investigations', methods=['GET'])
def get_investigations():
    """Obtener lista de investigaciones"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        # Parámetros de paginación y filtros
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        estado = request.args.get('estado')
        prioridad = request.args.get('prioridad')
        investigador_id = request.args.get('investigador_id', type=int)
        buscar = request.args.get('search', '').strip()
        
        # Construir query base - solo investigaciones donde el usuario tiene acceso
        query = db.session.query(Investigation).join(
            InvestigationMember,
            db.or_(
                Investigation.investigador_principal_id == current_user['user_id'],
                db.and_(
                    InvestigationMember.investigation_id == Investigation.id,
                    InvestigationMember.user_id == current_user['user_id'],
                    InvestigationMember.is_active == True
                )
            )
        ).distinct()
        
        # Aplicar filtros
        if estado:
            query = query.filter(Investigation.estado == estado)
        
        if prioridad:
            query = query.filter(Investigation.prioridad == prioridad)
        
        if investigador_id:
            query = query.filter(Investigation.investigador_principal_id == investigador_id)
        
        if buscar:
            query = query.filter(
                db.or_(
                    Investigation.titulo.contains(buscar),
                    Investigation.descripcion.contains(buscar),
                    Investigation.codigo.contains(buscar)
                )
            )
        
        # Ordenar por fecha de actualización descendente
        query = query.order_by(Investigation.updated_at.desc())
        
        # Paginar
        investigations = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        return jsonify({
            'investigaciones': [inv.to_dict(include_members=True) for inv in investigations.items],
            'total': investigations.total,
            'pages': investigations.pages,
            'current_page': page,
            'per_page': per_page
        })
        
    except Exception as e:
        logger.error(f'Error obteniendo investigaciones: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/investigations/<int:investigation_id>', methods=['GET'])
def get_investigation(investigation_id):
    """Obtener una investigación específica"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        investigation = Investigation.query.get_or_404(investigation_id)
        
        # Verificar acceso
        if not user_has_access(current_user['user_id'], investigation_id):
            return jsonify({'error': 'Acceso denegado'}), 403
        
        return jsonify({
            'investigation': investigation.to_dict(include_members=True, include_tickets=True)
        })
        
    except Exception as e:
        logger.error(f'Error obteniendo investigación: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/investigations', methods=['POST'])
def create_investigation():
    """Crear nueva investigación"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        data = request.get_json()
        
        # Validar datos requeridos
        if not data.get('titulo'):
            return jsonify({'error': 'Título es requerido'}), 400
        
        titulo = data['titulo'].strip()
        descripcion = data.get('descripcion', '').strip()
        institucion = data.get('institucion', '').strip()
        prioridad = data.get('prioridad', 'media')
        presupuesto = data.get('presupuesto')
        fecha_inicio = data.get('fecha_inicio')
        fecha_fin_estimada = data.get('fecha_fin_estimada')
        
        # Validar enums
        if prioridad not in ['baja', 'media', 'alta', 'critica']:
            return jsonify({'error': 'Prioridad inválida'}), 400
        
        # Procesar fechas
        fecha_inicio_obj = None
        fecha_fin_obj = None
        
        if fecha_inicio:
            try:
                fecha_inicio_obj = datetime.strptime(fecha_inicio, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Formato de fecha de inicio inválido (YYYY-MM-DD)'}), 400
        
        if fecha_fin_estimada:
            try:
                fecha_fin_obj = datetime.strptime(fecha_fin_estimada, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Formato de fecha de fin inválido (YYYY-MM-DD)'}), 400
        
        # Generar código único
        codigo = generate_investigation_code(titulo)
        
        # Crear investigación
        investigation = Investigation(
            codigo=codigo,
            titulo=titulo,
            descripcion=descripcion,
            investigador_principal_id=current_user['user_id'],
            institucion=institucion,
            prioridad=prioridad,
            fecha_inicio=fecha_inicio_obj,
            fecha_fin_estimada=fecha_fin_obj,
            presupuesto=presupuesto
        )
        
        db.session.add(investigation)
        db.session.flush()
        
        # Agregar investigador principal como miembro
        principal_member = InvestigationMember(
            investigation_id=investigation.id,
            user_id=current_user['user_id'],
            rol='principal'
        )
        db.session.add(principal_member)
        
        # Registrar en historial
        log_history(
            user_id=current_user['user_id'],
            accion='Investigación creada',
            investigation_id=investigation.id
        )
        
        db.session.commit()
        
        logger.info(f'Investigación creada: {investigation.id} por usuario {current_user["user_id"]}')
        
        return jsonify({
            'message': 'Investigación creada exitosamente',
            'investigation': investigation.to_dict(include_members=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error creando investigación: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/investigations/<int:investigation_id>', methods=['PUT'])
def update_investigation(investigation_id):
    """Actualizar investigación"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        investigation = Investigation.query.get_or_404(investigation_id)
        
        # Solo el investigador principal puede actualizar
        if investigation.investigador_principal_id != current_user['user_id']:
            return jsonify({'error': 'Solo el investigador principal puede modificar la investigación'}), 403
        
        data = request.get_json()
        
        # Campos que se pueden actualizar
        campos_actualizables = [
            'titulo', 'descripcion', 'institucion', 'estado', 'prioridad',
            'fecha_fin_estimada', 'presupuesto', 'progreso_porcentaje'
        ]
        
        cambios = []
        
        for campo in campos_actualizables:
            if campo in data:
                valor_anterior = getattr(investigation, campo)
                nuevo_valor = data[campo]
                
                # Validaciones específicas
                if campo == 'estado' and nuevo_valor not in ['planificacion', 'en_progreso', 'revision', 'completada', 'pausada']:
                    return jsonify({'error': 'Estado inválido'}), 400
                
                if campo == 'prioridad' and nuevo_valor not in ['baja', 'media', 'alta', 'critica']:
                    return jsonify({'error': 'Prioridad inválida'}), 400
                
                if campo == 'progreso_porcentaje':
                    nuevo_valor = max(0, min(100, int(nuevo_valor)))
                
                if campo == 'fecha_fin_estimada' and nuevo_valor:
                    try:
                        nuevo_valor = datetime.strptime(nuevo_valor, '%Y-%m-%d').date()
                    except ValueError:
                        return jsonify({'error': 'Formato de fecha inválido'}), 400
                
                # Aplicar cambio si es diferente
                if str(valor_anterior) != str(nuevo_valor):
                    setattr(investigation, campo, nuevo_valor)
                    cambios.append({
                        'campo': campo,
                        'anterior': str(valor_anterior),
                        'nuevo': str(nuevo_valor)
                    })
        
        # Actualizar fecha de modificación
        investigation.updated_at = datetime.utcnow()
        
        # Registrar cambios en historial
        for cambio in cambios:
            log_history(
                user_id=current_user['user_id'],
                accion='Campo actualizado',
                investigation_id=investigation.id,
                campo=cambio['campo'],
                valor_anterior=cambio['anterior'],
                valor_nuevo=cambio['nuevo']
            )
        
        db.session.commit()
        
        logger.info(f'Investigación actualizada: {investigation.id}')
        
        return jsonify({
            'message': 'Investigación actualizada exitosamente',
            'investigation': investigation.to_dict(include_members=True),
            'changes': len(cambios)
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error actualizando investigación: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/investigations/<int:investigation_id>', methods=['DELETE'])
def delete_investigation(investigation_id):
    """Eliminar investigación"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        investigation = Investigation.query.get_or_404(investigation_id)
        
        if investigation.investigador_principal_id != current_user['user_id']:
            return jsonify({'error': 'Solo el investigador principal puede eliminar la investigación'}), 403
        
        db.session.delete(investigation)
        db.session.commit()
        
        logger.info(f'Investigación eliminada: {investigation_id} por usuario {current_user["user_id"]}')
        
        return jsonify({'message': 'Investigación eliminada exitosamente'})
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error eliminando investigación: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

# =============================================================================
# RUTAS DE TICKETS
# =============================================================================

@app.route('/api/v1/investigations/<int:investigation_id>/tickets', methods=['GET'])
def get_tickets(investigation_id):
    """Obtener tickets de una investigación"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        # Verificar acceso a la investigación
        if not user_has_access(current_user['user_id'], investigation_id):
            return jsonify({'error': 'Acceso denegado'}), 403
        
        # Parámetros de filtrado
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 100)
        estado = request.args.get('estado')
        prioridad = request.args.get('prioridad')
        tipo = request.args.get('tipo')
        asignado_a = request.args.get('asignado_a', type=int)
        buscar = request.args.get('search', '').strip()
        
        # Construir query
        query = Ticket.query.filter_by(investigation_id=investigation_id)
        
        if estado:
            query = query.filter(Ticket.estado == estado)
        
        if prioridad:
            query = query.filter(Ticket.prioridad == prioridad)
        
        if tipo:
            query = query.filter(Ticket.tipo == tipo)
        
        if asignado_a:
            query = query.filter(Ticket.asignado_a == asignado_a)
        
        if buscar:
            query = query.filter(
                db.or_(
                    Ticket.titulo.contains(buscar),
                    Ticket.descripcion.contains(buscar),
                    Ticket.codigo.contains(buscar)
                )
            )
        
        # Ordenar por prioridad y fecha de creación
        query = query.order_by(
            db.case(
                (Ticket.prioridad == 'critica', 1),
                (Ticket.prioridad == 'alta', 2),
                (Ticket.prioridad == 'media', 3),
                (Ticket.prioridad == 'baja', 4),
                else_=5
            ),
            Ticket.created_at.desc()
        )
        
        # Paginar
        tickets = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        return jsonify({
            'tickets': [ticket.to_dict() for ticket in tickets.items],
            'total': tickets.total,
            'pages': tickets.pages,
            'current_page': page,
            'per_page': per_page
        })
        
    except Exception as e:
        logger.error(f'Error obteniendo tickets: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/investigations/<int:investigation_id>/tickets', methods=['POST'])
def create_ticket(investigation_id):
    """Crear nuevo ticket"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        # Verificar acceso a la investigación
        if not user_has_access(current_user['user_id'], investigation_id):
            return jsonify({'error': 'Acceso denegado'}), 403
        
        data = request.get_json()
        
        # Validar datos requeridos
        if not data.get('titulo'):
            return jsonify({'error': 'Título es requerido'}), 400
        
        titulo = data['titulo'].strip()
        descripcion = data.get('descripcion', '').strip()
        proyecto = data.get('proyecto', '').strip()
        tipo = data.get('tipo', 'tarea')
        prioridad = data.get('prioridad', 'media')
        asignado_a = data.get('asignado_a', type=int)
        fecha_estimada = data.get('fecha_estimada')
        horas_estimadas = data.get('horas_estimadas', type=int)
        etiquetas = data.get('etiquetas', [])
        
        # Validar enums
        if tipo not in ['tarea', 'bug', 'mejora', 'investigacion']:
            return jsonify({'error': 'Tipo inválido'}), 400
        
        if prioridad not in ['baja', 'media', 'alta', 'critica']:
            return jsonify({'error': 'Prioridad inválida'}), 400
        
        # Validar asignación (si se especifica, debe ser miembro del equipo)
        if asignado_a and not user_has_access(asignado_a, investigation_id):
            return jsonify({'error': 'Solo se puede asignar a miembros del equipo'}), 400
        
        # Procesar fecha estimada
        fecha_estimada_obj = None
        if fecha_estimada:
            try:
                fecha_estimada_obj = datetime.strptime(fecha_estimada, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Formato de fecha inválido (YYYY-MM-DD)'}), 400
        
        # Generar código único
        codigo = generate_ticket_code(investigation_id)
        
        # Crear ticket
        ticket = Ticket(
            codigo=codigo,
            investigation_id=investigation_id,
            titulo=titulo,
            descripcion=descripcion,
            proyecto=proyecto,
            tipo=tipo,
            prioridad=prioridad,
            asignado_a=asignado_a,
            creado_por=current_user['user_id'],
            fecha_estimada=fecha_estimada_obj,
            horas_estimadas=horas_estimadas,
            etiquetas=etiquetas
        )
        
        db.session.add(ticket)
        db.session.flush()
        
        # Registrar en historial
        log_history(
            user_id=current_user['user_id'],
            accion='Ticket creado',
            investigation_id=investigation_id,
            ticket_id=ticket.id
        )
        
        db.session.commit()
        
        logger.info(f'Ticket creado: {ticket.id} por usuario {current_user["user_id"]}')
        
        return jsonify({
            'message': 'Ticket creado exitosamente',
            'ticket': ticket.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error creando ticket: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/tickets/<int:ticket_id>', methods=['PUT'])
def update_ticket(ticket_id):
    """Actualizar ticket"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        ticket = Ticket.query.get_or_404(ticket_id)
        
        # Verificar acceso a la investigación
        if not user_has_access(current_user['user_id'], ticket.investigation_id):
            return jsonify({'error': 'Acceso denegado'}), 403
        
        data = request.get_json()
        
        # Campos que se pueden actualizar
        campos_actualizables = [
            'titulo', 'descripcion', 'proyecto', 'tipo', 'prioridad', 'estado',
            'asignado_a', 'fecha_estimada', 'horas_estimadas', 'horas_trabajadas', 'etiquetas'
        ]
        
        cambios = []
        
        for campo in campos_actualizables:
            if campo in data:
                valor_anterior = getattr(ticket, campo)
                nuevo_valor = data[campo]
                
                # Validaciones específicas
                if campo == 'tipo' and nuevo_valor not in ['tarea', 'bug', 'mejora', 'investigacion']:
                    return jsonify({'error': 'Tipo inválido'}), 400
                
                if campo == 'prioridad' and nuevo_valor not in ['baja', 'media', 'alta', 'critica']:
                    return jsonify({'error': 'Prioridad inválida'}), 400
                
                if campo == 'estado' and nuevo_valor not in ['pendiente', 'en_progreso', 'en_revision', 'completado', 'cancelado']:
                    return jsonify({'error': 'Estado inválido'}), 400
                
                if campo == 'asignado_a' and nuevo_valor and not user_has_access(nuevo_valor, ticket.investigation_id):
                    return jsonify({'error': 'Solo se puede asignar a miembros del equipo'}), 400
                
                if campo == 'fecha_estimada' and nuevo_valor:
                    try:
                        nuevo_valor = datetime.strptime(nuevo_valor, '%Y-%m-%d').date()
                    except ValueError:
                        return jsonify({'error': 'Formato de fecha inválido'}), 400
                
                # Aplicar cambio si es diferente
                if str(valor_anterior) != str(nuevo_valor):
                    setattr(ticket, campo, nuevo_valor)
                    cambios.append({
                        'campo': campo,
                        'anterior': str(valor_anterior),
                        'nuevo': str(nuevo_valor)
                    })
        
        # Actualizar fecha de modificación
        ticket.updated_at = datetime.utcnow()
        
        # Registrar cambios en historial
        for cambio in cambios:
            log_history(
                user_id=current_user['user_id'],
                accion='Ticket actualizado',
                investigation_id=ticket.investigation_id,
                ticket_id=ticket.id,
                campo=cambio['campo'],
                valor_anterior=cambio['anterior'],
                valor_nuevo=cambio['nuevo']
            )
        
        db.session.commit()
        
        logger.info(f'Ticket actualizado: {ticket.id}')
        
        return jsonify({
            'message': 'Ticket actualizado exitosamente',
            'ticket': ticket.to_dict(),
            'changes': len(cambios)
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error actualizando ticket: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

# =============================================================================
# RUTAS DE COMENTARIOS EN TICKETS
# =============================================================================

@app.route('/api/v1/tickets/<int:ticket_id>/comments', methods=['POST'])
def add_ticket_comment(ticket_id):
    """Agregar comentario a ticket"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        ticket = Ticket.query.get_or_404(ticket_id)
        
        # Verificar acceso a la investigación
        if not user_has_access(current_user['user_id'], ticket.investigation_id):
            return jsonify({'error': 'Acceso denegado'}), 403
        
        data = request.get_json()
        
        if not data.get('comentario'):
            return jsonify({'error': 'Comentario requerido'}), 400
        
        comentario = data['comentario'].strip()
        is_internal = data.get('is_internal', False)
        
        # Crear comentario
        comment = TicketComment(
            ticket_id=ticket_id,
            user_id=current_user['user_id'],
            comentario=comentario,
            is_internal=is_internal
        )
        
        db.session.add(comment)
        
        # Registrar en historial
        log_history(
            user_id=current_user['user_id'],
            accion='Comentario agregado',
            investigation_id=ticket.investigation_id,
            ticket_id=ticket_id
        )
        
        db.session.commit()
        
        return jsonify({
            'message': 'Comentario agregado exitosamente',
            'comment': comment.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error agregando comentario: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

# =============================================================================
# RUTAS DE ARCHIVOS
# =============================================================================

@app.route('/api/v1/investigations/<int:investigation_id>/files', methods=['POST'])
def upload_investigation_file(investigation_id):
    """Subir archivo a investigación"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        # Verificar acceso a la investigación
        if not user_has_access(current_user['user_id'], investigation_id):
            return jsonify({'error': 'Acceso denegado'}), 403
        
        # Verificar si hay archivo
        if 'file' not in request.files:
            return jsonify({'error': 'Archivo requerido'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Archivo no seleccionado'}), 400
        
        # Validar extensión
        if not allowed_file(file.filename):
            return jsonify({'error': 'Tipo de archivo no permitido'}), 400
        
        # Obtener datos adicionales
        ticket_id = request.form.get('ticket_id', type=int)
        description = request.form.get('description', '').strip()
        
        # Validar ticket_id si se proporciona
        if ticket_id:
            ticket = Ticket.query.filter_by(id=ticket_id, investigation_id=investigation_id).first()
            if not ticket:
                return jsonify({'error': 'Ticket no encontrado en esta investigación'}), 404
        
        # Generar nombre único para archivo
        unique_filename = generate_unique_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        # Guardar archivo
        file.save(file_path)
        
        # Obtener información del archivo
        file_size = os.path.getsize(file_path)
        mime_type = magic.from_file(file_path, mime=True)
        file_type = get_file_type(mime_type, file.filename)
        
        # Crear registro en base de datos
        investigation_file = InvestigationFile(
            investigation_id=investigation_id,
            ticket_id=ticket_id,
            filename=unique_filename,
            original_name=file.filename,
            file_path=file_path,
            file_size=file_size,
            mime_type=mime_type,
            file_type=file_type,
            uploaded_by=current_user['user_id'],
            description=description
        )
        
        db.session.add(investigation_file)
        
        # Registrar en historial
        log_history(
            user_id=current_user['user_id'],
            accion='Archivo subido',
            investigation_id=investigation_id,
            ticket_id=ticket_id
        )
        
        db.session.commit()
        
        logger.info(f'Archivo subido: {investigation_file.id} por usuario {current_user["user_id"]}')
        
        return jsonify({
            'message': 'Archivo subido exitosamente',
            'file': investigation_file.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        # Limpiar archivo si hubo error
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        logger.error(f'Error subiendo archivo: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/investigations/<int:investigation_id>/files', methods=['GET'])
def get_investigation_files(investigation_id):
    """Obtener archivos de una investigación"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        # Verificar acceso a la investigación
        if not user_has_access(current_user['user_id'], investigation_id):
            return jsonify({'error': 'Acceso denegado'}), 403
        
        # Filtros opcionales
        file_type = request.args.get('file_type')
        ticket_id = request.args.get('ticket_id', type=int)
        
        # Construir query
        query = InvestigationFile.query.filter_by(investigation_id=investigation_id)
        
        if file_type:
            query = query.filter(InvestigationFile.file_type == file_type)
        
        if ticket_id:
            query = query.filter(InvestigationFile.ticket_id == ticket_id)
        
        # Ordenar por fecha de subida descendente
        files = query.order_by(InvestigationFile.created_at.desc()).all()
        
        return jsonify({
            'files': [file.to_dict() for file in files],
            'total': len(files)
        })
        
    except Exception as e:
        logger.error(f'Error obteniendo archivos: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/investigations/<int:investigation_id>/files/<int:file_id>/download', methods=['GET'])
def download_investigation_file(investigation_id, file_id):
    """Descargar archivo de investigación"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        # Verificar acceso a la investigación
        if not user_has_access(current_user['user_id'], investigation_id):
            return jsonify({'error': 'Acceso denegado'}), 403
        
        # Buscar archivo
        file_record = InvestigationFile.query.filter_by(
            id=file_id,
            investigation_id=investigation_id
        ).first()
        
        if not file_record:
            return jsonify({'error': 'Archivo no encontrado'}), 404
        
        if not os.path.exists(file_record.file_path):
            return jsonify({'error': 'Archivo físico no encontrado'}), 404
        
        return send_file(
            file_record.file_path,
            as_attachment=True,
            download_name=file_record.original_name
        )
        
    except Exception as e:
        logger.error(f'Error descargando archivo: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/investigations/<int:investigation_id>/files/<int:file_id>', methods=['DELETE'])
def delete_investigation_file(investigation_id, file_id):
    """Eliminar archivo de investigación"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        # Verificar acceso a la investigación
        if not user_has_access(current_user['user_id'], investigation_id):
            return jsonify({'error': 'Acceso denegado'}), 403
        
        # Buscar archivo
        file_record = InvestigationFile.query.filter_by(
            id=file_id,
            investigation_id=investigation_id
        ).first()
        
        if not file_record:
            return jsonify({'error': 'Archivo no encontrado'}), 404
        
        # Solo el usuario que subió el archivo o el investigador principal pueden eliminarlo
        investigation = Investigation.query.get(investigation_id)
        if (file_record.uploaded_by != current_user['user_id'] and 
            investigation.investigador_principal_id != current_user['user_id']):
            return jsonify({'error': 'No tienes permisos para eliminar este archivo'}), 403
        
        # Eliminar archivo físico
        if os.path.exists(file_record.file_path):
            os.remove(file_record.file_path)
        
        # Eliminar registro
        db.session.delete(file_record)
        
        # Registrar en historial
        log_history(
            user_id=current_user['user_id'],
            accion='Archivo eliminado',
            investigation_id=investigation_id,
            ticket_id=file_record.ticket_id
        )
        
        db.session.commit()
        
        logger.info(f'Archivo eliminado: {file_id} por usuario {current_user["user_id"]}')
        
        return jsonify({'message': 'Archivo eliminado exitosamente'})
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error eliminando archivo: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

# =============================================================================
# RUTAS DE ESTADÍSTICAS Y REPORTES
# =============================================================================

@app.route('/api/v1/investigations/dashboard', methods=['GET'])
def get_dashboard_stats():
    """Obtener estadísticas para el dashboard"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        # Estadísticas de investigaciones del usuario
        investigations_query = db.session.query(Investigation).join(
            InvestigationMember,
            db.or_(
                Investigation.investigador_principal_id == current_user['user_id'],
                db.and_(
                    InvestigationMember.investigation_id == Investigation.id,
                    InvestigationMember.user_id == current_user['user_id'],
                    InvestigationMember.is_active == True
                )
            )
        ).distinct()
        
        total_investigations = investigations_query.count()
        active_investigations = investigations_query.filter(
            Investigation.estado.in_(['planificacion', 'en_progreso', 'revision'])
        ).count()
        completed_investigations = investigations_query.filter(Investigation.estado == 'completada').count()
        
        # Estadísticas de tickets  
        user_investigations = [inv.id for inv in investigations_query.all()]
        
        if user_investigations:
            completed_tickets = Ticket.query.filter(
                Ticket.investigation_id.in_(user_investigations),
                Ticket.estado == 'completado'
            ).count()
            
            # Contar colaboradores únicos
            total_collaborators = db.session.query(InvestigationMember.user_id).filter(
                InvestigationMember.investigation_id.in_(user_investigations),
                InvestigationMember.is_active == True
            ).distinct().count()
        else:
            completed_tickets = 0
            total_collaborators = 1  # Al menos el usuario actual
        
        return jsonify({
            'success': True,
            'stats': {
                'investigaciones_activas': active_investigations,
                'tickets_completados': completed_tickets,
                'total_colaboradores': total_collaborators,
                'tiempo_promedio': '12d'  # Valor por defecto por ahora
            }
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
    
    port = int(os.getenv('PORT', 5005))
    host = os.getenv('HOST', '0.0.0.0')
    debug = os.getenv('FLASK_ENV') == 'development'
    
    logger.info(f'Iniciando Research Service en {host}:{port}')
    app.run(host=host, port=port, debug=debug)
