@echo off
setlocal enabledelayedexpansion
title Healthcare Platform Shutdown

echo ==============================================================================
echo                 Stopping Healthcare Platform Services...
echo ==============================================================================
echo.

rem Terminate any process listening on port 8000 (Backend)
echo [1/2] Checking and terminating processes on Port 8000 (Backend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    if not "%%a"=="" (
        echo       Terminating PID %%a on port 8000...
        taskkill /F /PID %%a >nul 2>&1
    )
)

rem Terminate any process listening on port 5173 (Frontend)
echo [2/2] Checking and terminating processes on Port 5173 (Frontend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    if not "%%a"=="" (
        echo       Terminating PID %%a on port 5173...
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo.
echo ==============================================================================
echo                    Healthcare Services Stopped
echo ==============================================================================
ping 127.0.0.1 -n 2 >nul
