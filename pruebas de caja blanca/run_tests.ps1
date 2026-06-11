# Script para ejecutar las pruebas de caja blanca facilmente en Windows
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "[Test] Iniciador de Pruebas de Caja Blanca - Plataforma Museo" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# Determinar ruta de la raiz y del entorno virtual
$RaizProyecto = Resolve-Path "$PSScriptRoot\.."
$VenvPath = "$RaizProyecto\.venv"

if (Test-Path "$VenvPath\Scripts\Activate.ps1") {
    Write-Host "`n[+] Activando el entorno virtual del proyecto..." -ForegroundColor Yellow
    & "$VenvPath\Scripts\Activate.ps1"
} else {
    Write-Host "`n[!] Entorno virtual no encontrado en $VenvPath. Se usara el Python del sistema." -ForegroundColor DarkYellow
}

Write-Host "[+] Ejecutando las pruebas de caja blanca..." -ForegroundColor Yellow
python "$PSScriptRoot\test_caja_blanca.py"

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "Pruebas finalizadas." -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Cyan
