#!/bin/bash
# Скрипт запуска бэкенда: миграции + начальный админ + сервер
set -e

echo "=== Применение миграций БД ==="
alembic upgrade head

echo "=== Создание начального администратора ==="
python -m scripts.seed_admin

echo "=== Запуск FastAPI ==="
exec uvicorn api.app:app --host 0.0.0.0 --port 8000 --workers 2
