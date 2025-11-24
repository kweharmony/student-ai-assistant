"""
AI-фильтратор для очистки транскрибированного текста
Отдельный модуль от gemini_processor.py (обработка конспектов)

Этот модуль отвечает ТОЛЬКО за исправление ошибок транскрибации
"""

import os
import logging
from typing import Optional
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from dotenv import load_dotenv
import time
from pathlib import Path

from .filter_prompts import (
    TRANSCRIPTION_FILTER_PROMPT,
    FILTER_SYSTEM_PROMPT,
    TRANSCRIPTION_FILTER_CONFIG
)

# Загружаем переменные окружения из корня проекта
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

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
        # Используем более стабильную модель gemini-1.5-flash вместо экспериментальной
        self.model_name = os.getenv('GEMINI_FILTER_MODEL', 'gemini-1.5-flash')
        
        logger.info(f"🔍 GEMINI_FILTER_MODEL из .env: {os.getenv('GEMINI_FILTER_MODEL')}")
        logger.info(f"📌 Используемая модель фильтратора: {self.model_name}")
        
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
    
    def filter_text(self, transcribed_text: str, max_retries: int = 3) -> str:
        """
        Фильтрует и очищает транскрибированный текст от ошибок
        
        Args:
            transcribed_text: Сырой текст после транскрибации Whisper
            max_retries: Количество попыток при ошибках API (по умолчанию 3)
        
        Returns:
            Очищенный и исправленный текст
        """
        if not transcribed_text or len(transcribed_text.strip()) < 10:
            logger.warning("Текст слишком короткий для фильтрации")
            return transcribed_text
        
        # Retry логика для обработки перегрузки API
        for attempt in range(max_retries):
            try:
                # Формируем промпт
                prompt = TRANSCRIPTION_FILTER_PROMPT.format(text=transcribed_text)
                
                if attempt > 0:
                    logger.info(f"🔄 Попытка {attempt + 1}/{max_retries}")
                
                logger.info(f"🔄 Начинаем фильтрацию текста ({len(transcribed_text)} символов)")
                logger.info(f"📝 Первые 150 символов ДО фильтрации: {transcribed_text[:150]}")
                
                # Генерация с настройками из конфига, таймаутом и отключенными safety фильтрами
                response = self.model.generate_content(
                    prompt,
                    generation_config=genai.GenerationConfig(
                        temperature=TRANSCRIPTION_FILTER_CONFIG["temperature"],
                        max_output_tokens=TRANSCRIPTION_FILTER_CONFIG["max_tokens"],
                        top_p=TRANSCRIPTION_FILTER_CONFIG["top_p"],
                    ),
                    safety_settings={
                        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
                    },
                    request_options={'timeout': 120}  # Таймаут 2 минуты вместо 10
                )
                
                # Проверяем, есть ли текст в ответе
                if not response.parts:
                    logger.error(f"❌ Gemini не вернул текст. Finish reason: {response.candidates[0].finish_reason}")
                    logger.error(f"📋 Safety ratings: {response.candidates[0].safety_ratings}")
                    raise ValueError(f"Контент заблокирован (finish_reason={response.candidates[0].finish_reason})")
                
                filtered_text = response.text.strip()
                
                logger.info(f"✅ Фильтрация завершена. Результат: {len(filtered_text)} символов")
                logger.info(f"📊 Изменение размера: {len(transcribed_text)} → {len(filtered_text)} ({len(filtered_text) - len(transcribed_text):+d})")
                logger.info(f"📝 Первые 150 символов ПОСЛЕ фильтрации: {filtered_text[:150]}")
                
                # Проверяем, изменился ли текст
                if transcribed_text.strip() == filtered_text.strip():
                    logger.warning("⚠️ ПРЕДУПРЕЖДЕНИЕ: Текст не изменился после фильтрации! Возможно, текст уже был чистым или модель вернула то же самое.")
                
                return filtered_text
                
            except Exception as e:
                error_message = str(e)
                
                # Проверяем, является ли это ошибкой перегрузки API
                if "503" in error_message or "overloaded" in error_message.lower():
                    if attempt < max_retries - 1:
                        wait_time = (attempt + 1) * 5  # Увеличивающаяся задержка: 5, 10, 15 секунд
                        logger.warning(f"⚠️ API перегружен. Ждем {wait_time}с перед повторной попыткой...")
                        time.sleep(wait_time)
                        continue
                    else:
                        logger.error(f"❌ API перегружен после {max_retries} попыток")
                elif "timeout" in error_message.lower():
                    logger.error(f"❌ Таймаут запроса к API (попытка {attempt + 1}/{max_retries})")
                    if attempt < max_retries - 1:
                        logger.info("⏳ Повторная попытка через 3 секунды...")
                        time.sleep(3)
                        continue
                else:
                    logger.error(f"❌ Ошибка фильтрации: {error_message}")
                
                # Если это последняя попытка или неизвестная ошибка
                if attempt == max_retries - 1:
                    logger.warning("⚠️ Возвращаем оригинальный текст без фильтрации")
                    return transcribed_text
        
        # Если все попытки исчерпаны
        logger.warning("⚠️ Все попытки исчерпаны. Возвращаем оригинальный текст")
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
