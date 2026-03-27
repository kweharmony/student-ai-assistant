@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul 2>&1

:: =============================================================
::  Student AI Assistant - Setup (Windows)
:: =============================================================

cd /d "%~dp0"

set "VENV_DIR=.venv"
set "TOOLS_DIR=tools"
set "FFMPEG_DIR=%TOOLS_DIR%\ffmpeg"
set "NODE_DIR=%TOOLS_DIR%\node"
set "NODE_VERSION=v20.18.1"
set "MARKER_FILE=%VENV_DIR%\.setup_done"
set "CUDA_MARKER=%VENV_DIR%\.cuda_choice_done"

if not defined WHISPER_MODEL set "WHISPER_MODEL=medium"

echo ========================================
echo   Student AI Assistant - Setup
echo ========================================
echo.
echo   [!] For some libraries (PyTorch, Whisper)
echo       a VPN may be required to download.
echo       Make sure VPN is ON before continuing.
echo.
pause

:: =============================================================
::  1. Python 3.12
:: =============================================================
echo [INFO] Checking Python 3.12...

set "PYTHON_CMD="

:: Try py -3.12 (Windows Launcher)
where py >nul 2>&1
if !ERRORLEVEL! equ 0 (
    py -3.12 -c "import sys; print(sys.version_info.major, sys.version_info.minor)" >"%TEMP%\pyver.txt" 2>nul
    if !ERRORLEVEL! equ 0 (
        set /p PY_VER=<"%TEMP%\pyver.txt"
        if "!PY_VER!"=="3 12" set "PYTHON_CMD=py -3.12"
    )
    del "%TEMP%\pyver.txt" 2>nul
)

:: Try python
if not defined PYTHON_CMD (
    where python >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        python -c "import sys; print(sys.version_info.major, sys.version_info.minor)" >"%TEMP%\pyver.txt" 2>nul
        if !ERRORLEVEL! equ 0 (
            set /p PY_VER=<"%TEMP%\pyver.txt"
            if "!PY_VER!"=="3 12" set "PYTHON_CMD=python"
        )
        del "%TEMP%\pyver.txt" 2>nul
    )
)

if not defined PYTHON_CMD (
    echo [ERROR] Python 3.12 not found!
    echo.
    echo   Download Python 3.12: https://www.python.org/downloads/
    echo   Check "Add Python to PATH" during installation
    echo.
    pause
    exit /b 1
)

echo [OK] Python 3.12 found: %PYTHON_CMD%

:: =============================================================
::  2. Virtual environment
:: =============================================================
if not exist "%VENV_DIR%\Scripts\activate.bat" (
    echo [INFO] Creating virtual environment...
    %PYTHON_CMD% -m venv %VENV_DIR%
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Failed to create virtual environment
        pause
        exit /b 1
    )
    echo [OK] Virtual environment created
) else (
    echo [OK] Virtual environment already exists
)

call "%VENV_DIR%\Scripts\activate.bat"

:: =============================================================
::  3. Python dependencies
:: =============================================================
set "NEED_INSTALL=1"
if exist "%MARKER_FILE%" (
    :: Compare timestamps via Python
    python -c "import os,sys; m=os.path.getmtime('.venv/.setup_done'); r=os.path.getmtime('requirements.txt'); sys.exit(0 if m>r else 1)" 2>nul
    if !ERRORLEVEL! equ 0 set "NEED_INSTALL=0"
)

if "!NEED_INSTALL!"=="0" (
    echo [OK] Python dependencies already installed
) else (
    echo [INFO] Installing Python dependencies...
    python -m pip install --upgrade pip -q
    pip install -r requirements.txt
    if !ERRORLEVEL! neq 0 (
        echo [WARN] Some dependencies had issues
    )
    echo. > "%MARKER_FILE%"
    echo [OK] Python dependencies installed
)

:: =============================================================
::  3.1. CUDA (GPU acceleration)
:: =============================================================
if exist "%CUDA_MARKER%" (
    echo [OK] CUDA choice already made. Delete %CUDA_MARKER% to choose again.
    goto :cuda_done
)

echo.
echo [INFO] Checking CUDA...

:: Check if CUDA already works
python -c "import torch; exit(0 if torch.cuda.is_available() else 1)" 2>nul
if !ERRORLEVEL! equ 0 (
    echo [OK] CUDA already available
    echo yes> "%CUDA_MARKER%"
    goto :cuda_done
)

echo.
echo   PyTorch is currently CPU-only.
echo   CUDA makes transcription 10-15x faster.
echo   Requires: NVIDIA GPU + NVIDIA drivers.
echo.
set /p "INSTALL_CUDA=  Install PyTorch with CUDA? (y/N): "

if /i "!INSTALL_CUDA!"=="y" (
    echo [INFO] Installing PyTorch with CUDA...
    pip uninstall -y torch torchaudio 2>nul
    pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

    python -c "import torch; exit(0 if torch.cuda.is_available() else 1)" 2>nul
    if !ERRORLEVEL! equ 0 (
        echo [OK] CUDA PyTorch installed and working!
        python -c "import torch; print('  GPU:', torch.cuda.get_device_name(0))"
    ) else (
        echo [WARN] CUDA PyTorch installed but GPU not detected.
        echo [WARN] Make sure NVIDIA drivers are installed.
    )
    echo yes> "%CUDA_MARKER%"
) else (
    echo [INFO] Skipping CUDA. Whisper will use CPU.
    echo no> "%CUDA_MARKER%"
)

:cuda_done

:: =============================================================
::  4. FFmpeg
:: =============================================================
echo.
echo [INFO] Checking FFmpeg...

where ffmpeg >nul 2>&1
if !ERRORLEVEL! equ 0 (
    echo [OK] FFmpeg found in system
    goto :ffmpeg_done
)

if exist "%FFMPEG_DIR%\bin\ffmpeg.exe" (
    echo [OK] FFmpeg found in tools/
    goto :ffmpeg_done
)

:: Search in subfolders
for /r "%FFMPEG_DIR%" %%F in (ffmpeg.exe) do (
    if exist "%%F" (
        echo [OK] FFmpeg found in tools/
        goto :ffmpeg_done
    )
)

echo [INFO] Downloading FFmpeg...
if not exist "%FFMPEG_DIR%" mkdir "%FFMPEG_DIR%"

set "FFMPEG_URL=https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
set "FFMPEG_ZIP=%TEMP%\ffmpeg_download.zip"

curl -L --progress-bar "%FFMPEG_URL%" -o "%FFMPEG_ZIP%"
if !ERRORLEVEL! neq 0 (
    echo [WARN] Failed to download FFmpeg. Install manually: https://ffmpeg.org/download.html
    goto :ffmpeg_done
)

echo [INFO] Extracting FFmpeg...
powershell -NoProfile -Command "Expand-Archive -Path '%FFMPEG_ZIP%' -DestinationPath '%FFMPEG_DIR%' -Force"
del "%FFMPEG_ZIP%" 2>nul

:: Move nested folder contents up
for /d %%D in ("%FFMPEG_DIR%\ffmpeg-*") do (
    if exist "%%D\bin\ffmpeg.exe" (
        xcopy /E /Y /Q "%%D\*" "%FFMPEG_DIR%\" >nul
        rd /S /Q "%%D" 2>nul
    )
)

if exist "%FFMPEG_DIR%\bin\ffmpeg.exe" (
    echo [OK] FFmpeg downloaded to %FFMPEG_DIR%
) else (
    echo [WARN] Failed to extract FFmpeg
)

:ffmpeg_done

:: =============================================================
::  5. Node.js
:: =============================================================
echo.
echo [INFO] Checking Node.js...

set "NODE_OK=0"
where node >nul 2>&1
if !ERRORLEVEL! equ 0 (
    node --version >"%TEMP%\nodever.txt" 2>nul
    set /p NODE_VER=<"%TEMP%\nodever.txt"
    del "%TEMP%\nodever.txt" 2>nul

    :: Extract major version number
    set "NODE_VER_CLEAN=!NODE_VER:v=!"
    for /f "tokens=1 delims=." %%M in ("!NODE_VER_CLEAN!") do (
        if %%M GEQ 18 set "NODE_OK=1"
    )
    if "!NODE_OK!"=="1" (
        echo [OK] Node.js already installed: !NODE_VER!
        goto :node_done
    ) else (
        echo [WARN] Node.js !NODE_VER! is too old, need 18+
    )
)

if exist "%NODE_DIR%\node.exe" (
    echo [OK] Node.js found in tools/
    goto :node_done
)

echo [INFO] Downloading Node.js %NODE_VERSION%...
if not exist "%NODE_DIR%" mkdir "%NODE_DIR%"

set "NODE_ARCHIVE=node-%NODE_VERSION%-win-x64"
set "NODE_URL=https://nodejs.org/dist/%NODE_VERSION%/%NODE_ARCHIVE%.zip"
set "NODE_ZIP=%TEMP%\node_download.zip"

curl -L --progress-bar "%NODE_URL%" -o "%NODE_ZIP%"
if !ERRORLEVEL! neq 0 (
    echo [WARN] Failed to download Node.js. Install manually: https://nodejs.org/
    goto :node_done
)

echo [INFO] Extracting Node.js...
powershell -NoProfile -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%TOOLS_DIR%' -Force"
del "%NODE_ZIP%" 2>nul

:: Rename extracted folder
if exist "%TOOLS_DIR%\%NODE_ARCHIVE%" (
    if exist "%NODE_DIR%" rd /S /Q "%NODE_DIR%" 2>nul
    ren "%TOOLS_DIR%\%NODE_ARCHIVE%" "node"
)

if exist "%NODE_DIR%\node.exe" (
    echo [OK] Node.js downloaded to %NODE_DIR%
) else (
    echo [WARN] Failed to extract Node.js
)

:node_done

:: Add tools to PATH for this session
set "PATH=%~dp0%FFMPEG_DIR%\bin;%~dp0%NODE_DIR%;%PATH%"

:: =============================================================
::  6. npm dependencies
:: =============================================================
echo.

set "NPM_CMD="
where npm >nul 2>&1
if !ERRORLEVEL! equ 0 (
    set "NPM_CMD=npm"
) else if exist "%NODE_DIR%\npm.cmd" (
    set "NPM_CMD=%NODE_DIR%\npm.cmd"
)

if not defined NPM_CMD (
    echo [WARN] npm not found - skipping frontend dependencies
    goto :npm_done
)

if exist "node_modules\react\package.json" (
    echo [OK] npm dependencies already installed
) else (
    echo [INFO] Installing npm dependencies...
    call !NPM_CMD! install --legacy-peer-deps
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
    echo [OK] npm dependencies installed
)

:npm_done

:: =============================================================
::  7. Whisper model
:: =============================================================
echo.
echo ========================================
echo   Whisper model selection
echo ========================================
echo.
echo   1. tiny   -  ~75 MB  - 30 min audio ~ 10 min  (low quality)
echo   2. base   - ~150 MB  - 30 min audio ~  7 min  (OK quality)
echo   3. small  - ~500 MB  - 30 min audio ~  5 min  (good quality)
echo   4. medium - ~1.5 GB  - 30 min audio ~  3 min  (great quality) [default]
echo   5. large  -  ~3 GB   - 30 min audio ~  2 min  (best quality)
echo.
echo   * Times are approximate for CPU. With CUDA GPU it is 10-15x faster.
echo.
set /p "MODEL_CHOICE=  Choose model (1-5, default 4): "

if "!MODEL_CHOICE!"=="1" set "WHISPER_MODEL=tiny"
if "!MODEL_CHOICE!"=="2" set "WHISPER_MODEL=base"
if "!MODEL_CHOICE!"=="3" set "WHISPER_MODEL=small"
if "!MODEL_CHOICE!"=="5" set "WHISPER_MODEL=large"
if "!MODEL_CHOICE!"=="" set "WHISPER_MODEL=medium"
if "!MODEL_CHOICE!"=="4" set "WHISPER_MODEL=medium"

echo.
echo [INFO] Downloading Whisper model: %WHISPER_MODEL%...
python scripts\download_model.py %WHISPER_MODEL%

:: =============================================================
::  Done
:: =============================================================
echo.
echo ========================================
echo   Setup complete!
echo ========================================
echo.
echo   Run the project:  run.bat
echo.
pause
