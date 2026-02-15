@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0\.."
REM Script to run API with Whisper Medium model
REM For Windows

echo ========================================
echo Starting API server with Whisper Medium model
echo ========================================
echo.

REM Check virtual environment (.venv)
if exist ".venv\Scripts\activate.bat" (
    echo Activating .venv...
    call .venv\Scripts\activate.bat
) else if exist "venv\Scripts\activate.bat" (
    echo WARNING: Found old 'venv' directory, but using '.venv' is recommended!
    echo Activating venv...
    call venv\Scripts\activate.bat
) else (
    echo ERROR: Virtual environment not found!
    echo Create it using: python -m venv .venv
    pause
    exit /b 1
)

REM Set environment variable for model
set WHISPER_MODEL=medium

echo.
echo Using model: %WHISPER_MODEL%
echo.

REM Check CUDA availability
echo Checking CUDA availability...
python -c "import torch; cuda_available = torch.cuda.is_available(); print('CUDA available:', cuda_available); print('Device:', torch.cuda.get_device_name(0) if cuda_available else 'CPU only'); print('PyTorch version:', torch.__version__)"
if %ERRORLEVEL% neq 0 (
    echo WARNING: Failed to check CUDA status!
)

echo.
echo API will be available at: http://localhost:8000
echo Frontend will be available at: http://localhost:3000
echo.
echo To stop the server, press Ctrl+C
echo ========================================
echo.

REM Start server
uvicorn api.app:app --reload --host 0.0.0.0 --port 8000