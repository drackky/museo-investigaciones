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
                bat '%VENV%\\Scripts\\pip install --upgrade pip'
                bat '%VENV%\\Scripts\\pip install wheel setuptools'
                bat '%VENV%\\Scripts\\pip install pytest-html'
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
            parallel {
                stage('Caja Blanca') {
                    steps {
                        dir('pruebas de caja blanca') {
                            bat '%VENV%\\Scripts\\pytest test_caja_blanca.py --junitxml=report-caja-blanca.xml -v'
                        }
                    }
                    post {
                        always {
                            junit 'pruebas de caja blanca/report-caja-blanca.xml'
                        }
                    }
                }
                stage('Caja Negra') {
                    steps {
                        dir('pruebas de caja negra') {
                            bat '%VENV%\\Scripts\\pytest test_caja_negra.py --junitxml=report-caja-negra.xml -v'
                        }
                    }
                    post {
                        always {
                            junit 'pruebas de caja negra/report-caja-negra.xml'
                        }
                    }
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
    stage('Generar Reporte') {
    steps {
        bat '%VENV%\\Scripts\\pytest "pruebas de caja blanca\\test_caja_blanca.py" "pruebas de caja negra\\test_caja_negra.py" --html=reporte_pruebas.html --self-contained-html -v'
    }
    post {
        always {
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

    post {
        always {
            cleanWs()
        }
        success {
            archiveArtifacts artifacts: 'frontend/dist/**', fingerprint: true
            echo 'Build completado exitosamente'
        }
        failure {
            emailext(
                to: 'team@museo.edu',
                subject: "Build fallido: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: "El build ha fallado.\n\nRevisa los detalles en: ${env.BUILD_URL}\n\nChangeset: ${env.CHANGE_ID ?: 'N/A'}"
            )
        }
    }
}
