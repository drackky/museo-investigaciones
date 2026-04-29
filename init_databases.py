#!/usr/bin/env python3
"""
Script para inicializar las bases de datos del museo sin Docker
"""
import os
import sys
import pymysql
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

def create_databases():
    """Crear las bases de datos necesarias"""
    
    # Configuración de conexión
    config = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': int(os.getenv('DB_PORT', 3306)),
        'user': os.getenv('DB_USER', 'root'),
        'password': os.getenv('DB_PASSWORD', ''),
        'charset': 'utf8mb4'
    }
    
    # Lista de bases de datos a crear
    databases = [
        os.getenv('AUTH_DB_NAME', 'museum_auth_db'),
        os.getenv('DOCUMENTS_DB_NAME', 'museum_docs_db'),
        os.getenv('COLLECTIONS_DB_NAME', 'museum_collections_db'),
        os.getenv('COMMENTS_DB_NAME', 'museum_comments_db'),
        os.getenv('RESEARCH_DB_NAME', 'museum_research_db')
    ]
    
    try:
        # Conectar a MySQL
        print("🔌 Conectando a MySQL...")
        connection = pymysql.connect(**config)
        cursor = connection.cursor()
        
        # Crear cada base de datos
        for db_name in databases:
            print(f"📊 Creando base de datos: {db_name}")
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            print(f"✅ Base de datos {db_name} creada exitosamente")
        
        connection.commit()
        cursor.close()
        connection.close()
        
        print("\n🎉 ¡Todas las bases de datos han sido creadas exitosamente!")
        print("\n📋 Bases de datos creadas:")
        for db_name in databases:
            print(f"  - {db_name}")
            
    except pymysql.Error as e:
        print(f"❌ Error al conectar con MySQL: {e}")
        print("\n💡 Asegúrate de que:")
        print("  1. MySQL esté ejecutándose")
        print("  2. Las credenciales en .env sean correctas")
        print("  3. El usuario tenga permisos para crear bases de datos")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("🏛️  Inicializador de Bases de Datos del Museo")
    print("=" * 50)
    create_databases()