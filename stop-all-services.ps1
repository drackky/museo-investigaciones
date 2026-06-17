# Script para detener todos los servicios del proyecto

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Deteniendo todos los servicios..." -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# Detener procesos Python
Write-Host "`nDeteniendo servicios Python..." -ForegroundColor Yellow
$pythonProcesses = Get-Process python -ErrorAction SilentlyContinue
if ($pythonProcesses) {
    $pythonProcesses | Stop-Process -Force
    Write-Host "  ✓ Servicios Python detenidos ($($pythonProcesses.Count) procesos)" -ForegroundColor Green
} else {
    Write-Host "  - No hay servicios Python corriendo" -ForegroundColor Gray
}

# Detener procesos Node
Write-Host "`nDeteniendo Frontend (Node.js)..." -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "  ✓ Frontend detenido ($($nodeProcesses.Count) procesos)" -ForegroundColor Green
} else {
    Write-Host "  - No hay procesos Node corriendo" -ForegroundColor Gray
}

Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "Todos los servicios detenidos!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan

Start-Sleep -Seconds 2
