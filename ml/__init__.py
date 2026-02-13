"""
ML модуль для обработки текста студенческих лекций

РАЗДЕЛЕНИЕ ФУНКЦИОНАЛА:

1. deepseek_processor.py - AI-обработка конспектов через DeepSeek API
   - Создание конспектов
   - Извлечение терминов
   - Генерация вопросов
   - Расширение тем
   - Подробные заметки (Multi-Step Generation)
   - Шпаргалки

2. transcription_filter.py - AI-фильтрация транскрибаций
   - Исправление ошибок распознавания речи
   - Улучшение читаемости
   - Форматирование текста
   - Удаление фраз-паразитов
"""

from .deepseek_processor import DeepSeekProcessor, sync_process
from .transcription_filter import TranscriptionFilter, quick_filter
from .prompts import PROMPTS, PROCESSING_CONFIGS, CHUNKING_PROMPTS

__version__ = "3.0.0"
__author__ = "Student AI Assistant Team"

# Экспортируем основные классы и функции
__all__ = [
    # Обработка конспектов (DeepSeek)
    "DeepSeekProcessor",
    "sync_process",
    
    # Фильтрация транскрибаций
    "TranscriptionFilter",
    "quick_filter",
    
    # Конфигурации
    "PROMPTS",
    "PROCESSING_CONFIGS",
    "CHUNKING_PROMPTS"
]