"""
Процессор для работы с DeepSeek API через VseLLM провайдер
Использует Multi-Step Generation для обхода лимита в 7k выходных токенов
"""

import os
import re
import logging
import asyncio
from typing import Dict, Optional, List
from openai import OpenAI, AsyncOpenAI
from dotenv import load_dotenv

from .prompts import PROMPTS, PROCESSING_CONFIGS, CHUNKING_PROMPTS

# Загружаем переменные окружения
load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _normalize_math_delimiters(text: str) -> str:
    """
    Приводит все варианты LaTeX-делимитеров к стандарту $...$ / $$...$$,
    который понимают Obsidian, KaTeX и большинство Markdown-рендереров.
    """
    # \[...\] (однострочный и многострочный) → $$...$$
    # (?<!\\) — не матчим \\[, это LaTeX-перенос строки с отступом (например \\[4pt])
    text = re.sub(r'(?<!\\)\\\[([\s\S]+?)\\\]', lambda m: f'$$\n{m.group(1).strip()}\n$$', text)
    # \(...\) → $...$
    text = re.sub(r'\\\((.+?)\\\)', lambda m: f'${m.group(1)}$', text)

    # $A$$B$ (two adjacent inline formulas without space → fake $$) → (A)(B)
    text = re.sub(r'\$([^$\n]+?)\$\$([^$\n]+?)\$', r'(\1)(\2)', text)

    # Within $$...$$ blocks, fix UppercaseLetter$args$ → UppercaseLetter(args)
    # Only modifies the block if the pattern is actually found (conservative).
    def _fix_block(m: re.Match) -> str:
        inner = m.group(1)
        fixed = re.sub(r'([A-Z])\$([^$\n]+?)\$', r'\1(\2)', inner)
        return f'$${fixed}$$' if fixed != inner else m.group(0)
    text = re.sub(r'\$\$([\s\S]+?)\$\$', _fix_block, text)

    _has_latex = re.compile(r'\\[a-zA-Z]+|[\^_]')

    # Голые [ ] на отдельных строках → $$...$$ (многострочный блок)
    def _replace_bare_brackets_multi(m: re.Match) -> str:
        inner = m.group(1).strip()
        if _has_latex.search(inner):
            return f'$$\n{inner}\n$$'
        return m.group(0)
    text = re.sub(r'(?m)^\[\s*\n([\s\S]+?)\n\s*\]$', _replace_bare_brackets_multi, text)

    # [формула] на одной строке → $$формула$$ (LLM иногда пишет [P(X) = \frac{...}{...}])
    def _replace_bare_brackets_inline(m: re.Match) -> str:
        inner = m.group(1).strip()
        if _has_latex.search(inner):
            return f'$$\n{inner}\n$$'
        return m.group(0)
    text = re.sub(r'(?m)^\[([^\[\]\n]+)\]$', _replace_bare_brackets_inline, text)

    # Backtick-обёрнутый LaTeX → $...$  (LLM иногда пишет `\frac{a}{b}` вместо $\frac{a}{b}$)
    def _backtick_to_math(m: re.Match) -> str:
        inner = m.group(1)
        if re.search(r'[\\^_{}]|\\[a-zA-Z]', inner):
            return f'${inner}$'
        return m.group(0)
    text = re.sub(r'`([^`\n]+)`', _backtick_to_math, text)

    # Оборачиваем голые LaTeX-строки в $$...$$
    # Если строка содержит 3+ LaTeX-команд, не имеет $ делимитеров и минимум кириллицы —
    # это скорее всего формула без обёртки. Склеиваем смежные такие строки в один блок.
    # NOTE: _replace_bare_parens убран — он конвертировал (x-a_x) внутри формул
    # в $x-a_x$, что разбивало LaTeX на куски и мешало рендерингу.
    _cyrillic = re.compile(r'[а-яёА-ЯЁ]{3,}')
    _latex_cmd = re.compile(r'\\[a-zA-Z]+')
    _skip_starts = ('#', '|', '>', '-', '*', '+')

    def _is_bare_latex_line(s: str) -> bool:
        if not s or s.startswith(_skip_starts) or '$' in s:
            return False
        if len(_latex_cmd.findall(s)) < 3:
            return False
        if len(_cyrillic.findall(s)) > 1:
            return False
        return True

    lines = text.split('\n')
    out = []
    i = 0
    while i < len(lines):
        trimmed = lines[i].strip()
        if _is_bare_latex_line(trimmed):
            # Собираем все смежные голые LaTeX-строки в один блок
            block = [trimmed]
            j = i + 1
            while j < len(lines) and _is_bare_latex_line(lines[j].strip()):
                block.append(lines[j].strip())
                j += 1
            out.append('$$\n' + '\n'.join(block) + '\n$$')
            i = j
        else:
            out.append(lines[i])
            i += 1
    text = '\n'.join(out)

    return text


class DeepSeekProcessor:
    """
    Stateless процессор для обработки текста через DeepSeek API
    Безопасен для параллельных запросов от нескольких пользователей
    """
    
    def __init__(self):
        """Инициализация клиента DeepSeek через VseLLM"""
        self.api_key = os.getenv('DEEPSEEK_API_KEY')
        self.base_url = os.getenv('DEEPSEEK_BASE_URL', 'https://api.vsellm.ru/v1')
        self.model_name = os.getenv('DEEPSEEK_MODEL', 'deepseek/deepseek-v3.2')
        
        if not self.api_key:
            raise ValueError("DEEPSEEK_API_KEY не найден в переменных окружения!")
        
        # Синхронный клиент для простых запросов
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )
        
        # Асинхронный клиент для параллельных запросов
        self.async_client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )
        
        logger.info(f"✅ DeepSeek клиент инициализирован")
        logger.info(f"📡 Base URL: {self.base_url}")
        logger.info(f"🤖 Модель: {self.model_name}")
    
    def _make_request(self, prompt: str, system_prompt: str, config: Dict) -> str:
        """
        Базовый синхронный запрос к DeepSeek API
        
        Args:
            prompt: Пользовательский промпт
            system_prompt: Системный промпт
            config: Конфигурация (temperature, max_tokens)
        
        Returns:
            Ответ модели
        """
        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=config.get('temperature', 0.3),
                max_tokens=config.get('max_tokens', 6500),
                top_p=config.get('top_p', 0.9)
            )
            
            result = response.choices[0].message.content
            logger.info(f"✅ Успешный запрос к DeepSeek. Токенов: ~{len(result.split())}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Ошибка запроса к DeepSeek API: {str(e)}")
            raise Exception(f"Ошибка DeepSeek API: {str(e)}")
    
    async def _make_async_request(self, prompt: str, system_prompt: str, config: Dict) -> str:
        """
        Базовый асинхронный запрос к DeepSeek API
        Используется для параллельных запросов в Multi-Step Generation
        
        Args:
            prompt: Пользовательский промпт
            system_prompt: Системный промпт
            config: Конфигурация
        
        Returns:
            Ответ модели
        """
        try:
            response = await self.async_client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=config.get('temperature', 0.3),
                max_tokens=config.get('max_tokens', 6500),
                top_p=config.get('top_p', 0.9)
            )
            
            result = response.choices[0].message.content
            logger.info(f"✅ Асинхронный запрос выполнен. Токенов: ~{len(result.split())}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Ошибка асинхронного запроса: {str(e)}")
            raise Exception(f"Ошибка DeepSeek API: {str(e)}")
    
    async def _extract_themes(self, text: str) -> List[str]:
        """
        Шаг 1 Multi-Step: Анализ структуры текста и выделение основных тем
        
        ОПТИМИЗАЦИЯ: Отправляем ВСЮ лекцию для анализа (не пропустим темы)
        
        Args:
            text: Исходный текст лекции (ВЕСЬ!)
        
        Returns:
            Список тем (3-5 штук)
        """
        logger.info("📋 Шаг 1: Анализ структуры всей лекции...")
        
        prompt = CHUNKING_PROMPTS['extract_themes'].format(text=text)  # ВСЯ лекция!
        config = {'temperature': 0.2, 'max_tokens': 1000, 'top_p': 0.85}
        
        response = await self._make_async_request(
            prompt=prompt,
            system_prompt=PROMPTS['system'],
            config=config
        )
        
        # Парсим темы из ответа (ожидаем формат: 1. Тема 1\n2. Тема 2...)
        themes = []
        for line in response.strip().split('\n'):
            line = line.strip()
            if line and (line[0].isdigit() or line.startswith('-')):
                # Убираем номер/маркер и берем текст темы
                theme = line.split('.', 1)[-1].strip() if '.' in line else line.lstrip('- ')
                if theme:
                    themes.append(theme)
        
        logger.info(f"✅ Найдено {len(themes)} тем: {themes}")
        return themes
    
    async def _generate_chunk(self, text: str, theme: str, mode: str, max_tokens: int) -> str:
        """
        Шаг 2 Multi-Step: Генерация конспекта по одной теме
        
        ОПТИМИЗАЦИЯ: Отправляем ВСЮ лекцию, но просим обработать ТОЛЬКО эту тему
        
        Args:
            text: ПОЛНЫЙ текст лекции (не часть!)
            theme: Конкретная тема для фокусировки
            mode: Режим обработки (summarize, detailed_notes, etc.)
            max_tokens: Лимит выходных токенов для этой темы
        
        Returns:
            Часть конспекта по данной теме
        """
        logger.info(f"📝 Шаг 2: Генерация по теме '{theme[:50]}...' (лимит: {max_tokens} токенов)")
        
        # Получаем промпт для конкретной темы
        chunk_prompt = CHUNKING_PROMPTS['generate_chunk'].format(
            text=text,  # ВСЯ лекция!
            theme=theme,
            mode=mode
        )
        
        config = {**PROCESSING_CONFIGS.get(mode, PROCESSING_CONFIGS['summarize'])}
        config['max_tokens'] = max_tokens  # Применяем рассчитанный лимит
        
        result = await self._make_async_request(
            prompt=chunk_prompt,
            system_prompt=PROMPTS['system'],
            config=config
        )
        
        return result
    
    def _merge_chunks(self, chunks: List[str], mode: str) -> str:
        """
        Шаг 3 Multi-Step: Объединение частей в финальный конспект
        
        Args:
            chunks: Список частей конспекта (по одной на тему)
            mode: Режим обработки
        
        Returns:
            Финальный объединенный конспект
        """
        logger.info(f"🔗 Шаг 3: Объединение {len(chunks)} частей...")
        
        # Простое объединение через разделители
        if mode == "summarize":
            # Для конспекта добавляем заголовок
            header = "# 📚 Конспект лекции\n\n"
            separator = "\n\n---\n\n"
            result = header + separator.join(chunks)
        
        elif mode == "extract_terms":
            # Для терминов просто объединяем
            result = "\n\n".join(chunks)
        
        elif mode == "detailed_notes":
            # Для расширенного конспекта добавляем оглавление
            toc = "## 📑 Содержание\n\n"
            toc += "\n".join([f"{i+1}. Раздел {i+1}" for i in range(len(chunks))])
            toc += "\n\n---\n\n"
            result = toc + "\n\n---\n\n".join(chunks)
        
        else:
            # Для остальных режимов - простое объединение
            result = "\n\n".join(chunks)
        
        logger.info(f"✅ Финальный конспект готов. Длина: {len(result)} символов")
        return result
    
    async def _chunked_generation(self, text: str, mode: str) -> str:
        """
        Multi-Step Generation: Генерация большого конспекта по частям
        
        ОПТИМИЗИРОВАННЫЙ АЛГОРИТМ:
        1. Анализируем структуру → выделяем 3-5 тем (отправляем ВСЮ лекцию)
        2. Для каждой темы: отправляем ВСЮ лекцию + фокус на теме
        3. Распределяем бюджет: (общий / кол-во тем) * 1.3 (запас 30%)
        4. НЕ вычитаем токены анализа из бюджета пользователя
        
        Args:
            text: Исходный текст лекции
            mode: Режим обработки
        
        Returns:
            Полный конспект
        """
        logger.info(f"🚀 Запуск Multi-Step Generation (режим: {mode})")
        
        # Получаем бюджет из конфига
        config = PROCESSING_CONFIGS.get(mode, PROCESSING_CONFIGS['summarize'])
        total_budget = config.get('max_tokens', 12000)
        
        logger.info(f"💰 Общий бюджет: {total_budget} токенов")
        
        # Шаг 1: Извлекаем темы (ВСЯ лекция)
        themes = await self._extract_themes(text)
        
        if not themes:
            logger.warning("⚠️ Темы не найдены, используем простую генерацию")
            return await self._simple_generation(text, mode)
        
        # Шаг 2: Распределяем бюджет с запасом 30%
        # Формула: (общий_бюджет / кол-во_тем) * 1.3
        base_tokens_per_theme = total_budget // len(themes)
        tokens_per_theme = int(base_tokens_per_theme * 1.3)  # +30% запас
        
        logger.info(f"📊 Распределение бюджета:")
        logger.info(f"   - Тем найдено: {len(themes)}")
        logger.info(f"   - Базовый расчет: {total_budget} / {len(themes)} = {base_tokens_per_theme} токенов/тему")
        logger.info(f"   - С запасом 30%: {tokens_per_theme} токенов/тему")
        logger.info(f"   - Ожидаемый выход: ~{tokens_per_theme * len(themes)} токенов")
        
        # Шаг 3: Генерируем по каждой теме параллельно
        logger.info(f"🔄 Параллельная генерация {len(themes)} частей...")
        tasks = [
            self._generate_chunk(
                text=text,  # ВСЯ лекция для каждой темы!
                theme=theme,
                mode=mode,
                max_tokens=tokens_per_theme  # Лимит с запасом
            )
            for theme in themes
        ]
        chunks = await asyncio.gather(*tasks)
        
        # Шаг 4: Объединяем результаты
        final_result = self._merge_chunks(chunks, mode)
        
        logger.info(f"✅ Multi-Step Generation завершен")
        logger.info(f"📏 Итоговая длина: {len(final_result)} символов (~{len(final_result.split())} слов)")
        
        return final_result
    
    async def _simple_generation(self, text: str, mode: str) -> str:
        """
        Простая генерация для коротких ответов (без chunking)
        Используется для режимов с ответом <6500 токенов
        
        Args:
            text: Исходный текст
            mode: Режим обработки
        
        Returns:
            Обработанный текст
        """
        logger.info(f"📝 Простая генерация (режим: {mode})")
        
        prompt_template = PROMPTS.get(mode)
        if not prompt_template:
            raise ValueError(f"Неизвестный режим: {mode}")
        
        config = PROCESSING_CONFIGS.get(mode, PROCESSING_CONFIGS['summarize'])
        
        # Форматируем промпт
        formatted_prompt = prompt_template.format(
            text=text,
            max_tokens=config.get('max_tokens', 6500),
            approx_words=int(config.get('max_tokens', 6500) * 0.6)
        )
        
        result = await self._make_async_request(
            prompt=formatted_prompt,
            system_prompt=PROMPTS['system'],
            config=config
        )
        
        return result
    
    async def process_text(self, text: str, mode: str, **kwargs) -> str:
        """
        Основной метод обработки текста
        Автоматически выбирает между chunked и simple generation
        
        Args:
            text: Исходный текст лекции
            mode: Режим обработки
            **kwargs: Дополнительные параметры (topic для expand_topic)
        
        Returns:
            Обработанный текст
        """
        if not text.strip():
            raise ValueError("Текст не может быть пустым!")
        
        # Проверяем режим
        valid_modes = ['summarize', 'extract_terms', 'expand_topic', 
                      'generate_questions', 'detailed_notes', 'cheat_sheet']
        if mode not in valid_modes:
            raise ValueError(f"Неизвестный режим: {mode}. Доступны: {valid_modes}")
        
        logger.info(f"🎯 Обработка текста в режиме '{mode}'. Длина: {len(text)} символов")
        
        # Для expand_topic - специальная обработка
        if mode == "expand_topic":
            topic = kwargs.get('topic')
            if not topic:
                raise ValueError("Для режима expand_topic требуется параметр 'topic'")
            
            context = kwargs.get('context', text[:1000])
            formatted_prompt = PROMPTS['expand_topic'].format(
                topic=topic,
                context=context,
                max_tokens=PROCESSING_CONFIGS['expand_topic']['max_tokens'],
                approx_words=int(PROCESSING_CONFIGS['expand_topic']['max_tokens'] * 0.6)
            )
            
            result = await self._make_async_request(
                prompt=formatted_prompt,
                system_prompt=PROMPTS['system'],
                config=PROCESSING_CONFIGS['expand_topic']
            )
            return _normalize_math_delimiters(result)
        
        # Выбираем стратегию на основе конфига режима
        config = PROCESSING_CONFIGS.get(mode, PROCESSING_CONFIGS['summarize'])
        needs_chunking = config.get('needs_chunking', False)
        max_tokens = config.get('max_tokens', 6500)
        
        logger.info(f"⚙️ Конфигурация режима '{mode}':")
        logger.info(f"   - Лимит токенов: {max_tokens}")
        logger.info(f"   - Multi-Step Generation: {'✅ Да' if needs_chunking else '❌ Нет'}")
        
        if needs_chunking:
            logger.info(f"🔀 Используем Multi-Step Generation (лимит > 7000)")
            result = await self._chunked_generation(text, mode)
        else:
            logger.info(f"⚡ Используем простую генерацию (лимит ≤ 7000)")
            result = await self._simple_generation(text, mode)

        result = _normalize_math_delimiters(result)
        return result
    
    # Удобные методы для каждого режима
    async def summarize(self, text: str) -> str:
        """Создание краткого конспекта"""
        return await self.process_text(text, "summarize")
    
    async def extract_terms(self, text: str) -> str:
        """Извлечение ключевых терминов"""
        return await self.process_text(text, "extract_terms")
    
    async def expand_topic(self, topic: str, context: str) -> str:
        """Расширенное объяснение темы"""
        return await self.process_text(context, "expand_topic", topic=topic, context=context)
    
    async def generate_questions(self, text: str) -> str:
        """Генерация вопросов для самопроверки"""
        return await self.process_text(text, "generate_questions")
    
    async def create_detailed_notes(self, text: str) -> str:
        """Создание расширенного конспекта (с chunking)"""
        return await self.process_text(text, "detailed_notes")
    
    async def create_cheat_sheet(self, text: str) -> str:
        """Создание шпаргалки"""
        return await self.process_text(text, "cheat_sheet")
    
    async def batch_process(self, text: str, modes: List[str]) -> Dict[str, str]:
        """
        Пакетная обработка текста в нескольких режимах
        
        Args:
            text: Исходный текст
            modes: Список режимов
        
        Returns:
            Словарь с результатами
        """
        logger.info(f"📦 Пакетная обработка: {len(modes)} режимов")
        
        results = {}
        tasks = []
        
        for mode in modes:
            tasks.append(self.process_text(text, mode))
        
        # Параллельная обработка всех режимов
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        for mode, response in zip(modes, responses):
            if isinstance(response, Exception):
                logger.error(f"❌ Ошибка в режиме {mode}: {str(response)}")
                results[mode] = f"Ошибка обработки: {str(response)}"
            else:
                results[mode] = response
        
        return results
    
    def health_check(self) -> bool:
        """Проверка работоспособности API"""
        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": "Привет! Это тест."}],
                max_tokens=50,
                temperature=0.1
            )
            
            if response.choices[0].message.content:
                logger.info("✅ DeepSeek API работает корректно")
                return True
            else:
                logger.error("❌ DeepSeek API вернул пустой ответ")
                return False
                
        except Exception as e:
            logger.error(f"❌ Ошибка проверки DeepSeek API: {str(e)}")
            return False


# Утилита для синхронного использования
def sync_process(text: str, mode: str = "summarize", **kwargs) -> str:
    """
    Синхронная обертка для асинхронного процессора
    Для быстрого использования без async/await
    
    Args:
        text: Текст для обработки
        mode: Режим обработки
        **kwargs: Дополнительные параметры
    
    Returns:
        Обработанный текст
    """
    processor = DeepSeekProcessor()
    return asyncio.run(processor.process_text(text, mode, **kwargs))


if __name__ == "__main__":
    # Пример использования
    async def test():
        processor = DeepSeekProcessor()
        
        # Проверяем работоспособность
        if processor.health_check():
            print("✅ DeepSeek API готов к работе!")
            
            # Тестовый текст
            test_text = """
            Квантовая механика — раздел физики, изучающий поведение материи на атомном уровне.
            Принцип неопределенности Гейзенберга утверждает, что невозможно одновременно точно 
            измерить положение и импульс частицы. Квантовая суперпозиция позволяет частице 
            находиться в нескольких состояниях одновременно до момента измерения.
            """
            
            print("\n📝 Тестируем создание конспекта:")
            summary = await processor.summarize(test_text)
            print(summary)
        else:
            print("❌ Проблемы с подключением к DeepSeek API")
    
    asyncio.run(test())
