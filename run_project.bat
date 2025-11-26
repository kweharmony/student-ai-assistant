@echo off
chcp 65001 >nul 2>&1
setlocal EnableExtensions

cd /d "%~dp0"
echo ========================================
echo        ЗАПУСК BACKEND И FRONTEND
echo ========================================
echo.

if not exist "venv\Scripts\activate.bat" (
    echo [ОШИБКА] Виртуальное окружение не найдено. Сначала запустите setup_project.bat
    pause
    exit /b 1
)

if not exist "start_api_medium.bat" (
    echo [ОШИБКА] Файл start_api_medium.bat не найден.
    pause
    exit /b 1
)

if not exist "package.json" (
    echo [ОШИБКА] package.json не найден. Проверьте целостность проекта.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo.
    echo ========================================
    echo [ОШИБКА] Зависимости не установлены!
    echo ========================================
    echo.
    echo Директория node_modules не найдена.
    echo.
    echo Сначала запустите setup_project.bat для установки зависимостей:
    echo   1. Откройте setup_project.bat
    echo   2. Дождитесь завершения установки
    echo   3. Затем запустите run_project.bat снова
    echo.
    pause
    exit /b 1
)

echo.
echo Запускаю API сервер в отдельном окне...
start "API Server" cmd /k "cd /d "%~dp0" && call start_api_medium.bat"
timeout /t 2 /nobreak >nul

echo Запускаю frontend (npm start) в отдельном окне...
start "Frontend" cmd /k "cd /d "%~dp0" && npm start"
timeout /t 2 /nobreak >nul

echo.
echo ✅ Оба процесса запущены. Используйте открытые окна для остановки (Ctrl+C).
pause
exit /b 0

