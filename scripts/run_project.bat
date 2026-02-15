@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1

cd /d "%~dp0\.."
if errorlevel 1 (
    echo [ERROR] Failed to switch to project directory.
    pause
    exit /b 1
)

echo ========================================
echo   STARTING BACKEND AND FRONTEND
echo ========================================
echo.

if not exist ".venv\Scripts\activate.bat" (
    if not exist "venv\Scripts\activate.bat" (
        echo [ERROR] Virtual environment not found. Run setup_project.bat first.
        pause
        exit /b 1
    ) else (
        echo [WARNING] Found old venv directory. Consider using .venv instead.
    )
)

if not exist "scripts\start_api_medium.bat" (
    echo [ERROR] File scripts\start_api_medium.bat not found.
    pause
    exit /b 1
)

if not exist "package.json" (
    echo [ERROR] package.json not found. Check project integrity.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo.
    echo ========================================
    echo [ERROR] Dependencies not installed!
    echo ========================================
    echo.
    echo Directory node_modules not found.
    echo.
    echo Run setup_project.bat first to install dependencies:
    echo   1. Open setup_project.bat
    echo   2. Wait for installation to complete
    echo   3. Then run run_project.bat again
    echo.
    pause
    exit /b 1
)

echo.
echo Starting API server in separate window...
start "API Server" cmd /k "cd /d "%~dp0\.." && call scripts\start_api_medium.bat"
timeout /t 2 /nobreak >nul

echo Starting frontend in separate window...
start "Frontend" cmd /k "cd /d "%~dp0\.." && npm start"
timeout /t 2 /nobreak >nul

echo.
echo [OK] Both processes started. Use opened windows to stop them with Ctrl+C.
pause
exit /b 0
