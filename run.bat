@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

:: =============================================================
::  Student AI Assistant — Run (Windows)
:: =============================================================

:: ---------- checks ----------
if not exist ".venv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment not found. Run setup.bat first.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [ERROR] npm dependencies not found. Run setup.bat first.
    pause
    exit /b 1
)

echo ========================================
echo   Student AI Assistant
echo ========================================
echo.

:: ---------- launch ----------
echo [INFO] Starting API server (http://localhost:8000)...
start "API Server" cmd /c scripts\start_backend.bat

timeout /t 3 /nobreak >nul

echo [INFO] Starting frontend (http://localhost:3000)...
start "Frontend" cmd /c scripts\start_frontend.bat

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   Both servers are running!
echo ========================================
echo.
echo   API:      http://localhost:8000
echo   Frontend: http://localhost:3000
echo   Docs:     http://localhost:8000/docs
echo.
echo   Close the server windows to stop.
echo.
pause
