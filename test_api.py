"""
Тестирование Gemini API для обработки студенческих лекций
Этот файл поможет тебе проверить, что все работает корректно
"""

import os
import sys
import asyncio
from datetime import datetime

# Добавляем путь к нашим модулям
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Импортируем наши классы
try:
    from ml.gemini_processor import GeminiProcessor
except ImportError as e:
    print(f"❌ Ошибка импорта: {e}")
    print("Убедись, что установлены все зависимости: pip install -r requirements.txt")
    sys.exit(1)


def test_basic_functionality():
    """Тестирование базовой функциональности Gemini"""
    print("🔧 Тестирование Gemini API...")
    
    try:
        # Создаем процессор
        processor = GeminiProcessor()
        print("✅ Gemini процессор создан успешно")
        
        # Проверяем здоровье API
        if processor.health_check():
            print("✅ Gemini API доступен и работает")
        else:
            print("❌ Проблемы с Gemini API")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Ошибка инициализации: {e}")
        return False


def test_text_processing():
    """Тестирование обработки текста"""
    print("\n📝 Тестирование обработки текста...")
    
    # Тестовый текст лекции по программированию
    test_lecture = """
    Объектно-ориентированное программирование (ООП) — это парадигма программирования, 
    основанная на концепции объектов, которые могут содержать данные в виде полей 
    (часто называемых атрибутами или свойствами) и код в виде процедур (часто называемых методами).
    
    Основные принципы ООП включают:
    1. Инкапсуляция — сокрытие внутренней реализации объекта от внешнего мира.
    2. Наследование — способность создавать новые классы на основе существующих.
    3. Полиморфизм — способность объектов разных типов отвечать на одни и те же вызовы.
    4. Абстракция — выделение главных характеристик объекта и игнорирование деталей.
    
    В Python класс создается с помощью ключевого слова class. Например:
    class Student:
        def __init__(self, name, age):
            self.name = name
            self.age = age
        
        def study(self):
            return f"{self.name} изучает программирование"
    
    Этот пример демонстрирует создание простого класса с конструктором и методом.
    """
    
    try:
        processor = GeminiProcessor()
        
        # Тест 1: Краткий конспект
        print("\n1️⃣ Тест: Создание конспекта")
        summary = processor.summarize(test_lecture)
        print("📄 Конспект создан:")
        print("-" * 50)
        print(summary)
        
        # Тест 2: Извлечение терминов
        print("\n2️⃣ Тест: Извлечение терминов")
        terms = processor.extract_terms(test_lecture)
        print("📚 Термины извлечены:")
        print("-" * 50)
        print(terms)
        
        # Тест 3: Расширение темы
        print("\n3️⃣ Тест: Расширение темы")
        explanation = processor.expand_topic(
            topic="инкапсуляция", 
            context="Инкапсуляция — сокрытие внутренней реализации объекта от внешнего мира."
        )
        print("🔍 Расширенное объяснение:")
        print("-" * 50)
        print(explanation)
        
        # Тест 4: Генерация вопросов
        print("\n4️⃣ Тест: Генерация вопросов")
        questions = processor.generate_questions(test_lecture)
        print("❓ Вопросы для самопроверки:")
        print("-" * 50)
        print(questions)
        
        print("\n✅ Все тесты обработки текста прошли успешно!")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка при тестировании: {e}")
        return False


def test_batch_processing():
    """Тестирование пакетной обработки"""
    print("\n📦 Тестирование пакетной обработки...")
    
    test_text = """
    Искусственный интеллект (ИИ) — это область компьютерных наук, которая занимается 
    созданием интеллектуальных машин, способных работать и реагировать как люди. 
    Машинное обучение является подмножеством ИИ, которое использует статистические 
    методы для того, чтобы компьютеры могли "учиться" без явного программирования.
    """
    
    try:
        processor = GeminiProcessor()
        
        # Пакетная обработка в нескольких режимах
        modes = ['summarize', 'extract_terms', 'generate_questions']
        results = processor.batch_process(test_text, modes)
        
        print(f"📊 Обработано {len(results)} режимов:")
        for mode, result in results.items():
            print(f"\n🔸 {mode.upper()}:")
            print("-" * 30)
            print(result[:200] + "..." if len(result) > 200 else result)
        
        print("\n✅ Пакетная обработка работает!")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка пакетной обработки: {e}")
        return False


def performance_test():
    """Тест производительности"""
    print("\n⚡ Тест производительности...")
    
    short_text = "Python — это интерпретируемый язык программирования высокого уровня."
    
    try:
        processor = GeminiProcessor()
        
        start_time = datetime.now()
        result = processor.summarize(short_text)
        end_time = datetime.now()
        
        processing_time = (end_time - start_time).total_seconds()
        print(f"⏱️ Время обработки короткого текста: {processing_time:.2f} секунд")
        
        if processing_time < 10:  # Ожидаем, что обработка займет менее 10 секунд
            print("✅ Производительность в норме")
            return True
        else:
            print("⚠️ Обработка занимает слишком много времени")
            return False
            
    except Exception as e:
        print(f"❌ Ошибка теста производительности: {e}")
        return False


def main():
    """Главная функция тестирования"""
    print("🚀 Запуск тестов Gemini ML модуля")
    print("=" * 60)
    
    # Проверяем переменные окружения
    if not os.getenv('GEMINI_API_KEY'):
        print("❌ GEMINI_API_KEY не найден!")
        print("📝 Создай файл .env и добавь туда свой API ключ:")
        print("   GEMINI_API_KEY=your_api_key_here")
        return
    
    tests = [
        ("Базовая функциональность", test_basic_functionality),
        ("Обработка текста", test_text_processing),
        ("Пакетная обработка", test_batch_processing),
        ("Производительность", performance_test)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n📋 {test_name}...")
        if test_func():
            passed += 1
        else:
            print(f"❌ Тест '{test_name}' провален")
    
    print("\n" + "=" * 60)
    print(f"🎯 Результаты: {passed}/{total} тестов пройдено")
    
    if passed == total:
        print("🎉 Все тесты прошли успешно! Gemini готов к работе.")
        print("\n📝 Следующие шаги:")
        print("1. Запустить FastAPI сервер: uvicorn api.ml_endpoints:router --reload")
        print("2. Открыть документацию API: http://localhost:8000/docs")
        print("3. Интегрировать с фронтендом React")
    else:
        print("⚠️ Некоторые тесты провалены. Проверь настройки и API ключ.")


if __name__ == "__main__":
    main()