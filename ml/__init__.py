"""
ML модуль для обработки текста студенческих лекций
Использует Google Gemini API для создания конспектов, извлечения терминов и других задач
"""

from .gemini_processor import GeminiProcessor, quick_process
from .prompts import PROMPTS, PROCESSING_CONFIGS

__version__ = "1.0.0"
__author__ = "Student AI Assistant Team"

# Экспортируем основные классы и функции
__all__ = [
    "GeminiProcessor",
    "quick_process", 
    "PROMPTS",
    "PROCESSING_CONFIGS"
]