"""
Основной класс для работы с Google Gemini API
Обрабатывает текст студенческих лекций с помощью LLM
"""

import os
import logging
from typing import Dict, Optional, List
import google.generativeai as genai
from dotenv import load_dotenv

from .prompts import PROMPTS, PROCESSING_CONFIGS

# Загружаем переменные окружения
load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GeminiProcessor:
    """Класс для обработки текста с помощью Google Gemini API"""
    
    def __init__(self):
        """Инициализация клиента Gemini"""
        self.api_key = os.getenv('GEMINI_API_KEY')
        self.model_name = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash-exp')
        
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY не найден в переменных окружения!")
        
        # Конфигурируем Gemini API
        genai.configure(api_key=self.api_key)
        
        # Инициализируем модель
        self.model = genai.GenerativeModel(self.model_name)
        
        logger.info(f"Gemini клиент инициализирован. Модель: {self.model_name}")
    
    def _make_request(self, prompt: str, config: Dict) -> str:
        """
        Базовый метод для отправки запроса к Gemini API
        
        Args:
            prompt: Полный промпт для модели
            config: Конфигурация запроса (temperature, max_tokens, etc.)
        
        Returns:
            Ответ модели в виде текста
        """
        try:
            # Настройки генерации для Gemini
            generation_config = {
                'temperature': config.get('temperature', 0.3),
                'top_p': config.get('top_p', 0.95),
                'top_k': config.get('top_k', 40),
                'max_output_tokens': config.get('max_tokens', 2048),
            }
            
            # Отправляем запрос
            response = self.model.generate_content(
                prompt,
                generation_config=generation_config
            )
            
            result = response.text
            logger.info(f"Успешный запрос к Gemini. Токенов в ответе: {len(result.split())}")
            return result
            
        except Exception as e:
            logger.error(f"Ошибка при запросе к Gemini API: {str(e)}")
            raise Exception(f"Ошибка Gemini API: {str(e)}")
    
    def process_text(self, text: str, mode: str, **kwargs) -> str:
        """
        Основной метод обработки текста
        
        Args:
            text: Исходный текст лекции
            mode: Режим обработки ('summarize', 'extract_terms', 'expand_topic', etc.)
            **kwargs: Дополнительные параметры (например, topic для expand_topic)
        
        Returns:
            Обработанный текст
        """
        if mode not in PROMPTS:
            raise ValueError(f"Неизвестный режим: {mode}. Доступны: {list(PROMPTS.keys())}")
        
        if not text.strip():
            raise ValueError("Текст не может быть пустым!")
        
        # Получаем промпт и конфигурацию
        prompt_template = PROMPTS[mode]
        config = PROCESSING_CONFIGS.get(mode, PROCESSING_CONFIGS['summarize'])
        
        # Получаем max_tokens для этого режима
        max_tokens = config.get('max_tokens', 8192)
        approx_words = int(max_tokens * 0.6)  # ~60% от токенов для русского языка
        
        # Форматируем промпт с параметрами токенов
        if mode == "expand_topic":
            topic = kwargs.get('topic', 'неизвестная тема')
            context = kwargs.get('context', text[:1000])  # Берем первые 1000 символов как контекст
            formatted_prompt = prompt_template.format(
                topic=topic, 
                context=context,
                max_tokens=max_tokens,
                approx_words=approx_words
            )
        else:
            formatted_prompt = prompt_template.format(
                text=text,
                max_tokens=max_tokens,
                approx_words=approx_words
            )
        
        # Комбинируем системный промпт с пользовательским
        full_prompt = f"{PROMPTS['system']}\n\n{formatted_prompt}"
        
        # Отправляем запрос
        logger.info(f"Обрабатываем текст в режиме '{mode}'. Длина текста: {len(text)} символов, лимит токенов: {max_tokens}")
        result = self._make_request(full_prompt, config)
        
        return result
    
    def summarize(self, text: str) -> str:
        """Создание краткого конспекта"""
        return self.process_text(text, "summarize")
    
    def extract_terms(self, text: str) -> str:
        """Извлечение ключевых терминов и определений"""
        return self.process_text(text, "extract_terms")
    
    def expand_topic(self, topic: str, context: str) -> str:
        """Расширенное объяснение сложной темы"""
        return self.process_text(context, "expand_topic", topic=topic, context=context)
    
    def generate_questions(self, text: str) -> str:
        """Генерация вопросов для самопроверки"""
        return self.process_text(text, "generate_questions")
    
    def create_detailed_notes(self, text: str) -> str:
        """Создание расширенного конспекта с подробным описанием всех терминов"""
        return self.process_text(text, "detailed_notes")

    def create_cheat_sheet(self, text: str) -> str:
        """Создание краткой шпаргалки по лекции"""
        return self.process_text(text, "cheat_sheet")
    
    def batch_process(self, text: str, modes: List[str]) -> Dict[str, str]:
        """
        Обработка текста в нескольких режимах одновременно
        
        Args:
            text: Исходный текст
            modes: Список режимов обработки
        
        Returns:
            Словарь с результатами обработки
        """
        results = {}
        
        for mode in modes:
            try:
                logger.info(f"Обрабатываем режим: {mode}")
                results[mode] = self.process_text(text, mode)
            except Exception as e:
                logger.error(f"Ошибка при обработке режима {mode}: {str(e)}")
                results[mode] = f"Ошибка обработки: {str(e)}"
        
        return results
    
    def health_check(self) -> bool:
        """Проверка работоспособности API"""
        try:
            test_response = self.model.generate_content(
                "Привет! Это тест соединения.",
                generation_config={'max_output_tokens': 50, 'temperature': 0.1}
            )
            
            if test_response.text:
                logger.info("Gemini API работает корректно")
                return True
            else:
                logger.error("Gemini API вернул пустой ответ")
                return False
                
        except Exception as e:
            logger.error(f"Ошибка проверки Gemini API: {str(e)}")
            return False


# Функция-утилита для быстрого использования
def quick_process(text: str, mode: str = "summarize", **kwargs) -> str:
    """
    Быстрая обработка текста без создания экземпляра класса
    
    Args:
        text: Текст для обработки
        mode: Режим обработки
        **kwargs: Дополнительные параметры
    
    Returns:
        Обработанный текст
    """
    processor = GeminiProcessor()
    return processor.process_text(text, mode, **kwargs)


if __name__ == "__main__":
    # Пример использования
    processor = GeminiProcessor()
    
    # Проверяем работоспособность
    if processor.health_check():
        print("✅ Gemini API готов к работе!")
        
        # Тестовый текст лекции
        test_text = """
        Квантовая механика — это раздел физики, изучающий поведение материи и энергии на атомном и субатомном уровне. 
        В отличие от классической физики, квантовая механика описывает мир вероятностей, где частицы могут находиться 
        в нескольких состояниях одновременно до момента измерения. Принцип суперпозиции является одним из 
        фундаментальных принципов квантовой механики.
        """
        
        print("\n📝 Тестируем создание конспекта:")
        summary = processor.summarize(test_text)
        print(summary)
        
    else:
        print("❌ Проблемы с подключением к Gemini API")