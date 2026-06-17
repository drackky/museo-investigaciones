# 🏛️ Pruebas de Caja Negra (Black-Box Testing)

Este directorio contiene un conjunto de **pruebas de caja negra** diseñadas a nivel de **desarrollador junior**. Están orientadas a verificar el funcionamiento externo del sistema de investigaciones del museo sin conocer la implementación interna de los microservicios.

---

## 🧐 ¿Qué es una Prueba de Caja Negra?

En el desarrollo de software, una **prueba de caja negra** consiste en evaluar un sistema o componente **únicamente desde el exterior**, es decir:
1. **Entrada (Input):** Enviamos una petición HTTP real al sistema (por ejemplo, a través del API Gateway en `http://localhost:5000`).
2. **Proceso (Caja Negra):** No sabemos qué base de datos usa, qué librerías tiene instaladas, ni cómo está estructurado su código por dentro.
3. **Salida (Output):** Validamos que la respuesta recibida (código de estado HTTP, estructura JSON, mensajes de error) coincida exactamente con las especificaciones del negocio.

### 🔄 Diferencia con las Pruebas Unitarias de `test_museo.py`

| Característica | Pruebas Unitarias (Caja Blanca) | Pruebas de Caja Negra |
| :--- | :--- | :--- |
| **Enfoque** | Prueban funciones, clases y rutas internas mockeando dependencias. | Prueban el flujo de datos real a través de los puertos y servicios vivos. |
| **Dependencia** | No requieren que los servicios estén corriendo. | **Requieren que los microservicios estén activos** y respondiendo. |
| **Base de Datos** | Mockeada / En memoria. | Base de datos real del sistema. |
| **Herramientas** | `pytest`, `unittest.mock` | `requests` (peticiones HTTP reales), `unittest` |

---

## 🛠️ Requisitos Previos

Para ejecutar estas pruebas necesitas tener instalada la librería `requests`. Puedes instalarla fácilmente en tu entorno virtual:

```bash
# Con el entorno virtual activo:
pip install requests
```

---

## 🚀 Cómo Ejecutar las Pruebas

### Paso 1: Iniciar los Servicios del Proyecto
Asegúrate de que los microservicios estén en ejecución. Puedes levantarlos usando el script de PowerShell de la raíz del proyecto:
```powershell
.\start-all-services.ps1
```

### Paso 2: Ejecutar el Test de Caja Negra
Desde una nueva terminal, con el entorno virtual activo, navega a este directorio y ejecuta:
```bash
python test_caja_negra.py
```
O también puedes usar el script automatizado que hemos creado para ti:
```powershell
.\run_tests.ps1
```

---

## 📝 Cobertura de las Pruebas

Las pruebas están estructuradas para validar los escenarios más comunes del sistema:

1. **🔐 Servicio de Autenticación (`Auth Service` / `API Gateway`):**
   * **Login Exitoso:** Envía credenciales válidas y comprueba que se retorna un token JWT y los datos del usuario.
   * **Login Erróneo:** Envía una contraseña incorrecta y verifica que el sistema responde con `401 Unauthorized`.
   * **Registro con Email Inválido:** Comprueba la validación de correos mal formados, esperando un error `400 Bad Request`.

2. **📄 Servicio de Documentos (`Documents Service`):**
   * **Listar Documentos Públicos:** Valida que se obtenga una lista paginada y que la estructura contenga campos esenciales (`id`, `titulo`, `autor`, `is_publico`).

3. **🗂️ Servicio de Colecciones (`Collections Service`):**
   * **Creación sin Autenticación:** Verifica que el sistema impida la creación de colecciones si no se provee un token JWT válido (`401 Unauthorized`).

---

## 💡 Guía para Desarrolladores Junior
* **¿Quieres añadir una prueba?** Abre el archivo [test_caja_negra.py](file:///E:/proyecto%20integrador/integradorJAN-main/pruebas%20de%20caja%20negra/test_caja_negra.py) y sigue el patrón de las funciones existentes. Solo necesitas usar `requests.post()` o `requests.get()` y añadir tus aserciones con `self.assertEqual()`.
* **Manejo de Errores:** Las pruebas están diseñadas para no romperse abruptamente si el servidor está apagado; en su lugar, te darán un mensaje amigable indicándote qué hacer.
