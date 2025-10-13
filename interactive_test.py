"""
Интерактивный тестер ML модуля
Здесь ты можешь добавить свой текст и протестировать все режимы обработки
"""

import os
import sys
from datetime import datetime

# Добавляем путь к модулям
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ml.deepseek_processor import DeepSeekProcessor

def test_custom_text():
    """Тестирование с твоим текстом"""
    
    # 📝 ВСТАВЬ СЮДА СВОЙ ТЕКСТ ЛЕКЦИИ ↓
    your_lecture_text = """
    Машинное обучение — это метод анализа данных, который автоматизирует построение 
    аналитических моделей. Это раздел искусственного интеллекта, основанный на идее, 
    что системы могут обучаться на данных, находить закономерности и принимать решения 
    с минимальным вмешательством человека.
    
    Существует три основных типа машинного обучения:
    1. Обучение с учителем (supervised learning) — использует помеченные данные
    2. Обучение без учителя (unsupervised learning) — находит скрытые структуры в данных
    3. Обучение с подкреплением (reinforcement learning) — учится через взаимодействие со средой
    
    Популярные алгоритмы включают линейную регрессию, случайный лес, нейронные сети и 
    метод опорных векторов. Эти алгоритмы применяются в распознавании изображений, 
    обработке естественного языка, рекомендательных системах и многих других областях.
    """
    
    print("🎓 ИСХОДНЫЙ ТЕКСТ ЛЕКЦИИ:")
    print("=" * 60)
    print(your_lecture_text.strip())
    print("=" * 60)
    
    try:
        # Создаем процессор
        processor = DeepSeekProcessor()
        print("✅ Процессор инициализирован")
        
        # Тест 1: Краткий конспект
        print("\n📄 РЕЖИМ: КРАТКИЙ КОНСПЕКТ")
        print("-" * 40)
        start_time = datetime.now()
        summary = processor.summarize(your_lecture_text)
        time_taken = (datetime.now() - start_time).total_seconds()
        
        print(summary)
        print(f"\n⏱️ Время обработки: {time_taken:.2f} секунд")
        
        # Тест 2: Извлечение терминов
        print("\n📚 РЕЖИМ: ИЗВЛЕЧЕНИЕ ТЕРМИНОВ")
        print("-" * 40)
        start_time = datetime.now()
        terms = processor.extract_terms(your_lecture_text)
        time_taken = (datetime.now() - start_time).total_seconds()
        
        print(terms)
        print(f"\n⏱️ Время обработки: {time_taken:.2f} секунд")
        
        # Тест 3: Расширение сложной темы
        print("\n🔍 РЕЖИМ: РАСШИРЕНИЕ ТЕМЫ 'нейронные сети'")
        print("-" * 40)
        start_time = datetime.now()
        expansion = processor.expand_topic(
            topic="нейронные сети",
            context=your_lecture_text
        )
        time_taken = (datetime.now() - start_time).total_seconds()
        
        print(expansion)
        print(f"\n⏱️ Время обработки: {time_taken:.2f} секунд")
        
        # Тест 4: Генерация вопросов
        print("\n❓ РЕЖИМ: ВОПРОСЫ ДЛЯ САМОПРОВЕРКИ")
        print("-" * 40)
        start_time = datetime.now()
        questions = processor.generate_questions(your_lecture_text)
        time_taken = (datetime.now() - start_time).total_seconds()
        
        print(questions)
        print(f"\n⏱️ Время обработки: {time_taken:.2f} секунд")
        
        # Тест 5: Mind Map
        print("\n🗺️ РЕЖИМ: КАРТА ПАМЯТИ (MIND MAP)")
        print("-" * 40)
        start_time = datetime.now()
        mindmap = processor.create_mindmap(your_lecture_text)
        time_taken = (datetime.now() - start_time).total_seconds()
        
        print(mindmap)
        print(f"\n⏱️ Время обработки: {time_taken:.2f} секунд")
        
        print("\n🎉 ВСЕ РЕЖИМЫ ПРОТЕСТИРОВАНЫ УСПЕШНО!")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")


def test_batch_processing():
    """Пакетная обработка - все режимы сразу"""
    
    lecture_text = """
    Блокчейн — это технология распределенного реестра, которая поддерживает 
    постоянно растущий список записей, называемых блоками, которые связаны и 
    защищены с использованием криптографии. Каждый блок содержит криптографический 
    хэш предыдущего блока, временную метку и данные транзакций.
    """
    
    print("\n📦 ПАКЕТНАЯ ОБРАБОТКА")
    print("=" * 50)
    print("Исходный текст:")
    print(lecture_text.strip())
    print("=" * 50)
    
    try:
        processor = DeepSeekProcessor()
        
        # Все режимы сразу
        modes = ['summarize', 'extract_terms', 'generate_questions']
        
        start_time = datetime.now()
        results = processor.batch_process(lecture_text, modes)
        total_time = (datetime.now() - start_time).total_seconds()
        
        for mode, result in results.items():
            print(f"\n🔸 {mode.upper()}:")
            print("-" * 30)
            print(result)
        
        print(f"\n⏱️ Общее время пакетной обработки: {total_time:.2f} секунд")
        print("✅ Пакетная обработка завершена!")
        
    except Exception as e:
        print(f"❌ Ошибка пакетной обработки: {e}")


def interactive_mode():
    """Интерактивный режим - можешь вводить свой текст"""
    print("\n🔄 ИНТЕРАКТИВНЫЙ РЕЖИМ")
    print("=" * 50)
    
    try:
        processor = DeepSeekProcessor()
        
        while True:
            print("\nВыбери действие:")
            print("1. Краткий конспект")
            print("2. Извлечение терминов") 
            print("3. Расширение темы")
            print("4. Вопросы для самопроверки")
            print("5. Mind map")
            print("6. Пакетная обработка")
            print("0. Выход")
            
            choice = input("\nВведи номер (0-6): ").strip()
            
            if choice == "0":
                print("👋 До свидания!")
                break
                
            if choice in ["1", "2", "4", "5", "6"]:
                text = input("\nВставь текст лекции: ").strip()
                if not text:
                    print("❌ Текст не может быть пустым!")
                    continue
                    
                start_time = datetime.now()
                
                if choice == "1":
                    result = processor.summarize(text)
                elif choice == "2":
                    result = processor.extract_terms(text)
                elif choice == "4":
                    result = processor.generate_questions(text)
                elif choice == "5":
                    result = processor.create_mindmap(text)
                elif choice == "6":
                    modes = ['summarize', 'extract_terms', 'generate_questions']
                    results = processor.batch_process(text, modes)
                    for mode, res in results.items():
                        print(f"\n🔸 {mode.upper()}:")
                        print("-" * 30)
                        print(res)
                    continue
                
                time_taken = (datetime.now() - start_time).total_seconds()
                
                print("\n📋 РЕЗУЛЬТАТ:")
                print("-" * 40)
                print(result)
                print(f"\n⏱️ Время: {time_taken:.2f} сек")
                
            elif choice == "3":
                text = input("\nВставь текст лекции: ").strip()
                topic = input("Укажи тему для расширения: ").strip()
                
                if not text or not topic:
                    print("❌ Текст и тема обязательны!")
                    continue
                
                start_time = datetime.now()
                result = processor.expand_topic(topic, text)
                time_taken = (datetime.now() - start_time).total_seconds()
                
                print(f"\n🔍 РАСШИРЕНИЕ ТЕМЫ '{topic}':")
                print("-" * 40)
                print(result)
                print(f"\n⏱️ Время: {time_taken:.2f} сек")
            
            else:
                print("❌ Неверный выбор!")
                
    except KeyboardInterrupt:
        print("\n👋 Выход по Ctrl+C")
    except Exception as e:
        print(f"❌ Ошибка: {e}")


def main():
    """Главное меню"""
    print("🎯 ТЕСТЕР ML МОДУЛЯ")
    print("=" * 50)
    
    # Проверяем API ключ
    if not os.getenv('DEEPSEEK_API_KEY'):
        print("❌ DEEPSEEK_API_KEY не найден в .env файле!")
        return
    
    print("Выберите режим тестирования:")
    print("1. Тест с готовым текстом (машинное обучение)")
    print("2. Пакетная обработка (блокчейн)")  
    print("3. Интерактивный режим (свой текст)")
    print("0. Выход")
    
    choice = input("\nВведи номер (0-3): ").strip()
    
    if choice == "1":
        test_custom_text()
    elif choice == "2":
        test_batch_processing()
    elif choice == "3":
        interactive_mode()
    elif choice == "0":
        print("👋 До свидания!")
    else:
        print("❌ Неверный выбор!")


if __name__ == "__main__":
    main()