@echo off
cd /d "%~dp0"
chcp 65001 >nul

echo ========================================
echo Starting API server with Whisper Medium model
echo ========================================
echo.

REM Check virtual environment
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo ERROR: Virtual environment not found!
    echo Run: python -m venv venv
    pause
    exit /b 1
)

REM Set environment variable for model
set WHISPER_MODEL=medium

echo.
echo Using model: %WHISPER_MODEL%
echo API will be available at: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Launch server using explicit Python from venv
venv\Scripts\python.exe -m uvicorn api.app:app --reload --host 0.0.0.0 --port 8000