@echo off
chcp 65001 >nul 2>&1
REM Скрипт для запуска API с моделью Whisper Medium
REM Для Windows

echo ========================================
echo Запуск API сервера с моделью Whisper Medium
echo ========================================
echo.

REM Проверка виртуального окружения
if exist "venv\Scripts\activate.bat" (
    echo Активация виртуального окружения...
    call venv\Scripts\activate.bat
) else (
    echo ВНИМАНИЕ: Виртуальное окружение не найдено!
    echo Создайте его командой: python -m venv venv
    pause
    exit /b 1
)

REM Установка переменной окружения для модели
set WHISPER_MODEL=medium

echo.
echo Используется модель: %WHISPER_MODEL%
echo API будет доступен по адресу: http://localhost:8000
echo Frontend доступен по адресу: http://localhost:3000
echo.
echo Для остановки сервера нажмите Ctrl+C
echo ========================================
echo.

REM Запуск сервера
uvicorn api.app:app --reload --host 0.0.0.0 --port 8000


