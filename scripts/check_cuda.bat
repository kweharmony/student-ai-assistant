@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0\.."
REM Script to check CUDA availability for Whisper transcription

echo ========================================
echo CUDA AVAILABILITY CHECK
echo ========================================
echo.

REM Check virtual environment
if exist ".venv\Scripts\activate.bat" (
    echo Activating .venv...
    call .venv\Scripts\activate.bat
) else if exist "venv\Scripts\activate.bat" (
    echo Activating venv...
    call venv\Scripts\activate.bat
) else (
    echo ERROR: Virtual environment not found!
    echo Run setup_project.bat first.
    pause
    exit /b 1
)

echo.
echo ========================================
echo CUDA STATUS:
echo ========================================
python -c "import torch; cuda = torch.cuda.is_available(); print(''); print('CUDA Available:', cuda); print('PyTorch Version:', torch.__version__); print(''); if cuda: print('GPU Device:', torch.cuda.get_device_name(0)); print('GPU Count:', torch.cuda.device_count()); print('CUDA Version:', torch.version.cuda); print(''); print('✅ GPU ACCELERATION ENABLED'); print('   30 min audio → ~1-2 min processing'); else: print('❌ GPU ACCELERATION DISABLED'); print('   30 min audio → ~15-20 min processing'); print(''); print('To enable GPU:'); print('  1. pip uninstall torch torchaudio'); print('  2. pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118'); print('  3. Restart this script'); print('')"

echo.
echo ========================================
pause
