"""
Скрипт для загрузки модели Whisper в директорию проекта (whisper_models/)
"""

import whisper
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WHISPER_MODELS_DIR = PROJECT_ROOT / "whisper_models"

MODELS = {
    "tiny": "~75 MB",
    "base": "~150 MB",
    "small": "~500 MB",
    "medium": "~1.5 GB",
    "large": "~3 GB",
}


def is_model_downloaded(model_name: str) -> bool:
    """Проверяет, скачана ли модель"""
    if not WHISPER_MODELS_DIR.exists():
        return False
    # Whisper сохраняет модели как .pt файлы
    expected = WHISPER_MODELS_DIR / f"{model_name}.pt"
    return expected.exists()


def download_whisper_model(model_name: str = "medium") -> bool:
    """Загружает модель Whisper в whisper_models/ внутри проекта"""
    if model_name not in MODELS:
        print(f"Неизвестная модель: {model_name}. Доступные: {', '.join(MODELS)}")
        return False

    if is_model_downloaded(model_name):
        print(f"Модель '{model_name}' уже скачана в {WHISPER_MODELS_DIR}")
        return True

    print(f"Загрузка модели '{model_name}' ({MODELS[model_name]})...")
    print(f"Директория: {WHISPER_MODELS_DIR}")

    try:
        WHISPER_MODELS_DIR.mkdir(exist_ok=True)
        whisper.load_model(model_name, download_root=str(WHISPER_MODELS_DIR))
        print(f"Модель '{model_name}' успешно загружена!")
        return True
    except Exception as e:
        print(f"Ошибка загрузки: {e}")
        return False


if __name__ == "__main__":
    model = sys.argv[1] if len(sys.argv) > 1 else "medium"
    success = download_whisper_model(model)
    sys.exit(0 if success else 1)
