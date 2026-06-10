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
        
        # Лимит выходных токенов. ВАЖНО: max_tokens резервирует место под ответ
        # в контекстном окне модели. Слишком большое значение (напр. 50000) может
        # превышать окно и приводить к пустым/ошибочным ответам. Настраивается через
        # env FILTER_MAX_TOKENS; дефолт консервативный.
        try:
            self.max_tokens = int(os.getenv("FILTER_MAX_TOKENS", str(TRANSCRIPTION_FILTER_CONFIG["max_tokens"])))
        except (TypeError, ValueError):
            self.max_tokens = TRANSCRIPTION_FILTER_CONFIG["max_tokens"]

        # qwen3.5-plus — reasoning-модель: по умолчанию тратит токены на скрытые
        # «рассуждения» (reasoning_tokens) и упирается в таймаут провайдера 300с
        # (408/504). Отключаем thinking, иначе фильтрация не укладывается во время.
        # Управляется env LLM_DISABLE_THINKING (по умолчанию включено отключение).
        self.extra_body: dict = {}
        if os.getenv("LLM_DISABLE_THINKING", "true").lower() in ("1", "true", "yes", "on"):
            self.extra_body = {"chat_template_kwargs": {"enable_thinking": False}}

        # max_retries=0 — у нас собственная retry-логика; встроенные ретраи SDK
        # на таймаутах множат запросы (шторм). timeout — чтобы не висеть все 300с.
        try:
            client_timeout = float(os.getenv("LLM_TIMEOUT", "180"))
        except (TypeError, ValueError):
            client_timeout = 180.0
        client_kwargs = dict(api_key=self.api_key, base_url=self.base_url,
                             max_retries=0, timeout=client_timeout)
        self.client = OpenAI(**client_kwargs)
        self.async_client = AsyncOpenAI(**client_kwargs)

        logger.info(f"✅ TranscriptionFilter инициализирован (max_tokens={self.max_tokens}, "
                    f"thinking={'off' if self.extra_body else 'on'}, timeout={client_timeout}s)")

    @staticmethod
    def _extract_text(response) -> str:
        """
        Достаёт текст ответа модели и логирует диагностику (finish_reason, usage).

        Обрабатывает два случая, из-за которых раньше прилетал пустой результат:
        - content == None (reasoning-модели кладут ответ в reasoning_content);
        - усечение по длине (finish_reason == "length") — видно в логах.
        Возвращает пустую строку, если ответа реально нет (вызывающий решает, что делать).
        """
        choice = response.choices[0] if response.choices else None
        message = getattr(choice, "message", None) if choice else None
        content = (getattr(message, "content", None) or "") if message else ""

        # Fallback на reasoning_content для «думающих» моделей
        if not content.strip() and message is not None:
            content = getattr(message, "reasoning_content", None) or ""

        finish_reason = getattr(choice, "finish_reason", None) if choice else None
        usage = getattr(response, "usage", None)
        logger.info(f"🧾 finish_reason={finish_reason} usage={usage}")
        if finish_reason == "length":
            logger.warning("⚠️ Ответ усечён по длине (finish_reason=length) — увеличьте FILTER_MAX_TOKENS или уменьшите чанк")

        return content.strip()
    
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
        
        prompt = TRANSCRIPTION_FILTER_PROMPT.format(text=transcribed_text)
        logger.info(f"🔄 Начинаем фильтрацию текста ({len(transcribed_text)} символов, max_tokens={self.max_tokens})")

        last_error: Optional[str] = None
        for attempt in range(max_retries):
            if attempt > 0:
                logger.info(f"🔄 Попытка {attempt + 1}/{max_retries}")
            try:
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": FILTER_SYSTEM_PROMPT},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=TRANSCRIPTION_FILTER_CONFIG["temperature"],
                    max_tokens=self.max_tokens,
                    top_p=TRANSCRIPTION_FILTER_CONFIG["top_p"],
                    extra_body=self.extra_body,
                )

                filtered_text = self._extract_text(response)

                # Пустой ответ модели — это сбой (а не повод молча отдать оригинал).
                # Чаще всего: упёрлись в таймаут провайдера (408) или в лимит токенов.
                # Считаем повторяемым: ждём и пробуем ещё раз.
                if not filtered_text:
                    last_error = "пустой ответ модели (0 токенов)"
                    logger.warning(f"⚠️ Пустой ответ модели (попытка {attempt + 1}/{max_retries})")
                    if attempt < max_retries - 1:
                        time.sleep((attempt + 1) * 3)
                        continue
                    break

                logger.info(f"✅ Фильтрация завершена: {len(transcribed_text)} → {len(filtered_text)} символов")
                if transcribed_text.strip() == filtered_text.strip():
                    logger.warning("⚠️ Текст не изменился после фильтрации (возможно, уже был чистым)")
                return filtered_text

            except Exception as e:
                last_error = str(e)
                low = last_error.lower()
                # 408/timeout/перегрузка/rate limit — повторяемые ошибки, ждём с backoff.
                retryable = any(s in low for s in ("timeout", "timed out", "408", "503", "overloaded", "rate_limit", "429"))
                logger.error(f"❌ Ошибка фильтрации (попытка {attempt + 1}/{max_retries}): {last_error}")
                if retryable and attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 5
                    logger.warning(f"⏳ Повторяемая ошибка, ждём {wait_time}с...")
                    time.sleep(wait_time)
                    continue
                break

        # Все попытки исчерпаны — честно сообщаем об ошибке, НЕ подменяем оригиналом.
        raise RuntimeError(f"AI-фильтрация не удалась после {max_retries} попыток: {last_error}")

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
            
        prompt = TRANSCRIPTION_FILTER_PROMPT.format(text=chunk)
        for attempt in range(max_retries):
            try:
                logger.info(f"🔄 Чанк {index+1}/{total} | Размер: {len(chunk)} | Попытка {attempt + 1}")

                response = await self.async_client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": FILTER_SYSTEM_PROMPT},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=TRANSCRIPTION_FILTER_CONFIG["temperature"],
                    max_tokens=self.max_tokens,
                    top_p=TRANSCRIPTION_FILTER_CONFIG["top_p"],
                    extra_body=self.extra_body,
                )

                result = self._extract_text(response)
                if not result:
                    logger.warning(f"⚠️ Чанк {index+1}/{total}: пустой ответ модели (попытка {attempt + 1})")
                    if attempt < max_retries - 1:
                        await asyncio.sleep((attempt + 1) * 3)
                        continue
                    break

                logger.info(f"✅ Чанк {index+1}/{total} готов.")
                return result

            except Exception as e:
                low = str(e).lower()
                retryable = any(s in low for s in ("timeout", "timed out", "408", "503", "overloaded", "rate_limit", "429"))
                logger.error(f"❌ Ошибка (Чанк {index+1}/{total}, попытка {attempt + 1}): {e}")
                if retryable and attempt < max_retries - 1:
                    await asyncio.sleep((attempt + 1) * 3)
                    continue
                break

        # Чанк не отфильтровался — оставляем оригинал, чтобы не терять кусок лекции.
        # (В отличие от filter_text: здесь частичный результат лучше полного провала.)
        logger.warning(f"⚠️ Чанк {index+1}/{total} не отфильтровался — оставляем оригинал")
        return chunk

    async def filter_text_async(self, transcribed_text: str, max_retries: int = 3, chunk_size: int = 6000) -> str:
        """
        Асинхронная фильтрация длинного текста с разбиением на чанки.

        ВАЖНО: размер чанка должен быть таким, чтобы один запрос успевал
        сгенерироваться за таймаут провайдера (300с). ~6000 символов (~1500-2000
        токенов на вход, столько же на выход) — безопасно. Большой chunk_size
        (раньше стоял 150000 = вся лекция в одном запросе) приводит к 408 Timeout.
        Чанки обрабатываются параллельно, поэтому это ещё и быстрее.

        Настраивается через env FILTER_CHUNK_SIZE.
        """
        try:
            chunk_size = int(os.getenv("FILTER_CHUNK_SIZE", str(chunk_size)))
        except (TypeError, ValueError):
            pass
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
