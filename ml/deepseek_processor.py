"""
Основной класс для работы с DeepSeek API
Обрабатывает текст студенческих лекций с помощью LLM
"""

import os
import logging
from typing import Dict, Optional, List
from openai import OpenAI
from dotenv import load_dotenv

from .prompts import PROMPTS, PROCESSING_CONFIGS

# Загружаем переменные окружения
load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DeepSeekProcessor:
    """Класс для обработки текста с помощью DeepSeek API"""
    
    def __init__(self):
        """Инициализация клиента DeepSeek"""
        self.api_key = os.getenv('DEEPSEEK_API_KEY')
        self.base_url = os.getenv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com')
        self.model = os.getenv('DEEPSEEK_MODEL', 'deepseek-chat')
        
        if not self.api_key:
            raise ValueError("DEEPSEEK_API_KEY не найден в переменных окружения!")
        
        # Инициализируем клиент OpenAI с настройками DeepSeek
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )
        
        logger.info(f"DeepSeek клиент инициализирован. Модель: {self.model}")
    
    def _make_request(self, messages: List[Dict], config: Dict) -> str:
        """
        Базовый метод для отправки запроса к DeepSeek API
        
        Args:
            messages: Список сообщений для модели
            config: Конфигурация запроса (temperature, max_tokens, etc.)
        
        Returns:
            Ответ модели в виде текста
        """
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=config.get('max_tokens', 2048),
                temperature=config.get('temperature', 0.3),
                top_p=config.get('top_p', 0.95),
                stream=False
            )
            
            result = response.choices[0].message.content
            logger.info(f"Успешный запрос к DeepSeek. Токенов в ответе: {len(result.split())}")
            return result
            
        except Exception as e:
            logger.error(f"Ошибка при запросе к DeepSeek API: {str(e)}")
            raise Exception(f"Ошибка DeepSeek API: {str(e)}")
    
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
        
        # Форматируем промпт
        if mode == "expand_topic":
            topic = kwargs.get('topic', 'неизвестная тема')
            context = kwargs.get('context', text[:1000])  # Берем первые 1000 символов как контекст
            formatted_prompt = prompt_template.format(topic=topic, context=context)
        else:
            formatted_prompt = prompt_template.format(text=text)
        
        # Подготавливаем сообщения
        messages = [
            {"role": "system", "content": PROMPTS["system"]},
            {"role": "user", "content": formatted_prompt}
        ]
        
        # Отправляем запрос
        logger.info(f"Обрабатываем текст в режиме '{mode}'. Длина текста: {len(text)} сим��олов")
        result = self._make_request(messages, config)
        
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
    
    def create_mindmap(self, text: str) -> str:
        """Создание mind map (карты памяти)"""
        return self.process_text(text, "mindmap")
    
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
            test_response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "user", "content": "Привет! Это тест соединения."}
                ],
                max_tokens=50,
                temperature=0.1
            )
            
            if test_response.choices[0].message.content:
                logger.info("DeepSeek API работает корректно")
                return True
            else:
                logger.error("DeepSeek API вернул пустой ответ")
                return False
                
        except Exception as e:
            logger.error(f"Ошибка проверки DeepSeek API: {str(e)}")
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
    processor = DeepSeekProcessor()
    return processor.process_text(text, mode, **kwargs)


if __name__ == "__main__":
    # Пример использования
    processor = DeepSeekProcessor()
    
    # Проверяем работоспособность
    if processor.health_check():
        print("✅ DeepSeek API готов к работе!")
        
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
        print("❌ Проблемы с подключением к DeepSeek API")