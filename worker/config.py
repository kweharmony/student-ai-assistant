"""
Конфигурация воркера.

Порядок приоритетов:
1. Переменные окружения (наивысший приоритет)
2. config.json рядом с этим файлом
3. Значения по умолчанию

Запуск с кастомными настройками:
  SERVER_URL=https://example.com API_KEY=mykey python tray_app.py
"""

import json
import os
import socket
from pathlib import Path

CONFIG_FILE = Path(__file__).parent / "config.json"

DEFAULTS = {
    "SERVER_URL": "http://localhost:8000",
    "API_KEY": "",
    "WORKER_NAME": socket.gethostname(),
    "WHISPER_MODEL": "base",
    "DEVICE": "auto",        # auto | cpu | cuda
    "POLL_INTERVAL": 30,     # секунд между опросами сервера
}


def load_config() -> dict:
    """Загрузить конфигурацию: defaults → config.json → env."""
    cfg = dict(DEFAULTS)

    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, encoding="utf-8") as f:
                file_cfg = json.load(f)
            cfg.update(file_cfg)
        except (json.JSONDecodeError, OSError):
            pass

    # Переменные окружения перекрывают файл
    for key in cfg:
        env_val = os.environ.get(key)
        if env_val is not None:
            # Сохраняем тип (int для POLL_INTERVAL)
            if isinstance(cfg[key], int):
                try:
                    cfg[key] = int(env_val)
                except ValueError:
                    pass
            else:
                cfg[key] = env_val

    return cfg


def save_config(cfg: dict) -> None:
    """Сохранить конфигурацию в config.json (только поля из DEFAULTS)."""
    to_save = {k: v for k, v in cfg.items() if k in DEFAULTS}
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(to_save, f, ensure_ascii=False, indent=2)
