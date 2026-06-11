# Script para ejecutar las pruebas de caja negra fácilmente en Windows
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "🏛️  Iniciador de Pruebas de Caja Negra - Plataforma Museo" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# Determinar ruta de la raíz y del entorno virtual
$RaizProyecto = Resolve-Path "$PSScriptRoot\.."
$VenvPath = "$RaizProyecto\.venv"

if (Test-Path "$VenvPath\Scripts\Activate.ps1") {
    Write-Host "`n[+] Activando el entorno virtual del proyecto..." -ForegroundColor Yellow
    & "$VenvPath\Scripts\Activate.ps1"
} else {
    Write-Host "`n[!] Entorno virtual no encontrado en $VenvPath. Se usará el Python del sistema." -ForegroundColor DarkYellow
}

Write-Host "[+] Ejecutando las pruebas de caja negra..." -ForegroundColor Yellow
python "$PSScriptRoot\test_caja_negra.py"

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "Pruebas finalizadas." -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Cyan
