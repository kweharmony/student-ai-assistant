"""
ML модуль для обработки текста студенческих лекций
Использует DeepSeek API для создания конспектов, извлечения терминов и других задач
"""

from .deepseek_processor import DeepSeekProcessor, quick_process
from .prompts import PROMPTS, PROCESSING_CONFIGS

__version__ = "1.0.0"
__author__ = "Student AI Assistant Team"

# Экспортируем основные классы и функции
__all__ = [
    "DeepSeekProcessor",
    "quick_process", 
    "PROMPTS",
    "PROCESSING_CONFIGS"
]