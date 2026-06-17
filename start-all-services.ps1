# Script para iniciar todos los servicios del proyecto
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Iniciando todos los servicios..." -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# Activar entorno virtual
Write-Host "`nActivando entorno virtual..." -ForegroundColor Yellow
& .\.venv\Scripts\Activate.ps1

# Función para iniciar un servicio en una nueva ventana
function Start-Service {
    param (
        [string]$ServiceName,
        [string]$ServicePath,
        [int]$Port
    )
    
    Write-Host "Iniciando $ServiceName en puerto $Port..." -ForegroundColor Green
    
    $command = "cd '$PSScriptRoot\$ServicePath'; & '$PSScriptRoot\.venv\Scripts\python.exe' app.py"
    
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $command -WindowStyle Normal
    
    Start-Sleep -Seconds 2
}

# Iniciar todos los servicios Python
Write-Host "`n--- Servicios Backend ---" -ForegroundColor Cyan
Start-Service "API Gateway" "api-gateway" 5000
Start-Service "Auth Service" "auth-service" 5001
Start-Service "Documents Service" "documents-service" 5002
Start-Service "Collections Service" "collections-service" 5003
Start-Service "Comments Service" "comments-service" 5004
Start-Service "Research Service" "research-service" 5005

# Iniciar frontend
Write-Host "`n--- Frontend ---" -ForegroundColor Cyan
Write-Host "Iniciando Frontend en puerto 3001..." -ForegroundColor Green

$frontendCommand = "cd '$PSScriptRoot\frontend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCommand -WindowStyle Normal

Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "Todos los servicios iniciados!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "`nServicios corriendo:" -ForegroundColor Yellow
Write-Host "  - API Gateway:          http://localhost:5000" -ForegroundColor White
Write-Host "  - Auth Service:         http://localhost:5001" -ForegroundColor White
Write-Host "  - Documents Service:    http://localhost:5002" -ForegroundColor White
Write-Host "  - Collections Service:  http://localhost:5003" -ForegroundColor White
Write-Host "  - Comments Service:     http://localhost:5004" -ForegroundColor White
Write-Host "  - Research Service:     http://localhost:5005" -ForegroundColor White
Write-Host "  - Frontend:             http://localhost:3001" -ForegroundColor White
Write-Host "`nPresiona Ctrl+C en cada ventana para detener los servicios" -ForegroundColor Gray
Write-Host "O cierra este script y todas las ventanas se cerrarán" -ForegroundColor Gray

# Mantener el script corriendo
Write-Host "`nPresiona cualquier tecla para detener todos los servicios..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Detener todos los procesos
Write-Host "`nDeteniendo servicios..." -ForegroundColor Red
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "Servicios detenidos." -ForegroundColor Green
