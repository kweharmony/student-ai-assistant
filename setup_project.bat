@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1

cd /d "%~dp0"

echo ========================================
echo    PROJECT DEPENDENCY INSTALLER
echo ========================================
echo.

rem --- Check Python availability ---
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found. Install Python 3.10+ and rerun.
    pause
    exit /b 1
)

rem --- Create virtual environment if missing ---
if not exist ".venv\Scripts\activate.bat" (
    echo Creating virtual environment (.venv)...
    python -m venv .venv
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

echo Activating virtual environment and upgrading pip...
call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Failed to upgrade pip, continuing anyway...
)

rem --- Install backend dependencies ---
if exist "requirements.txt" (
    echo Installing Python dependencies...
    pip install -r requirements.txt
    if %ERRORLEVEL% neq 0 (
        echo [WARNING] pip install had issues, continuing anyway...
    )
) else (
    echo [WARNING] requirements.txt missing, skipping backend installation.
)

rem --- Check CUDA and recommend GPU installation ---
echo.
echo Checking CUDA availability...
python -c "import torch; cuda = torch.cuda.is_available(); print('CUDA available:', cuda); print('Device:', torch.cuda.get_device_name(0) if cuda else 'CPU'); print(''); print('RECOMMENDATION:' if not cuda else 'GPU DETECTED:'); print('  For RTX GPUs, install CUDA version:' if not cuda else '  Using GPU acceleration'); print('  pip uninstall torch torchaudio' if not cuda else ''); print('  pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118' if not cuda else '')"

echo.
set /p "install_cuda=Do you want to install PyTorch with CUDA support now? (y/N): "
if /i "%install_cuda%"=="y" (
    echo Installing PyTorch with CUDA 11.8...
    pip uninstall -y torch torchaudio
    pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
    echo.
    echo Verifying CUDA installation...
    python -c "import torch; print('CUDA now available:', torch.cuda.is_available())"
)

rem --- Download Whisper medium model ---
echo.
echo Downloading Whisper medium model with download_model.py...
python -c "from download_model import download_whisper_model; download_whisper_model('medium')"
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Automatic Whisper download failed.
    echo Run manually: call .venv\Scripts\activate.bat ^&^& python download_model.py
) else (
    echo Whisper model ready to use.
)

echo.
echo ========================================
echo    FRONTEND DEPENDENCY INSTALLER
echo ========================================
echo.

rem --- Check Node.js ---
echo Checking Node.js...
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo Node.js version: %%i

rem --- Check npm ---
echo Checking npm...
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm not found. Install Node.js from https://nodejs.org and rerun.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do echo npm version: %%i

rem --- Install frontend dependencies ---
if not exist "package.json" (
    echo [ERROR] package.json not found!
    pause
    exit /b 1
)

echo.
echo Removing previous node_modules directory if it exists...
if exist "node_modules" (
    rmdir /s /q "node_modules" 2>nul
    echo Removed old node_modules.
)

echo.
echo Installing npm dependencies (this may take a few minutes)...
echo.
call npm install --legacy-peer-deps
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm install failed. Code: %ERRORLEVEL%
    pause
    exit /b 1
)

echo.
echo Verifying npm install result...
if not exist "node_modules" (
    echo [ERROR] node_modules directory missing!
    pause
    exit /b 1
)

if not exist "node_modules\react" (
    echo [ERROR] React package missing!
    pause
    exit /b 1
)

echo.
echo [OK] Frontend dependencies installed successfully!

echo.
echo ========================================
echo [OK] Setup completed successfully!
echo ========================================
echo.
echo Run run_project.bat to start the services.
echo.
pause
exit /b 0
