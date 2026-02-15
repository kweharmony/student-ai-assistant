"""
ОПТИМИЗИРОВАННАЯ версия DeepSeek процессора с контролем расхода токенов

УЛУЧШЕНИЯ:
1. Отправляем только РЕЛЕВАНТНУЮ часть текста для каждой темы (не весь текст)
2. Контролируем общий лимит выходных токенов
3. Уменьшаем расход в 2-3 раза
"""

import os
import logging
import asyncio
from typing import Dict, Optional, List, Tuple
from openai import OpenAI, AsyncOpenAI
from dotenv import load_dotenv

from .prompts import PROMPTS, PROCESSING_CONFIGS, CHUNKING_PROMPTS

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DeepSeekProcessorOptimized:
    """
    Оптимизированный процессор с контролем расхода токенов
    """
    
    def __init__(self):
        self.api_key = os.getenv('DEEPSEEK_API_KEY')
        self.base_url = os.getenv('DEEPSEEK_BASE_URL', 'https://api.vsellm.ru/v1')
        self.model_name = os.getenv('DEEPSEEK_MODEL', 'deepseek/deepseek-v3.2')
        
        if not self.api_key:
            raise ValueError("DEEPSEEK_API_KEY не найден!")
        
        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        self.async_client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        
        logger.info(f"✅ Оптимизированный DeepSeek процессор инициализирован")
    
    def _split_text_by_themes(self, text: str, themes: List[str]) -> Dict[str, str]:
        """
        ОПТИМИЗАЦИЯ: Разделяем текст на части по темам
        Отправляем только релевантную часть, а не весь текст
        
        Args:
            text: Полный текст
            themes: Список тем
        
        Returns:
            Словарь {тема: релевантная_часть_текста}
        """
        # Простейшее разделение: делим текст на N равных частей
        # В идеале можно использовать semantic search, но это усложнит
        
        text_length = len(text)
        chunk_size = text_length // len(themes)
        
        theme_texts = {}
        for i, theme in enumerate(themes):
            start = i * chunk_size
            end = (i + 1) * chunk_size if i < len(themes) - 1 else text_length
            
            # Добавляем немного overlap для контекста (10%)
            overlap = int(chunk_size * 0.1)
            start_with_overlap = max(0, start - overlap)
            end_with_overlap = min(text_length, end + overlap)
            
            theme_texts[theme] = text[start_with_overlap:end_with_overlap]
        
        logger.info(f"📄 Текст разделен на {len(themes)} частей. "
                   f"Средний размер части: {chunk_size} символов (vs {text_length} полный текст)")
        
        return theme_texts
    
    async def _generate_chunk_optimized(
        self, 
        text_chunk: str,  # ТОЛЬКО релевантная часть!
        theme: str, 
        mode: str,
        max_tokens: int  # Контролируем лимит
    ) -> str:
        """
        Генерация с контролем токенов
        
        Args:
            text_chunk: ТОЛЬКО релевантная часть текста (не весь!)
            theme: Тема
            mode: Режим
            max_tokens: Лимит выходных токенов
        """
        logger.info(f"📝 Генерация по теме '{theme[:30]}...' "
                   f"(текст: {len(text_chunk)} символов, лимит: {max_tokens} токенов)")
        
        chunk_prompt = CHUNKING_PROMPTS['generate_chunk'].format(
            text=text_chunk,  # Только часть текста!
            theme=theme,
            mode=mode
        )
        
        config = PROCESSING_CONFIGS.get(mode, PROCESSING_CONFIGS['summarize'])
        config['max_tokens'] = max_tokens  # Применяем лимит
        
        response = await self.async_client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": PROMPTS['system']},
                {"role": "user", "content": chunk_prompt}
            ],
            temperature=config.get('temperature', 0.3),
            max_tokens=max_tokens,
            top_p=config.get('top_p', 0.9)
        )
        
        return response.choices[0].message.content
    
    async def _chunked_generation_optimized(
        self, 
        text: str, 
        mode: str,
        total_token_budget: int = 15000  # Общий бюджет
    ) -> str:
        """
        ОПТИМИЗИРОВАННАЯ Multi-Step Generation с контролем расхода
        
        Args:
            text: Исходный текст
            mode: Режим
            total_token_budget: Общий лимит выходных токенов
        """
        logger.info(f"🚀 Оптимизированный chunking (бюджет: {total_token_budget} токенов)")
        
        # Шаг 1: Анализ структуры (резервируем 1000 токенов)
        themes_prompt = CHUNKING_PROMPTS['extract_themes'].format(text=text[:5000])  # Берем начало
        
        response = await self.async_client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": PROMPTS['system']},
                {"role": "user", "content": themes_prompt}
            ],
            temperature=0.2,
            max_tokens=1000
        )
        
        themes_text = response.choices[0].message.content
        themes = [line.split('.', 1)[-1].strip() 
                 for line in themes_text.strip().split('\n') 
                 if line.strip() and (line[0].isdigit() or line.startswith('-'))]
        
        if not themes:
            logger.warning("⚠️ Темы не найдены, используем simple generation")
            return await self._simple_generation(text, mode)
        
        logger.info(f"✅ Найдено {len(themes)} тем")
        
        # Шаг 2: ОПТИМИЗАЦИЯ - разделяем текст на части
        theme_texts = self._split_text_by_themes(text, themes)
        
        # Шаг 3: Распределяем оставшиеся токены между темами
        remaining_budget = total_token_budget - 1000  # Вычли анализ структуры
        tokens_per_theme = remaining_budget // len(themes)
        
        logger.info(f"💰 Распределение: {tokens_per_theme} токенов на тему "
                   f"(всего тем: {len(themes)})")
        
        # Шаг 4: Генерируем параллельно
        tasks = [
            self._generate_chunk_optimized(
                text_chunk=theme_texts[theme],  # ТОЛЬКО часть!
                theme=theme,
                mode=mode,
                max_tokens=tokens_per_theme
            )
            for theme in themes
        ]
        chunks = await asyncio.gather(*tasks)
        
        # Шаг 5: Объединяем
        final_result = "\n\n---\n\n".join(chunks)
        
        logger.info(f"✅ Оптимизированный chunking завершен. "
                   f"Итоговая длина: {len(final_result)} символов")
        
        return final_result
    
    async def _simple_generation(self, text: str, mode: str) -> str:
        """Простая генерация без chunking"""
        prompt_template = PROMPTS.get(mode)
        if not prompt_template:
            raise ValueError(f"Неизвестный режим: {mode}")
        
        config = PROCESSING_CONFIGS.get(mode, PROCESSING_CONFIGS['summarize'])
        
        formatted_prompt = prompt_template.format(
            text=text,
            max_tokens=config.get('max_tokens', 6500),
            approx_words=int(config.get('max_tokens', 6500) * 0.6)
        )
        
        response = await self.async_client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": PROMPTS['system']},
                {"role": "user", "content": formatted_prompt}
            ],
            temperature=config.get('temperature', 0.3),
            max_tokens=config.get('max_tokens', 6500),
            top_p=config.get('top_p', 0.9)
        )
        
        return response.choices[0].message.content
    
    async def process_text(
        self, 
        text: str, 
        mode: str,
        max_output_tokens: Optional[int] = None,  # Новый параметр!
        **kwargs
    ) -> str:
        """
        Обработка с контролем расхода токенов
        
        Args:
            text: Исходный текст
            mode: Режим
            max_output_tokens: Максимум выходных токенов (если None - по умолчанию)
        """
        if not text.strip():
            raise ValueError("Текст не может быть пустым!")
        
        # Определяем бюджет
        if max_output_tokens is None:
            # По умолчанию
            if mode == "detailed_notes":
                max_output_tokens = 15000  # Вместо 19500+
            else:
                max_output_tokens = 6500
        
        logger.info(f"🎯 Обработка в режиме '{mode}'. "
                   f"Бюджет: {max_output_tokens} токенов")
        
        # Решаем, нужен ли chunking
        needs_chunking = (
            mode == "detailed_notes" or 
            (mode == "summarize" and len(text) > 15000)
        )
        
        if needs_chunking:
            return await self._chunked_generation_optimized(
                text, mode, total_token_budget=max_output_tokens
            )
        else:
            return await self._simple_generation(text, mode)
    
    # Удобные методы
    async def summarize(self, text: str, max_tokens: int = 10000) -> str:
        """Краткий конспект с контролем токенов"""
        return await self.process_text(text, "summarize", max_output_tokens=max_tokens)
    
    async def create_detailed_notes(self, text: str, max_tokens: int = 15000) -> str:
        """Расширенный конспект с контролем токенов"""
        return await self.process_text(text, "detailed_notes", max_output_tokens=max_tokens)


# Пример использования
if __name__ == "__main__":
    async def test():
        processor = DeepSeekProcessorOptimized()
        
        test_text = "Ваш длинный текст лекции..." * 1000
        
        # Контролируем расход!
        summary = await processor.summarize(test_text, max_tokens=8000)
        print(f"Конспект готов. Длина: {len(summary)} символов")
    
    asyncio.run(test())
