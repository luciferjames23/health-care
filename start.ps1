<#
.SYNOPSIS
    Healthcare Platform - Unified PowerShell Startup Launcher
.DESCRIPTION
    Launches both FastAPI backend and Vite frontend with dependency checks,
    environment activation, port validation, and dedicated logging windows.
#>

$rootDir = $PSScriptRoot
$backendDir = Join-Path $rootDir "backend"
$frontendDir = Join-Path $rootDir "frontend"

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "            Healthcare Unified Platform - Startup Launcher" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Backend environment check
Write-Host "[1/4] Checking Backend Python Environment..." -ForegroundColor Yellow
$activateScript = $null
if (Test-Path (Join-Path $backendDir "venv\Scripts\activate.bat")) {
    $activateScript = Join-Path $backendDir "venv\Scripts\activate.bat"
    Write-Host "      [OK] Found virtual environment in backend\venv" -ForegroundColor Green
} elseif (Test-Path (Join-Path $backendDir ".venv\Scripts\activate.bat")) {
    $activateScript = Join-Path $backendDir ".venv\Scripts\activate.bat"
    Write-Host "      [OK] Found virtual environment in backend\.venv" -ForegroundColor Green
} else {
    Write-Host "      [!] Creating new virtual environment in backend\.venv..." -ForegroundColor Yellow
    Push-Location $backendDir
    python -m venv .venv
    $activateScript = Join-Path $backendDir ".venv\Scripts\activate.bat"
    & "$activateScript"
    pip install -r requirements.txt
    Pop-Location
}

# 2. Frontend dependencies check
Write-Host "[2/4] Checking Frontend Node Dependencies..." -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Host "      [!] node_modules missing. Running npm install..." -ForegroundColor Yellow
    Push-Location $frontendDir
    npm install
    Pop-Location
} else {
    Write-Host "      [OK] Found node_modules in frontend\" -ForegroundColor Green
}

# 3. Port availability check
Write-Host "[3/4] Verifying Ports (8000, 5173)..." -ForegroundColor Yellow
$port8000InUse = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($port8000InUse) {
    Write-Host "      [WARNING] Port 8000 is already in use by PID $($port8000InUse.OwningProcess[0])" -ForegroundColor Red
}
$port5173InUse = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($port5173InUse) {
    Write-Host "      [WARNING] Port 5173 is already in use by PID $($port5173InUse.OwningProcess[0])" -ForegroundColor Red
}

# 4. Launch Services
Write-Host "[4/4] Starting Services..." -ForegroundColor Yellow
Write-Host "Starting Backend (FastAPI / Uvicorn on http://127.0.0.1:8000)..." -ForegroundColor Cyan
Start-Process cmd.exe -ArgumentList '/k', "title Healthcare - Backend [FastAPI / Uvicorn :8000] && cd /d `"$backendDir`" && call `"$activateScript`" && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

Start-Sleep -Seconds 2

Write-Host "Starting Frontend (Vite / React on http://localhost:5173)..." -ForegroundColor Cyan
Start-Process cmd.exe -ArgumentList '/k', "title Healthcare - Frontend [Vite / React :5173] && cd /d `"$frontendDir`" && npm run dev"

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "                    All Services Started Successfully!" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  * Frontend UI (React + Vite):   http://localhost:5173" -ForegroundColor White
Write-Host "  * Backend API (FastAPI):        http://127.0.0.1:8000" -ForegroundColor White
Write-Host "  * Interactive API Docs:         http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "  * API Health Check:             http://127.0.0.1:8000/health" -ForegroundColor White
Write-Host ""
Write-Host "Services are running in separate dedicated terminal windows with full live logs." -ForegroundColor Gray
Write-Host "Run '.\stop.ps1' or 'stop.bat' to stop both services." -ForegroundColor Yellow
Write-Host "==============================================================================" -ForegroundColor Green
