# Script para verificar la conectividad entre frontend y backend
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Verificando sincronización Frontend <-> Backend" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# Función para probar conectividad a un puerto
function Test-Port {
    param (
        [string]$Host,
        [int]$Port,
        [string]$ServiceName
    )
    
    try {
        $connection = Test-NetConnection -ComputerName $Host -Port $Port -WarningAction SilentlyContinue
        if ($connection.TcpTestSucceeded) {
            Write-Host "✓ $ServiceName ($Host`:$Port) - FUNCIONANDO" -ForegroundColor Green
            return $true
        } else {
            Write-Host "✗ $ServiceName ($Host`:$Port) - NO RESPONDE" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "✗ $ServiceName ($Host`:$Port) - ERROR: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Función para probar endpoint HTTP
function Test-Endpoint {
    param (
        [string]$Url,
        [string]$ServiceName
    )
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 10 -UseBasicParsing
        Write-Host "✓ $ServiceName ($Url) - HTTP $($response.StatusCode)" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "✗ $ServiceName ($Url) - ERROR: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

Write-Host "`n--- Verificando Puertos ---" -ForegroundColor Yellow

# Verificar puertos básicos
$services = @(
    @{Host="localhost"; Port=3001; Name="Frontend (React)"},
    @{Host="localhost"; Port=5000; Name="API Gateway"},
    @{Host="localhost"; Port=5001; Name="Auth Service"},
    @{Host="localhost"; Port=5002; Name="Documents Service"},
    @{Host="localhost"; Port=5003; Name="Collections Service"},
    @{Host="localhost"; Port=5004; Name="Comments Service"},
    @{Host="localhost"; Port=5005; Name="Research Service"},
    @{Host="localhost"; Port=3306; Name="MySQL Database"}
)

$runningServices = 0
foreach ($service in $services) {
    if (Test-Port -Host $service.Host -Port $service.Port -ServiceName $service.Name) {
        $runningServices++
    }
}

Write-Host "`n--- Verificando Endpoints HTTP ---" -ForegroundColor Yellow

# Verificar endpoints
$endpoints = @(
    @{Url="http://localhost:3001"; Name="Frontend"},
    @{Url="http://localhost:5000/health"; Name="API Gateway Health"},
    @{Url="http://localhost:5000"; Name="API Gateway Info"}
)

$workingEndpoints = 0
foreach ($endpoint in $endpoints) {
    if (Test-Endpoint -Url $endpoint.Url -ServiceName $endpoint.Name) {
        $workingEndpoints++
    }
}

Write-Host "`n--- Resumen ---" -ForegroundColor Cyan
Write-Host "Servicios corriendo: $runningServices / $($services.Count)" -ForegroundColor $(if ($runningServices -eq $services.Count) { "Green" } else { "Yellow" })
Write-Host "Endpoints funcionando: $workingEndpoints / $($endpoints.Count)" -ForegroundColor $(if ($workingEndpoints -eq $endpoints.Count) { "Green" } else { "Yellow" })

Write-Host "`n--- Configuración CORS ---" -ForegroundColor Yellow
Write-Host "Frontend URL: http://localhost:3001" -ForegroundColor White
Write-Host "API Gateway URL: http://localhost:5000" -ForegroundColor White
Write-Host "CORS configurado para: http://localhost:3000, http://localhost:3001, http://localhost:5000" -ForegroundColor White

Write-Host "`n--- URLs de Acceso ---" -ForegroundColor Cyan
Write-Host "🌐 Frontend:     http://localhost:3001" -ForegroundColor Green
Write-Host "🔧 API Gateway:  http://localhost:5000" -ForegroundColor Green
Write-Host "📊 Health Check: http://localhost:5000/health" -ForegroundColor Green

if ($runningServices -lt $services.Count) {
    Write-Host "`n⚠️ Para iniciar todos los servicios, ejecuta:" -ForegroundColor Yellow
    Write-Host "   .\start-all-services.ps1" -ForegroundColor White
}

Write-Host "`n==================================" -ForegroundColor Cyan