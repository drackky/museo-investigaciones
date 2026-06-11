import unittest
import requests
import json

# URL base por defecto (Apuntando al API Gateway que unifica los servicios)
BASE_URL = "http://localhost:5000/api/v1"

class TestCajaNegraPlataformaMuseo(unittest.TestCase):
    """
    Suite de Pruebas de Caja Negra a nivel de desarrollador Junior.
    Estas pruebas envian peticiones HTTP reales al sistema y verifican
    que la respuesta sea la correcta segun los requerimientos del negocio.
    """

    @classmethod
    def setUpClass(cls):
        """
        Este metodo se ejecuta UNA sola vez antes de todas las pruebas.
        Verifica si el servidor de la API esta activo para dar un mensaje claro
        si los microservicios no estan encendidos.
        """
        print("\n[INFO] Verificando si los servicios estan activos en el puerto 5000...")
        try:
            # Intentamos hacer una peticion rapida al endpoint publico de documentos
            requests.get(f"{BASE_URL}/documents", timeout=2)
            print("[OK] Servicios detectados en ejecucion! Iniciando pruebas de caja negra...\n")
        except requests.exceptions.ConnectionError:
            print("\n[ERROR DE CONEXION] No se pudo conectar con el API Gateway en http://localhost:5000.")
            print("AYUDA: Por favor, asegurate de levantar los servicios ejecutando:")
            print("   .\\start-all-services.ps1")
            print("   en una terminal de PowerShell antes de ejecutar estas pruebas.")
            print("=" * 60)
            raise unittest.SkipTest("Servidores apagados. Saltando suite de pruebas de caja negra.")

    # =========================================================================
    # PRUEBAS DE AUTENTICACION (Auth Service via API Gateway)
    # =========================================================================

    def test_01_login_exitoso(self):
        """
        [Caja Negra] Login Exitoso.
        Entrada: Credenciales correctas de un usuario registrado.
        Salida Esperada: Codigo 200 OK, un token JWT y datos de perfil del usuario.
        """
        url = f"{BASE_URL}/auth/login"
        payload = {
            "email": "test@museo.com",
            "password": "Password123"
        }
        headers = {"Content-Type": "application/json"}

        # Realizamos la peticion HTTP real (hacia la 'caja negra')
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()

        # Comprobamos los resultados
        self.assertEqual(response.status_code, 200, "El login exitoso deberia devolver un estado 200 OK.")
        self.assertIn("token", data, "La respuesta deberia incluir la propiedad 'token' con el JWT.")
        self.assertIn("user", data, "La respuesta deberia incluir la informacion de usuario en 'user'.")
        self.assertEqual(data["user"]["email"], "test@museo.com", "El correo devuelto debe coincidir con el consultado.")
        
        print("[PASO] Test 1 Pasado: El login responde correctamente con el token JWT.")

    def test_02_login_credenciales_incorrectas(self):
        """
        [Caja Negra] Login con Contrasena Incorrecta.
        Entrada: Credenciales con contrasena erronea.
        Salida Esperada: Codigo 401 Unauthorized y mensaje de error 'Credenciales invalidas'.
        """
        url = f"{BASE_URL}/auth/login"
        payload = {
            "email": "test@museo.com",
            "password": "ClaveIncorrecta123"
        }
        headers = {"Content-Type": "application/json"}

        response = requests.post(url, json=payload, headers=headers)
        data = response.json()

        self.assertEqual(response.status_code, 401, "El login incorrecto deberia devolver 401 Unauthorized.")
        self.assertIn("error", data, "La respuesta de error deberia contener la propiedad 'error'.")
        self.assertEqual(data["error"], "Credenciales invalidas", "El mensaje de error deberia ser 'Credenciales invalidas'.")
        
        print("[PASO] Test 2 Pasado: El sistema bloquea el acceso con credenciales incorrectas y devuelve 401.")

    def test_03_registro_email_invalido(self):
        """
        [Caja Negra] Validacion de formato de email en Registro.
        Entrada: Datos de registro con un formato de email invalido (sin @ ni dominio).
        Salida Esperada: Codigo 400 Bad Request y mensaje 'Formato de email invalido'.
        """
        url = f"{BASE_URL}/auth/register"
        payload = {
            "nombre": "Usuario Invalido",
            "email": "correo-sin-formato-correcto",
            "password": "Password123"
        }
        headers = {"Content-Type": "application/json"}

        response = requests.post(url, json=payload, headers=headers)
        data = response.json()

        self.assertEqual(response.status_code, 400, "Un email mal formado deberia retornar 400 Bad Request.")
        self.assertIn("error", data, "Se esperaba un mensaje de error explicativo en 'error'.")
        self.assertEqual(data["error"], "Formato de email invalido", "El mensaje de error debe indicar el formato invalido.")
        
        print("[PASO] Test 3 Pasado: El registro valida correctamente el correo electronico.")

    # =========================================================================
    # PRUEBAS DE DOCUMENTOS (Documents Service)
    # =========================================================================

    def test_04_listar_documentos_publicos(self):
        """
        [Caja Negra] Listar documentos de forma publica.
        Entrada: Peticion GET sin autenticacion.
        Salida Esperada: Codigo 200 OK y estructura de lista paginada.
        """
        url = f"{BASE_URL}/documents"

        response = requests.get(url)
        data = response.json()

        self.assertEqual(response.status_code, 200, "Obtener documentos publicos deberia devolver 200 OK.")
        self.assertIn("documents", data, "La respuesta debe tener una lista de 'documents'.")
        self.assertIn("total", data, "La respuesta debe tener el campo 'total'.")
        self.assertIsInstance(data["documents"], list, "El campo 'documents' debe ser una lista.")
        
        # Validaciones de estructura de documentos si la lista no esta vacia
        if len(data["documents"]) > 0:
            primer_doc = data["documents"][0]
            self.assertIn("id", primer_doc, "Cada documento debe tener un 'id'.")
            self.assertIn("titulo", primer_doc, "Cada documento debe tener un 'titulo'.")
            self.assertIn("autor", primer_doc, "Cada documento debe tener un 'autor'.")
            self.assertTrue(primer_doc.get("is_publico", True), "Los documentos listados publicamente deben ser publicos.")
            
        print("[PASO] Test 4 Pasado: El listado publico de documentos responde y tiene la estructura correcta.")

    # =========================================================================
    # PRUEBAS DE COLECCIONES (Collections Service)
    # =========================================================================

    def test_05_crear_coleccion_sin_token(self):
        """
        [Caja Negra] Bloqueo de creacion de colecciones sin Token.
        Entrada: Peticion POST de creacion sin cabecera de autenticacion.
        Salida Esperada: Codigo 401 Unauthorized y mensaje de error de autenticacion.
        """
        url = f"{BASE_URL}/collections"
        payload = {
            "titulo": "Coleccion de Prueba Negra",
            "descripcion": "Coleccion creada a traves de test de caja negra"
        }
        headers = {"Content-Type": "application/json"}

        # Enviamos la peticion SIN cabecera de Authorization
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()

        self.assertEqual(response.status_code, 401, "No deberia permitirse crear colecciones sin autenticarse.")
        self.assertEqual(data["error"], "Autenticacion requerida", "El mensaje debe ser 'Autenticacion requerida'.")
        
        print("[PASO] Test 5 Pasado: El sistema rechaza correctamente la creacion de colecciones sin token JWT.")

if __name__ == "__main__":
    print("\n=======================================================")
    print("EJECUTANDO PRUEBAS DE CAJA NEGRA - PLATAFORMA MUSEO")
    print("=======================================================")
    unittest.main()
