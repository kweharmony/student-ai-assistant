"""
Обёртка над OpenAI Whisper с поддержкой CUDA.

Автоматически использует GPU если:
  - PyTorch установлен с поддержкой CUDA
  - На компьютере есть NVIDIA GPU
  - В конфиге DEVICE="auto" или DEVICE="cuda"

Если GPU нет — работает на CPU (медленнее).
"""

import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

# Кеш загруженных моделей: {(model_name, device): model}
_model_cache: dict = {}


def _resolve_device(device_setting: str) -> str:
    """Определить устройство: auto → cuda или cpu."""
    if device_setting == "cuda":
        return "cuda"
    if device_setting == "cpu":
        return "cpu"
    # auto: проверить наличие CUDA
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def get_model(model_name: str, device_setting: str = "auto"):
    """Загрузить (или взять из кеша) модель Whisper."""
    import whisper

    device = _resolve_device(device_setting)
    cache_key = (model_name, device)

    if cache_key not in _model_cache:
        logger.info(f"Загрузка модели Whisper '{model_name}' на {device.upper()}...")
        _model_cache[cache_key] = whisper.load_model(model_name, device=device)
        logger.info(f"Модель '{model_name}' загружена")

    return _model_cache[cache_key], device


def transcribe(
    file_path: str,
    model_name: str = "base",
    device_setting: str = "auto",
    language: str = "ru",
) -> dict:
    """
    Транскрибировать аудиофайл.

    Возвращает словарь:
    {
        "raw_text": str,
        "language": str,
        "whisper_model": str,
        "processing_time": float,
        "device_used": str,  # "cpu" или "cuda"
    }
    """
    model, device = get_model(model_name, device_setting)

    logger.info(f"Транскрибация {file_path} (модель={model_name}, устройство={device})...")
    start = time.time()

    result = model.transcribe(
        file_path,
        language=language,
        task="transcribe",
        fp16=(device == "cuda"),  # fp16 только на GPU
        verbose=False,
    )

    processing_time = time.time() - start
    logger.info(f"Транскрибация завершена за {processing_time:.1f}с")

    return {
        "raw_text": result["text"],
        "language": result.get("language", language),
        "whisper_model": model_name,
        "processing_time": round(processing_time, 1),
        "device_used": device,
    }
