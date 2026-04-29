"""
Servicio de Comentarios - Plataforma de Investigaciones del Museo
Gestiona comentarios, hilos de conversación y notificaciones.
"""

import os
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import jwt
import pymysql
from dotenv import load_dotenv
import requests
import bleach
import re

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
DB_NAME = os.getenv('DB_NAME', 'museum_comments_db')

app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-key')
app.config['JSON_SORT_KEYS'] = False

# Inicializar extensiones
db = SQLAlchemy(app)
CORS(app)

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# URL del servicio de autenticación
AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', 'http://localhost:5001')

# Configuración de sanitización
ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote']
ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title'],
    '*': ['class']
}

# =============================================================================
# MODELOS DE BASE DE DATOS
# =============================================================================

class Comment(db.Model):
    __tablename__ = 'comments'
    
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, nullable=False)
    user_id = db.Column(db.Integer, nullable=False)
    contenido = db.Column(db.Text, nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('comments.id'))
    is_edited = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False)
    likes_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    replies = db.relationship('Comment', backref=db.backref('parent', remote_side=[id]))
    likes = db.relationship('CommentLike', backref='comment', cascade='all, delete-orphan')
    
    def to_dict(self, include_replies=False, current_user_id=None):
        result = {
            'id': self.id,
            'document_id': self.document_id,
            'user_id': self.user_id,
            'contenido': self.contenido if not self.is_deleted else '[Comentario eliminado]',
            'parent_id': self.parent_id,
            'is_edited': self.is_edited,
            'is_deleted': self.is_deleted,
            'likes_count': self.likes_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        # Verificar si el usuario actual le dio like
        if current_user_id:
            user_like = CommentLike.query.filter_by(
                comment_id=self.id,
                user_id=current_user_id
            ).first()
            result['user_liked'] = bool(user_like)
        else:
            result['user_liked'] = False
        
        # Incluir respuestas si se solicita
        if include_replies:
            result['replies'] = [
                reply.to_dict(include_replies=False, current_user_id=current_user_id)
                for reply in self.replies
                if not reply.is_deleted
            ]
        
        return result

class CommentLike(db.Model):
    __tablename__ = 'comment_likes'
    
    id = db.Column(db.Integer, primary_key=True)
    comment_id = db.Column(db.Integer, db.ForeignKey('comments.id'), nullable=False)
    user_id = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Notification(db.Model):
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    tipo = db.Column(db.Enum('comment', 'reply', 'like', 'mention', name='notification_types'), nullable=False)
    mensaje = db.Column(db.Text, nullable=False)
    documento_id = db.Column(db.Integer)
    comentario_id = db.Column(db.Integer)
    from_user_id = db.Column(db.Integer)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'tipo': self.tipo,
            'mensaje': self.mensaje,
            'documento_id': self.documento_id,
            'comentario_id': self.comentario_id,
            'from_user_id': self.from_user_id,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# =============================================================================
# UTILIDADES
# =============================================================================

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

def get_user_info(user_id, auth_token=None):
    """Obtener información de un usuario desde el servicio de autenticación"""
    try:
        headers = {}
        if auth_token:
            headers['Authorization'] = f'Bearer {auth_token}'
        
        response = requests.get(
            f'{AUTH_SERVICE_URL}/api/v1/auth/users/{user_id}',
            headers=headers,
            timeout=5
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return None
    except Exception as e:
        logger.error(f'Error obteniendo info del usuario {user_id}: {str(e)}')
        return None

def sanitize_content(content):
    """Sanitizar contenido HTML del comentario"""
    return bleach.clean(
        content,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        strip=True
    )

def extract_mentions(content):
    """Extraer menciones de usuarios del contenido (@usuario)"""
    mentions = re.findall(r'@(\w+)', content)
    return list(set(mentions))  # Remover duplicados

def create_notification(user_id, tipo, mensaje, documento_id=None, comentario_id=None, from_user_id=None):
    """Crear notificación"""
    try:
        notification = Notification(
            user_id=user_id,
            tipo=tipo,
            mensaje=mensaje,
            documento_id=documento_id,
            comentario_id=comentario_id,
            from_user_id=from_user_id
        )
        db.session.add(notification)
        db.session.flush()
        return notification
    except Exception as e:
        logger.error(f'Error creando notificación: {str(e)}')
        return None

# =============================================================================
# RUTAS DE COMENTARIOS
# =============================================================================

@app.route('/health')
def health_check():
    """Health check del servicio"""
    try:
        # Verificar conexión a la base de datos
        db.session.execute(db.text('SELECT 1'))
        return jsonify({'status': 'healthy', 'service': 'comments-service'})
    except Exception as e:
        logger.error(f'Health check failed: {str(e)}')
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

@app.route('/api/v1/documents/<int:document_id>/comments', methods=['GET'])
def get_comments(document_id):
    """Obtener comentarios de un documento"""
    try:
        # Parámetros de paginación
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        order_by = request.args.get('order_by', 'created_at')  # created_at, likes_count
        order_dir = request.args.get('order_dir', 'desc')  # asc, desc
        
        # Usuario actual para verificar likes
        current_user = get_current_user()
        current_user_id = current_user['user_id'] if current_user else None
        
        # Construir query - solo comentarios principales (sin parent_id)
        query = Comment.query.filter(
            Comment.document_id == document_id,
            Comment.parent_id.is_(None),
            Comment.is_deleted == False
        )
        
        # Ordenamiento
        if order_by == 'likes_count':
            if order_dir == 'desc':
                query = query.order_by(Comment.likes_count.desc())
            else:
                query = query.order_by(Comment.likes_count.asc())
        else:  # created_at
            if order_dir == 'desc':
                query = query.order_by(Comment.created_at.desc())
            else:
                query = query.order_by(Comment.created_at.asc())
        
        # Paginar
        comments = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # Convertir a diccionario incluyendo respuestas
        comments_data = []
        for comment in comments.items:
            comment_dict = comment.to_dict(include_replies=True, current_user_id=current_user_id)
            comments_data.append(comment_dict)
        
        return jsonify({
            'comments': comments_data,
            'total': comments.total,
            'pages': comments.pages,
            'current_page': page,
            'per_page': per_page
        })
        
    except Exception as e:
        logger.error(f'Error obteniendo comentarios: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/documents/<int:document_id>/comments', methods=['POST'])
def create_comment(document_id):
    """Crear nuevo comentario"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        data = request.get_json()
        
        # Validar datos
        if not data.get('contenido'):
            return jsonify({'error': 'Contenido del comentario requerido'}), 400
        
        contenido = data['contenido'].strip()
        parent_id = data.get('parent_id')
        
        if len(contenido) > 2000:
            return jsonify({'error': 'El comentario es demasiado largo (máximo 2000 caracteres)'}), 400
        
        # Sanitizar contenido
        contenido_sanitizado = sanitize_content(contenido)
        
        # Validar comentario padre si se especifica
        if parent_id:
            parent_comment = Comment.query.filter_by(
                id=parent_id,
                document_id=document_id,
                is_deleted=False
            ).first()
            
            if not parent_comment:
                return jsonify({'error': 'Comentario padre no encontrado'}), 404
            
            # No permitir respuestas a respuestas (solo un nivel de profundidad)
            if parent_comment.parent_id:
                return jsonify({'error': 'No se pueden crear respuestas a respuestas'}), 400
        
        # Crear comentario
        comment = Comment(
            document_id=document_id,
            user_id=current_user['user_id'],
            contenido=contenido_sanitizado,
            parent_id=parent_id
        )
        
        db.session.add(comment)
        db.session.flush()
        
        # Crear notificaciones
        if parent_id:
            # Notificar al autor del comentario padre
            parent_comment = Comment.query.get(parent_id)
            if parent_comment.user_id != current_user['user_id']:
                create_notification(
                    user_id=parent_comment.user_id,
                    tipo='reply',
                    mensaje=f'Alguien respondió a tu comentario',
                    documento_id=document_id,
                    comentario_id=comment.id,
                    from_user_id=current_user['user_id']
                )
        
        # Extraer menciones y crear notificaciones
        mentions = extract_mentions(contenido)
        for mention in mentions:
            # Aquí podrías buscar el usuario por nombre de usuario
            # Por simplicidad, omitimos esta funcionalidad por ahora
            pass
        
        db.session.commit()
        
        logger.info(f'Comentario creado: {comment.id} por usuario {current_user["user_id"]}')
        
        return jsonify({
            'message': 'Comentario creado exitosamente',
            'comment': comment.to_dict(current_user_id=current_user['user_id'])
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error creando comentario: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/comments/<int:comment_id>', methods=['PUT'])
def update_comment(comment_id):
    """Actualizar comentario"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        comment = Comment.query.get_or_404(comment_id)
        
        # Verificar que el usuario sea el autor del comentario
        if comment.user_id != current_user['user_id']:
            return jsonify({'error': 'Solo puedes editar tus propios comentarios'}), 403
        
        # Verificar que el comentario no esté eliminado
        if comment.is_deleted:
            return jsonify({'error': 'No se puede editar un comentario eliminado'}), 400
        
        data = request.get_json()
        
        if not data.get('contenido'):
            return jsonify({'error': 'Contenido del comentario requerido'}), 400
        
        contenido = data['contenido'].strip()
        
        if len(contenido) > 2000:
            return jsonify({'error': 'El comentario es demasiado largo (máximo 2000 caracteres)'}), 400
        
        # Sanitizar contenido
        contenido_sanitizado = sanitize_content(contenido)
        
        # Actualizar comentario
        comment.contenido = contenido_sanitizado
        comment.is_edited = True
        comment.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        logger.info(f'Comentario actualizado: {comment.id}')
        
        return jsonify({
            'message': 'Comentario actualizado exitosamente',
            'comment': comment.to_dict(current_user_id=current_user['user_id'])
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error actualizando comentario: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/comments/<int:comment_id>', methods=['DELETE'])
def delete_comment(comment_id):
    """Eliminar comentario (soft delete)"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        comment = Comment.query.get_or_404(comment_id)
        
        # Verificar que el usuario sea el autor del comentario
        if comment.user_id != current_user['user_id']:
            return jsonify({'error': 'Solo puedes eliminar tus propios comentarios'}), 403
        
        # Marcar como eliminado en lugar de eliminar físicamente
        comment.is_deleted = True
        comment.contenido = '[Comentario eliminado]'
        comment.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        logger.info(f'Comentario eliminado: {comment.id}')
        
        return jsonify({'message': 'Comentario eliminado exitosamente'})
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error eliminando comentario: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/comments/<int:comment_id>/like', methods=['POST'])
def toggle_comment_like(comment_id):
    """Dar/quitar like a comentario"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        comment = Comment.query.get_or_404(comment_id)
        
        # Verificar que el comentario no esté eliminado
        if comment.is_deleted:
            return jsonify({'error': 'No se puede dar like a un comentario eliminado'}), 400
        
        # Buscar like existente
        existing_like = CommentLike.query.filter_by(
            comment_id=comment_id,
            user_id=current_user['user_id']
        ).first()
        
        if existing_like:
            # Quitar like
            db.session.delete(existing_like)
            comment.likes_count = max(0, comment.likes_count - 1)
            action = 'unliked'
        else:
            # Dar like
            new_like = CommentLike(
                comment_id=comment_id,
                user_id=current_user['user_id']
            )
            db.session.add(new_like)
            comment.likes_count += 1
            action = 'liked'
            
            # Crear notificación si no es el propio usuario
            if comment.user_id != current_user['user_id']:
                create_notification(
                    user_id=comment.user_id,
                    tipo='like',
                    mensaje=f'Alguien le dio like a tu comentario',
                    documento_id=comment.document_id,
                    comentario_id=comment.id,
                    from_user_id=current_user['user_id']
                )
        
        db.session.commit()
        
        return jsonify({
            'message': f'Comentario {action}',
            'liked': action == 'liked',
            'likes_count': comment.likes_count
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error con like del comentario: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

# =============================================================================
# RUTAS DE NOTIFICACIONES
# =============================================================================

@app.route('/api/v1/notifications', methods=['GET'])
def get_notifications():
    """Obtener notificaciones del usuario"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        # Parámetros de paginación
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        unread_only = request.args.get('unread_only', 'false').lower() == 'true'
        
        # Construir query
        query = Notification.query.filter_by(user_id=current_user['user_id'])
        
        if unread_only:
            query = query.filter_by(is_read=False)
        
        query = query.order_by(Notification.created_at.desc())
        
        # Paginar
        notifications = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        return jsonify({
            'notifications': [notif.to_dict() for notif in notifications.items],
            'total': notifications.total,
            'pages': notifications.pages,
            'current_page': page,
            'unread_count': Notification.query.filter_by(
                user_id=current_user['user_id'],
                is_read=False
            ).count()
        })
        
    except Exception as e:
        logger.error(f'Error obteniendo notificaciones: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/notifications/<int:notification_id>/read', methods=['POST'])
def mark_notification_read(notification_id):
    """Marcar notificación como leída"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        notification = Notification.query.filter_by(
            id=notification_id,
            user_id=current_user['user_id']
        ).first()
        
        if not notification:
            return jsonify({'error': 'Notificación no encontrada'}), 404
        
        notification.is_read = True
        db.session.commit()
        
        return jsonify({'message': 'Notificación marcada como leída'})
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error marcando notificación como leída: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/v1/notifications/read-all', methods=['POST'])
def mark_all_notifications_read():
    """Marcar todas las notificaciones como leídas"""
    try:
        # Verificar autenticación
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401
        
        Notification.query.filter_by(
            user_id=current_user['user_id'],
            is_read=False
        ).update({'is_read': True})
        
        db.session.commit()
        
        return jsonify({'message': 'Todas las notificaciones marcadas como leídas'})
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error marcando todas las notificaciones como leídas: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

# =============================================================================
# RUTAS DE ESTADÍSTICAS
# =============================================================================

@app.route('/api/v1/comments/stats', methods=['GET'])
def get_comments_stats():
    """Obtener estadísticas de comentarios"""
    try:
        # Estadísticas generales
        total_comments = Comment.query.filter_by(is_deleted=False).count()
        total_likes = CommentLike.query.count()
        
        # Comentarios por documento (top 10)
        document_stats = db.session.query(
            Comment.document_id,
            db.func.count(Comment.id).label('comment_count')
        ).filter_by(is_deleted=False).group_by(
            Comment.document_id
        ).order_by(
            db.func.count(Comment.id).desc()
        ).limit(10).all()
        
        return jsonify({
            'total_comments': total_comments,
            'total_likes': total_likes,
            'top_documents': [
                {'document_id': doc_id, 'comment_count': count}
                for doc_id, count in document_stats
            ]
        })
        
    except Exception as e:
        logger.error(f'Error obteniendo estadísticas de comentarios: {str(e)}')
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
    
    port = int(os.getenv('PORT', 5004))
    host = os.getenv('HOST', '0.0.0.0')
    debug = os.getenv('FLASK_ENV') == 'development'
    
    logger.info(f'Iniciando Comments Service en {host}:{port}')
    app.run(host=host, port=port, debug=debug)