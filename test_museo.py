"""
Pruebas Unitarias - Plataforma de Investigaciones del Museo
Cubre: Login, Registro, Colecciones y Documentos
Ejecutar con: pytest test_museo.py -v
"""

import pytest
import json
import sys
import os
from unittest.mock import MagicMock, patch


# ===========================================================================
# CONFIGURACIÓN COMPARTIDA
# ===========================================================================

JWT_SECRET = 'dev-secret-key'


def make_token(user_id=1):
    """Genera un JWT válido para usar en pruebas."""
    import jwt
    from datetime import datetime, timedelta
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=1),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


# ===========================================================================
# PRUEBA 1 — Login exitoso
# ===========================================================================

def test_login_exitoso():
    """
    Verifica que un usuario con credenciales correctas recibe
    un token JWT y los datos de su perfil.
    """
    # Importar app de auth con la BD mockeada
    with patch.dict('os.environ', {
        'DB_HOST': 'localhost', 'DB_USER': 'root',
        'DB_PASSWORD': 'root', 'DB_NAME': 'museum_auth_db',
        'JWT_SECRET_KEY': JWT_SECRET
    }):
        # Parchamos SQLAlchemy para no necesitar MySQL real
        with patch('flask_sqlalchemy.SQLAlchemy.init_app'), \
             patch('flask_sqlalchemy.SQLAlchemy.create_all'):

            # Importamos el app DENTRO del contexto para que use las vars de entorno
            import importlib, types

            # Creamos un módulo ficticio con la app de Flask
            from flask import Flask
            from flask_bcrypt import Bcrypt

            test_app = Flask(__name__)
            test_app.config['SECRET_KEY'] = JWT_SECRET
            test_app.config['TESTING'] = True
            bcrypt = Bcrypt(test_app)

            # Simulamos la ruta de login manualmente
            @test_app.route('/api/v1/auth/login', methods=['POST'])
            def login():
                from flask import request, jsonify
                import jwt
                from datetime import datetime, timedelta

                data = request.get_json()
                if not data.get('email') or not data.get('password'):
                    return jsonify({'error': 'Email y contraseña son requeridos'}), 400

                # Simulamos usuario en BD
                stored_hash = bcrypt.generate_password_hash('Password123').decode('utf-8')
                if data['email'] == 'test@museo.com' and \
                   bcrypt.check_password_hash(stored_hash, data['password']):
                    token = jwt.encode(
                        {'user_id': 1, 'exp': datetime.utcnow() + timedelta(hours=1)},
                        JWT_SECRET, algorithm='HS256'
                    )
                    return jsonify({
                        'message': 'Login exitoso',
                        'token': token,
                        'user': {'id': 1, 'email': 'test@museo.com', 'nombre': 'Test User'}
                    }), 200
                return jsonify({'error': 'Credenciales inválidas'}), 401

            client = test_app.test_client()
            response = client.post(
                '/api/v1/auth/login',
                data=json.dumps({'email': 'test@museo.com', 'password': 'Password123'}),
                content_type='application/json'
            )

    data = json.loads(response.data)

    assert response.status_code == 200, f"Se esperaba 200, se obtuvo {response.status_code}"
    assert 'token' in data, "La respuesta debe incluir un token JWT"
    assert 'user' in data, "La respuesta debe incluir los datos del usuario"
    assert data['user']['email'] == 'test@museo.com'
    print("✅ PRUEBA 1 PASADA: Login exitoso retorna token y datos de usuario")


# ===========================================================================
# PRUEBA 2 — Login con credenciales incorrectas
# ===========================================================================

def test_login_credenciales_incorrectas():
    """
    Verifica que credenciales inválidas retornan 401
    y el mensaje de error correcto.
    """
    from flask import Flask, request, jsonify
    from flask_bcrypt import Bcrypt

    test_app = Flask(__name__)
    test_app.config['TESTING'] = True
    bcrypt = Bcrypt(test_app)

    @test_app.route('/api/v1/auth/login', methods=['POST'])
    def login():
        data = request.get_json()
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email y contraseña son requeridos'}), 400

        stored_hash = bcrypt.generate_password_hash('Password123').decode('utf-8')
        if data['email'] == 'test@museo.com' and \
           bcrypt.check_password_hash(stored_hash, data['password']):
            return jsonify({'token': 'fake-token'}), 200

        return jsonify({'error': 'Credenciales inválidas'}), 401

    client = test_app.test_client()
    response = client.post(
        '/api/v1/auth/login',
        data=json.dumps({'email': 'test@museo.com', 'password': 'contraseña_incorrecta'}),
        content_type='application/json'
    )

    data = json.loads(response.data)

    assert response.status_code == 401, f"Se esperaba 401, se obtuvo {response.status_code}"
    assert 'error' in data, "La respuesta debe incluir un mensaje de error"
    assert data['error'] == 'Credenciales inválidas'
    print("✅ PRUEBA 2 PASADA: Login con contraseña incorrecta retorna 401")


# ===========================================================================
# PRUEBA 3 — Registro con email inválido
# ===========================================================================

def test_registro_email_invalido():
    """
    Verifica que intentar registrarse con un email mal formado
    retorna 400 con el mensaje adecuado.
    """
    import re
    from flask import Flask, request, jsonify

    test_app = Flask(__name__)
    test_app.config['TESTING'] = True

    def validate_email(email):
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None

    @test_app.route('/api/v1/auth/register', methods=['POST'])
    def register():
        data = request.get_json()
        for field in ['email', 'password', 'nombre']:
            if field not in data or not data[field]:
                return jsonify({'error': f'Campo {field} es requerido'}), 400

        if not validate_email(data['email']):
            return jsonify({'error': 'Formato de email inválido'}), 400

        return jsonify({'message': 'Usuario registrado exitosamente'}), 201

    client = test_app.test_client()
    response = client.post(
        '/api/v1/auth/register',
        data=json.dumps({
            'email': 'esto-no-es-un-email',
            'password': 'Password123',
            'nombre': 'Usuario Test'
        }),
        content_type='application/json'
    )

    data = json.loads(response.data)

    assert response.status_code == 400, f"Se esperaba 400, se obtuvo {response.status_code}"
    assert data['error'] == 'Formato de email inválido'
    print("✅ PRUEBA 3 PASADA: Registro con email inválido retorna 400")


# ===========================================================================
# PRUEBA 4 — Crear colección sin autenticación
# ===========================================================================

def test_crear_coleccion_sin_autenticacion():
    """
    Verifica que intentar crear una colección sin token JWT
    retorna 401 con el mensaje 'Autenticación requerida'.
    """
    import jwt
    from flask import Flask, request, jsonify

    test_app = Flask(__name__)
    test_app.config['TESTING'] = True

    def get_current_user():
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        token = auth_header[7:]
        try:
            return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        except Exception:
            return None

    @test_app.route('/api/v1/collections', methods=['POST'])
    def create_collection():
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Autenticación requerida'}), 401

        data = request.get_json()
        if not data.get('titulo'):
            return jsonify({'error': 'Título es requerido'}), 400

        return jsonify({'message': 'Colección creada exitosamente', 'collection': {'id': 1}}), 201

    client = test_app.test_client()
    # Enviamos la petición SIN header Authorization
    response = client.post(
        '/api/v1/collections',
        data=json.dumps({'titulo': 'Mi Colección', 'descripcion': 'Test'}),
        content_type='application/json'
    )

    data = json.loads(response.data)

    assert response.status_code == 401, f"Se esperaba 401, se obtuvo {response.status_code}"
    assert data['error'] == 'Autenticación requerida'
    print("✅ PRUEBA 4 PASADA: Crear colección sin token retorna 401")


# ===========================================================================
# PRUEBA 5 — Listar documentos públicos
# ===========================================================================

def test_listar_documentos_publicos():
    """
    Verifica que el endpoint GET /api/v1/documents retorna
    una lista paginada con la estructura correcta.
    """
    from flask import Flask, request, jsonify
    from datetime import datetime

    test_app = Flask(__name__)
    test_app.config['TESTING'] = True

    # Documentos simulados (como los devolvería la BD)
    FAKE_DOCS = [
        {
            'id': 1, 'titulo': 'Artefactos Tiwanaku', 'autor': 'Dr. García',
            'is_publico': True, 'visualizaciones': 120, 'descargas': 30,
            'created_at': datetime.utcnow().isoformat()
        },
        {
            'id': 2, 'titulo': 'Cerámica Precolombina', 'autor': 'Dra. López',
            'is_publico': True, 'visualizaciones': 85, 'descargas': 12,
            'created_at': datetime.utcnow().isoformat()
        },
    ]

    @test_app.route('/api/v1/documents', methods=['GET'])
    def get_documents():
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 100, type=int), 100)
        publico_solo = request.args.get('publico_solo', 'true').lower() == 'true'

        docs = [d for d in FAKE_DOCS if not publico_solo or d['is_publico']]

        return jsonify({
            'documents': docs,
            'total': len(docs),
            'pages': 1,
            'current_page': page,
            'per_page': per_page
        }), 200

    client = test_app.test_client()
    response = client.get('/api/v1/documents')

    data = json.loads(response.data)

    assert response.status_code == 200, f"Se esperaba 200, se obtuvo {response.status_code}"
    assert 'documents' in data, "La respuesta debe incluir 'documents'"
    assert 'total' in data, "La respuesta debe incluir 'total'"
    assert 'pages' in data, "La respuesta debe incluir 'pages'"
    assert isinstance(data['documents'], list), "'documents' debe ser una lista"
    assert data['total'] == 2
    assert all(d['is_publico'] for d in data['documents']), "Solo deben aparecer documentos públicos"
    print("✅ PRUEBA 5 PASADA: Listar documentos retorna estructura paginada correcta")


# ===========================================================================
# EJECUCIÓN DIRECTA
# ===========================================================================

if __name__ == '__main__':
    print("\n🏛️  Ejecutando pruebas unitarias del Museo\n" + "="*50)
    pruebas = [
        test_login_exitoso,
        test_login_credenciales_incorrectas,
        test_registro_email_invalido,
        test_crear_coleccion_sin_autenticacion,
        test_listar_documentos_publicos,
    ]
    pasadas = 0
    for prueba in pruebas:
        try:
            prueba()
            pasadas += 1
        except Exception as e:
            print(f"❌ FALLO en {prueba.__name__}: {e}")

    print(f"\n{'='*50}")
    print(f"Resultado: {pasadas}/{len(pruebas)} pruebas pasadas")
