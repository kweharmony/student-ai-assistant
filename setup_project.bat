@echo off
chcp 65001 >nul 2>&1
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"
echo ========================================
echo    УСТАНОВКА ЗАВИСИМОСТЕЙ ПРОЕКТА
echo ========================================
echo.

rem --- Проверяем наличие Python ---
where python >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Python не найден. Установите Python 3.10+ и повторите.
    pause
    exit /b 1
)

rem --- Создаём виртуальное окружение (если нужно) ---
if not exist "venv\Scripts\activate.bat" (
    echo Создаю виртуальное окружение...
    python -m venv venv
    if errorlevel 1 (
        echo [ОШИБКА] Не удалось создать виртуальное окружение.
        pause
        exit /b 1
    )
)

echo Активирую виртуальное окружение и обновляю pip...
call "venv\Scripts\activate.bat"
python -m pip install --upgrade pip
if errorlevel 1 (
    echo [ОШИБКА] Не удалось обновить pip.
    pause
    exit /b 1
)

rem --- Устанавливаем backend-зависимости ---
if exist "requirements.txt" (
    echo Устанавливаю Python-зависимости...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [ОШИБКА] pip install завершился с ошибкой.
        pause
        exit /b 1
    )
) else (
    echo [ПРЕДУПРЕЖДЕНИЕ] Файл requirements.txt не найден, пропускаю установку.
)

rem --- Загружаем модель Whisper medium ---
echo Загружаю модель Whisper (medium) при помощи download_model.py...
python -c "from download_model import download_whisper_model; download_whisper_model('medium')"
if errorlevel 1 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Не удалось загрузить модель Whisper автоматически.
    echo Запустите вручную:  call venv\Scripts\activate.bat ^&^& python download_model.py
) else (
    echo Модель Whisper готова к использованию.
)

echo.
echo ========================================
echo    УСТАНОВКА FRONTEND ЗАВИСИМОСТЕЙ
echo ========================================
echo.

rem --- Проверяем Node.js ---
echo Проверяю наличие Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Node.js не найден. Установите Node.js с https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo Node.js версия: %%i

rem --- Проверяем npm ---
echo Проверяю наличие npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] npm не найден. Установите Node.js (https://nodejs.org) и повторите.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do echo npm версия: %%i

rem --- Устанавливаем frontend-зависимости ---
if not exist "package.json" (
    echo [ОШИБКА] Файл package.json не найден!
    pause
    exit /b 1
)

echo.
echo Удаляю старые node_modules (если есть)...
if exist "node_modules" (
    rmdir /s /q "node_modules" 2>nul
    echo Старые node_modules удалены.
)

echo.
echo Устанавливаю npm-зависимости...
echo Это может занять несколько минут...
echo.
call npm install --legacy-peer-deps
if %ERRORLEVEL% neq 0 (
    echo [ОШИБКА] npm install завершился с ошибкой. Код: %ERRORLEVEL%
    pause
    exit /b 1
)

echo.
echo Проверяю результат установки...
if not exist "node_modules" (
    echo [ОШИБКА] Директория node_modules не создана!
    pause
    exit /b 1
)

if not exist "node_modules\react" (
    echo [ОШИБКА] React не установлен!
    pause
    exit /b 1
)

echo.
echo ✅ Frontend зависимости установлены успешно!

echo.
echo ========================================
echo ✅ Установка завершена успешно!
echo ========================================
echo.
echo Теперь запустите run_project.bat для запуска серверов.
echo.
pause
exit /b 0

