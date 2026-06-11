import unittest
import sys
import os
from datetime import datetime, timedelta
import jwt

# Configuramos variables de entorno ficticias antes de importar para evitar que busque servicios reales
os.environ["DB_HOST"] = "localhost"
os.environ["DB_USER"] = "root"
os.environ["DB_PASSWORD"] = "root"
os.environ["DB_NAME"] = "test_db"
os.environ["JWT_SECRET_KEY"] = "clave-secreta-de-prueba-caja-blanca"

# Agregamos la ruta del microservicio 'auth-service' al system path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "auth-service")))

# Importamos las utilidades internas, modelos y el cliente de Flask desde app.py
try:
    from app import app, db, User, validate_email, validate_password, generate_token, verify_token
except ImportError as e:
    print(f"[ERROR] No se pudo importar de auth-service/app.py: {e}")
    print("Asegurate de que las dependencias de auth-service estén instaladas en tu entorno virtual.")
    sys.exit(1)

from unittest.mock import patch, MagicMock

class TestCajaBlancaAuthService(unittest.TestCase):
    """
    Suite de Pruebas de Caja Blanca para el Auth Service.
    Estas pruebas se enfocan en evaluar la estructura lógica del código interno,
    cobertura de bifurcaciones (if-else), manejo de excepciones y serialización de modelos.
    """

    def setUp(self):
        # Configuramos un cliente de prueba de Flask para simular llamadas HTTP internas
        self.client = app.test_client()
        app.config["TESTING"] = True
        app.config["SECRET_KEY"] = "clave-secreta-de-prueba-caja-blanca"

    # =========================================================================
    # 1. COBERTURA DE BIFURCACIONES: VALIDACIÓN DE EMAIL (validate_email)
    # =========================================================================

    def test_01_cobertura_validate_email(self):
        """
        Prueba de Caja Blanca: validación de correos electrónicos.
        Verifica el comportamiento de la expresión regular interna ante distintos caminos de entrada.
        """
        # Caminos válidos (debe retornar True)
        self.assertTrue(validate_email("juan@museo.com"))
        self.assertTrue(validate_email("investigador.arqueologia@museo.gob.bo"))
        self.assertTrue(validate_email("user123@domain.org"))

        # Caminos inválidos (debe retornar False)
        self.assertFalse(validate_email("correo-sin-arroba.com"))
        self.assertFalse(validate_email("correo con espacios@museo.com"))
        self.assertFalse(validate_email("usuario@sin-dominio-tld."))
        self.assertFalse(validate_email("@sin-local.com"))
        self.assertFalse(validate_email("usuario@dominio@otro.com"))
        
        print("[PASO] Test 1 Pasado: Cobertura completa de la lógica de validación de email.")

    # =========================================================================
    # 2. COBERTURA DE BIFURCACIONES: VALIDACIÓN DE CONTRASEÑA (validate_password)
    # =========================================================================

    def test_02_cobertura_validate_password(self):
        """
        Prueba de Caja Blanca: validación de fortaleza de contraseñas.
        Esta prueba está diseñada para obligar al código a pasar por cada una
        de las bifurcaciones condicionales (If Statements) dentro de la función.
        """
        # Camino A: Contraseña menor a 8 caracteres (Bifurcación 1)
        valido, mensaje = validate_password("Short1")
        self.assertFalse(valido)
        self.assertEqual(mensaje, "La contraseña debe tener al menos 8 caracteres")

        # Camino B: Contraseña >= 8 caracteres, pero sin letras (Bifurcación 2)
        valido, mensaje = validate_password("1234567890")
        self.assertFalse(valido)
        self.assertEqual(mensaje, "La contraseña debe contener al menos una letra")

        # Camino C: Contraseña >= 8 caracteres y letras, pero sin números (Bifurcación 3)
        valido, mensaje = validate_password("abcdefghijk")
        self.assertFalse(valido)
        self.assertEqual(mensaje, "La contraseña debe contener al menos un número")

        # Camino D: Contraseña cumple con todas las condiciones
        valido, mensaje = validate_password("Password123")
        self.assertTrue(valido)
        self.assertEqual(mensaje, "Contraseña válida")
        
        print("[PASO] Test 2 Pasado: Cobertura de las 4 bifurcaciones de validación de contraseña.")

    # =========================================================================
    # 3. LÓGICA DE FIRMAS DE SEGURIDAD: TOKENS JWT (generate_token / verify_token)
    # =========================================================================

    def test_03_cobertura_jwt_logic(self):
        """
        Prueba de Caja Blanca: Generación y Validación de Tokens JWT.
        Valida que la lógica de cifrado firme adecuadamente los payloads y
        maneje las excepciones de firma inválida o expiración.
        """
        # Generar un token con ID de usuario 42
        user_id = 42
        token = generate_token(user_id=user_id, expires_in=3600)
        
        # Verificar que el token es una cadena y no está vacío
        self.assertIsInstance(token, str)
        self.assertTrue(len(token) > 0)

        # Camino A: Verificar un token válido y extraer el payload
        payload = verify_token(token)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["user_id"], user_id)

        # Camino B: Verificar un token corrupto / manipulado (InvalidTokenError)
        token_corrupto = token + "modificado"
        payload_corrupto = verify_token(token_corrupto)
        self.assertIsNone(payload_corrupto, "Un token manipulado debe retornar None en la verificación.")

        # Camino C: Verificar un token expirado (ExpiredSignatureError)
        # Generamos un token que expira en -10 segundos (ya expirado)
        token_expirado = generate_token(user_id=user_id, expires_in=-10)
        payload_expirado = verify_token(token_expirado)
        self.assertIsNone(payload_expirado, "Un token expirado debe retornar None en la verificación.")

        print("[PASO] Test 3 Pasado: Lógica de validación de firma y expiración de JWT probada con éxito.")

    # =========================================================================
    # 4. PRUEBA DE ESTRUCTURA: SERIALIZACIÓN DEL MODELO USER (User.to_dict)
    # =========================================================================

    def test_04_cobertura_model_to_dict(self):
        """
        Prueba de Caja Blanca: Serialización del modelo de datos User.
        Evalúa que el método to_dict() transforme adecuadamente la entidad en memoria,
        incluyendo el manejo de fechas nulas y campos especiales.
        """
        fecha_creacion = datetime(2026, 6, 1, 12, 0, 0)
        
        # Instanciamos el modelo User directamente en memoria (sin guardarlo en DB real)
        usuario = User(
            id=10,
            email="arqueologo@museo.com",
            nombre="Dra. Laura",
            rol="investigador",
            institucion="Universidad del Museo",
            avatar_url=None,
            is_active=True,
            email_verified=True,
            created_at=fecha_creacion,
            updated_at=None  # Para comprobar el manejo de fechas nulas
        )

        # Ejecutamos el método que queremos analizar
        res_dict = usuario.to_dict()

        # Aserciones estructurales
        self.assertEqual(res_dict["id"], 10)
        self.assertEqual(res_dict["email"], "arqueologo@museo.com")
        self.assertEqual(res_dict["nombre"], "Dra. Laura")
        self.assertEqual(res_dict["rol"], "investigador")
        self.assertEqual(res_dict["institucion"], "Universidad del Museo")
        self.assertIsNone(res_dict["avatar_url"])
        self.assertTrue(res_dict["is_active"])
        self.assertTrue(res_dict["email_verified"])
        
        # Comprobar formateador de fecha ISO
        self.assertEqual(res_dict["created_at"], "2026-06-01T12:00:00")
        self.assertIsNone(res_dict["updated_at"], "Una fecha nula debe formatearse como None sin levantar excepción.")

        print("[PASO] Test 4 Pasado: Serialización correcta de campos y manejo de nulos en User.to_dict.")

    # =========================================================================
    # 5. COBERTURA DE RUTA CON MOCKING: HEALTH CHECK (/health)
    # =========================================================================

    @patch("app.db.session.execute")
    def test_05_cobertura_health_check_paths(self, mock_execute):
        """
        Prueba de Caja Blanca con Mocking: Ruta /health.
        Aquí obligamos al flujo del código a pasar por dos caminos diferentes:
        1. Base de datos operativa (Retorna status healthy, 200).
        2. Base de datos caída (Lanza excepción, manejador try-except devuelve unhealthy, 500).
        """
        # --- Camino Exitoso (Database activa) ---
        # Configuramos el mock para que responda con éxito al ejecutar SELECT 1
        mock_execute.return_value = True

        response = self.client.get("/health")
        data = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["service"], "auth-service")

        # --- Camino de Fallo (Database inactiva) ---
        # Configuramos el mock para que lance una excepción (simulando caída de MySQL)
        mock_execute.side_effect = Exception("Conexión perdida con la base de datos")

        response = self.client.get("/health")
        data = response.get_json()

        self.assertEqual(response.status_code, 500)
        self.assertEqual(data["status"], "unhealthy")
        self.assertIn("Conexión perdida", data["error"])

        print("[PASO] Test 5 Pasado: Cobertura completa de la ruta /health (caminos exitoso y fallido).")

if __name__ == "__main__":
    print("\n=======================================================")
    print("EJECUTANDO PRUEBAS DE CAJA BLANCA - PLATAFORMA MUSEO")
    print("=======================================================")
    unittest.main()
