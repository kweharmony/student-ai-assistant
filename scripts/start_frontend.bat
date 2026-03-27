@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0\.."
set "PATH=%cd%\tools\node;%PATH%"

set "NPM_CMD="
where npm >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "NPM_CMD=npm"
) else if exist "tools\node\npm.cmd" (
    set "NPM_CMD=tools\node\npm.cmd"
)

if not defined NPM_CMD (
    echo [ERROR] npm not found. Run setup.bat first.
    pause
    exit /b 1
)

echo.
echo [INFO] Starting frontend on http://localhost:3000 ...
echo.
%NPM_CMD% start
echo.
echo [ERROR] Frontend stopped unexpectedly.
pause
