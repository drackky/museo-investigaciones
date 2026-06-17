pipeline {
    agent any

    environment {
        VENV = "${WORKSPACE}\\.venv"
        FLASK_ENV = 'testing'
        JWT_SECRET_KEY = 'test-secret-key'
        DB_HOST = 'localhost'
        DB_USER = 'root'
        DB_PASSWORD = 'root'
        AUTH_DB_NAME = 'museum_auth_db'
        DOCUMENTS_DB_NAME = 'museum_docs_db'
        COLLECTIONS_DB_NAME = 'museum_collections_db'
        COMMENTS_DB_NAME = 'museum_comments_db'
        RESEARCH_DB_NAME = 'museum_research_db'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Setup Python') {
            steps {
                bat 'python -m venv %VENV%'
                bat '%VENV%\\Scripts\\python -m pip install --upgrade pip'
                bat '%VENV%\\Scripts\\pip install wheel setuptools pytest-html'
            }
        }

        stage('Install Dependencies') {
            parallel {
                stage('API Gateway') {
                    steps {
                        dir('api-gateway') {
                            bat '%VENV%\\Scripts\\pip install -r requirements.txt'
                        }
                    }
                }
                stage('Auth Service') {
                    steps {
                        dir('auth-service') {
                            bat '%VENV%\\Scripts\\pip install -r requirements.txt'
                        }
                    }
                }
                stage('Documents Service') {
                    steps {
                        dir('documents-service') {
                            bat '%VENV%\\Scripts\\pip install -r requirements.txt'
                        }
                    }
                }
                stage('Collections Service') {
                    steps {
                        dir('collections-service') {
                            bat '%VENV%\\Scripts\\pip install -r requirements.txt'
                        }
                    }
                }
                stage('Comments Service') {
                    steps {
                        dir('comments-service') {
                            bat '%VENV%\\Scripts\\pip install -r requirements.txt'
                        }
                    }
                }
                stage('Research Service') {
                    steps {
                        dir('research-service') {
                            bat '%VENV%\\Scripts\\pip install -r requirements.txt'
                        }
                    }
                }
                stage('Frontend') {
                    steps {
                        dir('frontend') {
                            bat 'npm install'
                        }
                    }
                }
            }
        }

        stage('Run Tests') {
            steps {
                bat '%VENV%\\Scripts\\pytest "pruebas de caja blanca\\test_caja_blanca.py" "pruebas de caja negra\\test_caja_negra.py" --junitxml=reporte_junit.xml --html=reporte_pruebas.html --self-contained-html -v'
            }
            post {
                always {
                    junit 'reporte_junit.xml'
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: '.',
                        reportFiles: 'reporte_pruebas.html',
                        reportName: 'Reporte de Pruebas'
                    ])
                }
            }
        }

        stage('Build Frontend') {
            steps {
                dir('frontend') {
                    bat 'npm run build'
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            archiveArtifacts artifacts: 'frontend/dist/**', fingerprint: true
            echo 'Build completado exitosamente'
        }
        failure {
            echo 'Build fallido'
        }
    }
}
}
