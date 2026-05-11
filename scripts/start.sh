#!/bin/bash
# Скрипт запуска бэкенда: миграции + начальный админ + сервер
set -e

echo "=== Применение миграций БД ==="
alembic upgrade head

echo "=== Создание начального администратора ==="
python -m scripts.seed_admin

echo "=== Запуск FastAPI ==="
# WebSocket rooms are in-memory, so multiple workers break real-time sync.
UVICORN_WORKERS=${UVICORN_WORKERS:-1}
exec uvicorn api.app:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS}

