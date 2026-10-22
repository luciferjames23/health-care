@echo off
setlocal enabledelayedexpansion
title Healthcare Platform Orchestrator

echo ==============================================================================
echo             Healthcare Unified Platform - Startup Launcher
echo ==============================================================================
echo.

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"

rem Step 1: Detect and verify Python Virtual Environment
echo [1/4] Checking Backend Python Environment...
if exist "%BACKEND_DIR%\venv\Scripts\activate.bat" (
    set "ACTIVATE_SCRIPT=%BACKEND_DIR%\venv\Scripts\activate.bat"
    echo       [OK] Found virtual environment in backend\venv
) else if exist "%BACKEND_DIR%\.venv\Scripts\activate.bat" (
    set "ACTIVATE_SCRIPT=%BACKEND_DIR%\.venv\Scripts\activate.bat"
    echo       [OK] Found virtual environment in backend\.venv
) else (
    echo       [!] No virtual environment found. Creating backend\.venv...
    cd /d "%BACKEND_DIR%"
    python -m venv .venv
    set "ACTIVATE_SCRIPT=%BACKEND_DIR%\.venv\Scripts\activate.bat"
    call "%ACTIVATE_SCRIPT%"
    echo       Installing dependencies from requirements.txt...
    pip install -r requirements.txt
    cd /d "%ROOT_DIR%"
)

rem Step 2: Check Frontend Dependencies
echo [2/4] Checking Frontend Node Dependencies...
if not exist "%FRONTEND_DIR%\node_modules" (
    echo       [!] node_modules not found. Running npm install in frontend...
    cd /d "%FRONTEND_DIR%"
    call npm install
    cd /d "%ROOT_DIR%"
) else (
    echo       [OK] Found node_modules in frontend\
)

rem Step 3: Check Port Availability (8000 and 5173)
echo [3/4] Verifying Ports (8000, 5173)...
netstat -ano | findstr :8000 | findstr LISTENING >nul
if %ERRORLEVEL% equ 0 (
    echo       [WARNING] Port 8000 is already in use by another process!
    echo       Run 'stop.bat' first if you need to free port 8000.
)
netstat -ano | findstr :5173 | findstr LISTENING >nul
if %ERRORLEVEL% equ 0 (
    echo       [WARNING] Port 5173 is already in use by another process!
    echo       Run 'stop.bat' first if you need to free port 5173.
)

rem Step 4: Launch Backend and Frontend Services in dedicated labeled windows
echo [4/4] Starting Services...
echo.

rem Launch Backend in dedicated window
echo Starting Backend (FastAPI / Uvicorn on http://127.0.0.1:8000)...
start "Healthcare - Backend [FastAPI / Uvicorn :8000]" cmd /k "title Healthcare - Backend [FastAPI / Uvicorn :8000] && cd /d "%BACKEND_DIR%" && call "%ACTIVATE_SCRIPT%" && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

rem Wait 2 seconds for backend to start initializing before frontend dev server starts
ping 127.0.0.1 -n 3 >nul

rem Launch Frontend in dedicated window
echo Starting Frontend (Vite / React on http://localhost:5173)...
start "Healthcare - Frontend [Vite / React :5173]" cmd /k "title Healthcare - Frontend [Vite / React :5173] && cd /d "%FRONTEND_DIR%" && npm run dev"

echo.
echo ==============================================================================
echo                     All Services Started Successfully!
echo ==============================================================================
echo.
echo   * Frontend UI (React + Vite):   http://localhost:5173
echo   * Backend API (FastAPI):        http://127.0.0.1:8000
echo   * Interactive API Docs:         http://127.0.0.1:8000/docs
echo   * API Health Check:             http://127.0.0.1:8000/health
echo.
echo Backend and Frontend are streaming live logs in their dedicated windows.
echo To stop all services cleanly, run 'stop.bat' or press any key below.
echo ==============================================================================
echo.
pause >nul 2>&1
call "%ROOT_DIR%stop.bat"
