@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0\.."
call .venv\Scripts\activate.bat
set "PATH=%cd%\tools\ffmpeg\bin;%cd%\tools\node;%PATH%"
echo.
echo [INFO] Starting API server on http://localhost:8000 ...
echo.
uvicorn api.app:app --host 0.0.0.0 --port 8000
echo.
echo [ERROR] API server stopped unexpectedly.
pause
