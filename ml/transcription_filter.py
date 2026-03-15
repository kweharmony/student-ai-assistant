"""
AI-фильтратор для очистки транскрибированного текста
Переписан для работы с DeepSeek API через VseLLM провайдер

Этот модуль отвечает ТОЛЬКО за исправление ошибок транскрибации
"""

import os
import logging
import asyncio
from typing import Optional, List
from openai import OpenAI, AsyncOpenAI
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
    Класс для фильтрации и очистки транскрибированного текста через DeepSeek API
    
    ОТЛИЧИЕ от DeepSeekProcessor (обработка конспектов):
    - DeepSeekProcessor: создаёт конспекты, термины, вопросы (структурирует)
    - TranscriptionFilter: только исправляет ошибки распознавания речи
    """
    
    def __init__(self):
        """Инициализация клиента DeepSeek для фильтрации"""
        # API ключ и настройки
        self.api_key = os.getenv('DEEPSEEK_API_KEY')
        self.base_url = os.getenv('DEEPSEEK_BASE_URL', 'https://api.vsellm.ru/v1')
        self.model_name = os.getenv('DEEPSEEK_MODEL', 'deepseek/deepseek-v3.2')
        
        logger.info(f"🔍 Base URL: {self.base_url}")
        logger.info(f"📌 Используемая модель фильтратора: {self.model_name}")
        
        if not self.api_key:
            raise ValueError("DEEPSEEK_API_KEY не найден в переменных окружения!")
        
        # Инициализируем OpenAI-compatible клиент
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )
        self.async_client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )
        
        logger.info(f"✅ TranscriptionFilter инициализирован через DeepSeek API")
    
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
                
                # Генерация с настройками из конфига
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": FILTER_SYSTEM_PROMPT},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=TRANSCRIPTION_FILTER_CONFIG["temperature"],
                    max_tokens=TRANSCRIPTION_FILTER_CONFIG["max_tokens"],
                    top_p=TRANSCRIPTION_FILTER_CONFIG["top_p"]
                )
                
                # Получаем отфильтрованный текст
                filtered_text = response.choices[0].message.content.strip()
                
                logger.info(f"✅ Фильтрация завершена. Результат: {len(filtered_text)} символов")
                logger.info(f"📊 Изменение размера: {len(transcribed_text)} → {len(filtered_text)} ({len(filtered_text) - len(transcribed_text):+d})")
                logger.info(f"📝 Первые 150 символов ПОСЛЕ фильтрации: {filtered_text[:150]}")
                
                # Проверяем, изменился ли текст
                if transcribed_text.strip() == filtered_text.strip():
                    logger.warning("⚠️ ПРЕДУПРЕЖДЕНИЕ: Текст не изменился после фильтрации! Возможно, текст уже был чистым.")
                
                return filtered_text
                
            except Exception as e:
                error_message = str(e)
                
                # Проверяем тип ошибки
                if "503" in error_message or "overloaded" in error_message.lower() or "rate_limit" in error_message.lower():
                    if attempt < max_retries - 1:
                        wait_time = (attempt + 1) * 5  # Увеличивающаяся задержка: 5, 10, 15 секунд
                        logger.warning(f"⚠️ API перегружен или rate limit. Ждем {wait_time}с перед повторной попыткой...")
                        time.sleep(wait_time)
                        continue
                    else:
                        logger.error(f"❌ API недоступен после {max_retries} попыток")
                elif "timeout" in error_message.lower():
                    logger.error(f"❌ Таймаут запроса к API (попытка {attempt + 1}/{max_retries})")
                    if attempt < max_retries - 1:
                        logger.info("⏳ Повторная попытка через 3 секунды...")
                        time.sleep(3)
                        continue
                else:
                    logger.error(f"❌ Ошибка фильтрации: {error_message}")
                
                # Если это последняя попытка
                if attempt == max_retries - 1:
                    logger.warning("⚠️ Возвращаем оригинальный текст без фильтрации")
                    return transcribed_text
        
        # Если все попытки исчерпаны
        logger.warning("⚠️ Все попытки исчерпаны. Возвращаем оригинальный текст")
        return transcribed_text

    def _chunk_text(self, text: str, chunk_size: int = 4000) -> List[str]:
        """Разделяет текст на логические части по символам перевода строки, точкам или пробелам"""
        chunks = []
        current_idx = 0
        text_len = len(text)
        
        while current_idx < text_len:
            end_idx = min(current_idx + chunk_size, text_len)
            
            if end_idx < text_len:
                # Ищем последнюю логическую границу (перенос, точка или просто пробел)
                good_break = text.rfind('\n', current_idx, end_idx)
                if good_break == -1 or good_break < current_idx + (chunk_size // 2):
                    good_break = text.rfind('. ', current_idx, end_idx)
                if good_break == -1 or good_break < current_idx + (chunk_size // 2):
                    good_break = text.rfind(' ', current_idx, end_idx)
                
                if good_break != -1 and good_break > current_idx + (chunk_size // 2):
                    end_idx = good_break + 1
            
            chunks.append(text[current_idx:end_idx].strip())
            current_idx = end_idx
            
        return [c for c in chunks if c]

    async def _process_chunk_async(self, chunk: str, index: int, total: int, max_retries: int) -> str:
        """Асинхронно фильтрует отдельный чанк"""
        # Если чанк слишком маленький
        if len(chunk) < 10:
            return chunk
            
        for attempt in range(max_retries):
            try:
                prompt = TRANSCRIPTION_FILTER_PROMPT.format(text=chunk)
                logger.info(f"🔄 Чанк {index+1}/{total} | Размер: {len(chunk)} | Попытка {attempt + 1}")
                
                response = await self.async_client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": FILTER_SYSTEM_PROMPT},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=TRANSCRIPTION_FILTER_CONFIG["temperature"],
                    max_tokens=TRANSCRIPTION_FILTER_CONFIG["max_tokens"],
                    top_p=TRANSCRIPTION_FILTER_CONFIG["top_p"]
                )
                
                result = response.choices[0].message.content.strip()
                logger.info(f"✅ Чанк {index+1}/{total} готов.")
                return result
                
            except Exception as e:
                error_message = str(e)
                if "503" in error_message or "overloaded" in error_message.lower() or "rate_limit" in error_message.lower():
                    wait_time = (attempt + 1) * 3
                    logger.warning(f"⚠️ API перегружен (Чанк {index+1}/{total}). Ждем {wait_time}с...")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"❌ Ошибка (Чанк {index+1}/{total}): {error_message}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(2)
        
        logger.warning(f"⚠️ Чанк {index+1}/{total} не отфильтровался из-за ошибок. Оставляем оригинал.")
        return chunk

    async def filter_text_async(self, transcribed_text: str, max_retries: int = 3, chunk_size: int = 4000) -> str:
        """
        Асинхронная фильтрация длинного текста с разбиением на чанки.
        Позволяет обрабатывать транскрибацию параллельно, ускоряя процесс в разы.
        """
        if not transcribed_text or len(transcribed_text.strip()) < 10:
            return transcribed_text
            
        # Разбиваем текст на чанки
        chunks = self._chunk_text(transcribed_text, chunk_size)
        total_chunks = len(chunks)
        
        logger.info(f"🧩 Текст разбит на {total_chunks} частей (размер чанка ~{chunk_size} симв). Начинаем параллельную обработку...")

        if total_chunks == 1:
            return await self._process_chunk_async(chunks[0], 0, 1, max_retries)

        # Запускаем параллельную обработку всех фрагментов
        tasks = [
            self._process_chunk_async(chunk, i, total_chunks, max_retries)
            for i, chunk in enumerate(chunks)
        ]
        
        results = await asyncio.gather(*tasks)
        
        # Соединяем
        final_text = "\n\n".join(results)
        logger.info("✅ Асинхронная (параллельная) фильтрация успешно завершена!")
        return final_text
    
    def health_check(self) -> bool:
        """Проверка работоспособности API"""
        try:
            # Простой тест с коротким текстом
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "user", "content": "Исправь ошибки: Привет ето тест"}
                ],
                max_tokens=50,
                temperature=0.1
            )
            return bool(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"❌ Health check failed: {e}")
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
    
    print("🧪 Тестирование TranscriptionFilter с DeepSeek")
    print("=" * 60)
    print("Оригинал:")
    print(test_text)
    print("\n" + "=" * 60)
    
    filtered = quick_filter(test_text)
    
    print("Отфильтровано:")
    print(filtered)
