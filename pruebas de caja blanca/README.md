# 🔍 Pruebas de Caja Blanca (White-Box Testing)

Este directorio contiene un conjunto de **pruebas de caja blanca** diseñadas a nivel de **desarrollador junior**. Están orientadas a verificar la estructura y lógica interna de las funciones, algoritmos y rutas del microservicio de autenticación (`Auth Service`).

---

## 🧐 ¿Qué es una Prueba de Caja Blanca?

A diferencia de las pruebas de caja negra (donde solo evaluamos entradas y salidas externas), en las **pruebas de caja blanca** tenemos **visibilidad absoluta del código fuente interno**. 

Diseñamos estas pruebas con los siguientes objetivos:
1. **Cobertura de Código (Code Coverage):** Asegurar que cada línea, decisión y bifurcación (bloques `if`, `else`, `try-except`) sea ejecutada y comprobada al menos una vez.
2. **Pruebas de Componentes Internos:** Probar funciones individuales, validadores y métodos de clase de forma aislada.
3. **Uso de Mocks:** Reemplazar dependencias externas complejas (como conexiones a bases de datos reales en MySQL o peticiones de red) utilizando simulaciones controladas (`unittest.mock`), permitiendo aislar el código que realmente queremos evaluar.

### 🔄 Comparación de Estrategias en este Proyecto

| Característica | Pruebas de Caja Negra | Pruebas de Caja Blanca |
| :--- | :--- | :--- |
| **Visibilidad del Código** | Ninguna. Se interactúa a través de llamadas HTTP. | Total. Se analizan expresiones regulares, flujos `if/else`, etc. |
| **Aislamiento** | Prueba la integración de todo el sistema (Base de datos + API + Gateway). | Prueba componentes unitarios de forma aislada e independiente. |
| **Velocidad de Ejecución** | Lenta (depende de la red y respuestas del servidor). | Extremadamente rápida (milisegundos, se ejecuta todo en memoria). |
| **Dependencia del Servidor** | **Requiere** que todos los servicios estén corriendo. | **No requiere** ningún servicio activo ni base de datos real. |

---

## 🛠️ Requisitos Previos

Estas pruebas utilizan la biblioteca estándar de Python (`unittest`) y el framework Flask de tu proyecto. Asegúrate de tener activo tu entorno virtual:

```bash
# Activar entorno virtual en Windows:
..\.venv\Scripts\Activate.ps1
```

---

## 🚀 Cómo Ejecutar las Pruebas

Puedes ejecutar la suite de pruebas desde una consola con el entorno virtual activo ejecutando:
```bash
python test_caja_blanca.py
```
O de forma automática con el script PowerShell que hemos preparado:
```powershell
.\run_tests.ps1
```

---

## 📝 Lógica Interna Comprobada (Cobertura de Estructura)

Las pruebas están estructuradas para validar detalladamente las siguientes partes de `auth-service/app.py`:

1. **📧 Validador de Correo (`validate_email`):**
   * Cobertura de formatos correctos (`usuario@dominio.com`, `user.name@sub.domain.co`).
   * Cobertura de casos erróneos (sin `@`, con espacios, sin dominio de nivel superior, etc.).

2. **🔑 Validador de Fortaleza de Contraseñas (`validate_password`):**
   * **Rama 1:** Contraseñas de menos de 8 caracteres (ej: `Short1`).
   * **Rama 2:** Contraseñas sin letras (ej: `12345678`).
   * **Rama 3:** Contraseñas sin números (ej: `abcdefgh`).
   * **Rama 4:** Contraseñas 100% válidas (ej: `Password123`).

3. **🎟️ Generación y Validación de JWT (`generate_token` / `verify_token`):**
   * Generación correcta de firmas usando claves secretas mockeadas.
   * Descifrado y verificación de datos contenidos en el payload (`user_id`).
   * Manejo de firmas corruptas o tokens manipulados (asegurando el retorno de `None`).

4. **👥 Serialización de Modelos de Base de Datos (`User.to_dict`):**
   * Creación de una instancia de la clase `User` en memoria.
   * Conversión a diccionario e inspección del correcto formateo de fechas ISO y campos sanitizados.

5. **🏥 Ruta de Diagnóstico (`/health`):**
   * **Caso Exitoso:** Se simula (`mock`) que la conexión a la base de datos funciona y se verifica el JSON de salud.
   * **Caso de Fallo:** Se simula un error de conexión SQL y se comprueba que el manejador `try-except` interno responda adecuadamente con código `500 Unhealthy` sin colapsar la aplicación.
