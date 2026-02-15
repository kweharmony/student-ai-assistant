#!/bin/bash
# Скрипт для запуска API с моделью Whisper Medium
# Для macOS/Linux

cd "$(dirname "$0")/.."

echo "========================================"
echo "Запуск API сервера с моделью Whisper Medium"
echo "========================================"
echo ""

# Проверка виртуального окружения (.venv)
if [ -f ".venv/bin/activate" ]; then
    echo "Активация .venv..."
    source .venv/bin/activate
elif [ -f "venv/bin/activate" ]; then
    echo "ВНИМАНИЕ: Найдена старая директория 'venv', рекомендуется использовать '.venv'!"
    echo "Активация venv..."
    source venv/bin/activate
else
    echo "ОШИБКА: Виртуальное окружение не найдено!"
    echo "Создайте его командой: python3 -m venv .venv"
    exit 1
fi

# Установка переменной окружения для модели
export WHISPER_MODEL=medium

echo ""
echo "Используется модель: $WHISPER_MODEL"
echo ""

# Проверка доступности CUDA
echo "Проверка доступности CUDA..."
python -c "import torch; cuda_available = torch.cuda.is_available(); print('CUDA available:', cuda_available); print('Device:', torch.cuda.get_device_name(0) if cuda_available else 'CPU only'); print('PyTorch version:', torch.__version__)"
if [ $? -ne 0 ]; then
    echo "ВНИМАНИЕ: Не удалось проверить статус CUDA!"
fi

echo ""
echo "API будет доступен по адресу: http://localhost:8000"
echo "Frontend доступен по адресу: http://localhost:3000"
echo ""
echo "Для остановки сервера нажмите Ctrl+C"
echo "========================================"
echo ""

# Запуск сервера
uvicorn api.app:app --reload --host 0.0.0.0 --port 8000



