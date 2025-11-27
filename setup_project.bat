@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul 2>&1

cd /d "%~dp0"

echo ========================================
echo    PROJECT DEPENDENCY INSTALLER
echo ========================================
echo.

rem Check Python
where python >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Python not found. Install Python 3.10+ and rerun.
    pause
    exit /b 1
)

rem Create virtual environment
if not exist ".venv\Scripts\activate.bat" (
    echo Creating virtual environment...
    python -m venv .venv
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Failed to create virtual environment
        pause
        exit /b 1
    )
)

echo Activating virtual environment and upgrading pip...
call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip >nul 2>&1

rem Install Python dependencies
if exist "requirements.txt" (
    echo Installing Python dependencies...
    pip install -r requirements.txt
    if !ERRORLEVEL! neq 0 (
        echo [WARNING] pip install had issues
    )
)

rem Check CUDA availability
echo.
echo Checking CUDA availability...
python -c "import torch; cuda = torch.cuda.is_available(); print('CUDA:', cuda); print('Device:', torch.cuda.get_device_name(0) if cuda else 'CPU')" 2>nul
if !ERRORLEVEL! neq 0 (
    echo [INFO] PyTorch not installed yet
    echo.
    set /p install_cuda="Have RTX GPU? Install CUDA PyTorch? (y/N): "
    if /i "!install_cuda!"=="y" (
        echo Installing PyTorch with CUDA...
        pip uninstall -y torch torchaudio 2>nul
        pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
        python -c "import torch; print('CUDA:', torch.cuda.is_available())"
    )
) else (
    echo.
    set /p install_cuda="Upgrade to CUDA PyTorch? (y/N): "
    if /i "!install_cuda!"=="y" (
        echo Installing PyTorch with CUDA...
        pip uninstall -y torch torchaudio
        pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
        python -c "import torch; print('CUDA:', torch.cuda.is_available())"
    )
)

rem Download Whisper model
echo.
echo Downloading Whisper model...
python -c "from download_model import download_whisper_model; download_whisper_model('medium')" 2>nul
if !ERRORLEVEL! neq 0 (
    echo [WARNING] Whisper download failed - will download on first use
)

echo.
echo ========================================
echo    FRONTEND INSTALLER
echo ========================================
echo.

rem Check Node.js
where node >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Node.js not found
    pause
    exit /b 1
)

rem Check npm
where npm >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo [ERROR] npm not found
    pause
    exit /b 1
)

if not exist "package.json" (
    echo [ERROR] package.json not found
    pause
    exit /b 1
)

echo Installing npm dependencies...
call npm install --legacy-peer-deps
if !ERRORLEVEL! neq 0 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [ERROR] node_modules directory missing
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup completed successfully!
echo ========================================
echo.
echo Next step: run_project.bat
pause
