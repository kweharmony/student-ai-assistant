"""
AI-фильтратор для очистки транскрибированного текста
Отдельный модуль от gemini_processor.py (обработка конспектов)

Этот модуль отвечает ТОЛЬКО за исправление ошибок транскрибации
"""

import os
import logging
from typing import Optional
import google.generativeai as genai
from dotenv import load_dotenv

from .filter_prompts import (
    TRANSCRIPTION_FILTER_PROMPT,
    FILTER_SYSTEM_PROMPT,
    TRANSCRIPTION_FILTER_CONFIG
)

# Загружаем переменные окружения
load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TranscriptionFilter:
    """
    Класс для фильтрации и очистки транскрибированного текста
    
    ОТЛИЧИЕ от GeminiProcessor (обработка конспектов):
    - GeminiProcessor: создаёт конспекты, термины, вопросы (структурирует)
    - TranscriptionFilter: только исправляет ошибки распознавания речи
    """
    
    def __init__(self):
        """Инициализация клиента Gemini для фильтрации"""
        # Используем отдельные переменные окружения для фильтрации
        # Можно использовать тот же ключ или отдельный
        self.api_key = os.getenv('GEMINI_API_KEY')
        self.model_name = os.getenv('GEMINI_FILTER_MODEL', os.getenv('GEMINI_MODEL', 'gemini-2.0-flash'))
        
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY не найден в переменных окружения!")
        
        # Конфигурируем Gemini API
        genai.configure(api_key=self.api_key)
        
        # Инициализируем модель с системным промптом для фильтрации
        self.model = genai.GenerativeModel(
            self.model_name,
            system_instruction=FILTER_SYSTEM_PROMPT
        )
        
        logger.info(f"TranscriptionFilter инициализирован. Модель: {self.model_name}")
    
    def filter_text(self, transcribed_text: str) -> str:
        """
        Фильтрует и очищает транскрибированный текст от ошибок
        
        Args:
            transcribed_text: Сырой текст после транскрибации Whisper
        
        Returns:
            Очищенный и исправленный текст
        """
        if not transcribed_text or len(transcribed_text.strip()) < 10:
            logger.warning("Текст слишком короткий для фильтрации")
            return transcribed_text
        
        try:
            # Формируем промпт
            prompt = TRANSCRIPTION_FILTER_PROMPT.format(text=transcribed_text)
            
            logger.info(f"🔄 Начинаем фильтрацию текста ({len(transcribed_text)} символов)")
            
            # Генерация с настройками из конфига
            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=TRANSCRIPTION_FILTER_CONFIG["temperature"],
                    max_output_tokens=TRANSCRIPTION_FILTER_CONFIG["max_tokens"],
                    top_p=TRANSCRIPTION_FILTER_CONFIG["top_p"],
                )
            )
            
            filtered_text = response.text.strip()
            
            logger.info(f"✅ Фильтрация завершена. Результат: {len(filtered_text)} символов")
            logger.info(f"📊 Изменение размера: {len(transcribed_text)} → {len(filtered_text)} ({len(filtered_text) - len(transcribed_text):+d})")
            
            return filtered_text
            
        except Exception as e:
            logger.error(f"❌ Ошибка фильтрации: {str(e)}")
            # В случае ошибки возвращаем оригинальный текст
            logger.warning("⚠️ Возвращаем оригинальный текст без фильтрации")
            return transcribed_text
    
    def health_check(self) -> bool:
        """Проверка работоспособности API"""
        try:
            # Простой тест с коротким текстом
            test_text = "Привет это тест фильтра"
            response = self.model.generate_content(
                f"Исправь ошибки: {test_text}",
                generation_config=genai.GenerationConfig(max_output_tokens=50)
            )
            return bool(response.text)
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False


# Вспомогательная функция для быстрой фильтрации
def quick_filter(text: str) -> str:
    """
    Быстрая фильтрация текста без создания экземпляра класса
    
    Args:
        text: Транскрибированный текст
    
    Returns:
        Отфильтрованный текст
    """
    filter_instance = TranscriptionFilter()
    return filter_instance.filter_text(text)


if __name__ == "__main__":
    # Тест фильтра
    test_text = """
    эээ сегодня мы рассмотрим масинное абучение это очень важная тема 
    нейроные сети используются для распознавания образов ну вот 
    первое это перцептрон второе это свёрточные сети короче
    они работают следующим образом обрабатывают изображения изображения
    """
    
    print("🧪 Тестирование TranscriptionFilter")
    print("=" * 60)
    print("Оригинал:")
    print(test_text)
    print("\n" + "=" * 60)
    
    filtered = quick_filter(test_text)
    
    print("Отфильтровано:")
    print(filtered)
