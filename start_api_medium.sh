#!/bin/bash
# Скрипт для запуска API с моделью Whisper Medium
# Для macOS/Linux

echo "========================================"
echo "Запуск API сервера с моделью Whisper Medium"
echo "========================================"
echo ""

# Проверка виртуального окружения
if [ -f "venv/bin/activate" ]; then
    echo "Активация виртуального окружения..."
    source venv/bin/activate
else
    echo "ВНИМАНИЕ: Виртуальное окружение не найдено!"
    echo "Создайте его командой: python -m venv venv"
    exit 1
fi

# Установка переменной окружения для модели
export WHISPER_MODEL=medium

echo ""
echo "Используется модель: $WHISPER_MODEL"
echo "API будет доступен по адресу: http://localhost:8000"
echo "Frontend доступен по адресу: http://localhost:3000"
echo ""
echo "Для остановки сервера нажмите Ctrl+C"
echo "========================================"
echo ""

# Запуск сервера
uvicorn api.app:app --reload --host 0.0.0.0 --port 8000


