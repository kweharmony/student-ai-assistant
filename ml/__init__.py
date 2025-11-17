"""
ML модуль для обработки текста студенческих лекций

РАЗДЕЛЕНИЕ ФУНКЦИОНАЛА:

1. gemini_processor.py - AI-обработка конспектов
   - Создание конспектов
   - Извлечение терминов
   - Генерация вопросов
   - Расширение тем
   - Подробные заметки
   - Шпаргалки

2. transcription_filter.py - AI-фильтрация транскрибаций
   - Исправление ошибок распознавания речи
   - Улучшение читаемости
   - Форматирование текста
   - Удаление фраз-паразитов
"""

from .gemini_processor import GeminiProcessor, quick_process
from .transcription_filter import TranscriptionFilter, quick_filter
from .prompts import PROMPTS, PROCESSING_CONFIGS

__version__ = "2.0.0"
__author__ = "Student AI Assistant Team"

# Экспортируем основные классы и функции
__all__ = [
    # Обработка конспектов
    "GeminiProcessor",
    "quick_process",
    
    # Фильтрация транскрибаций
    "TranscriptionFilter",
    "quick_filter",
    
    # Конфигурации
    "PROMPTS",
    "PROCESSING_CONFIGS"
]