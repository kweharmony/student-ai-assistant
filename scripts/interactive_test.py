"""
Интерактивный тестер ML модуля
Здесь ты можешь добавить свой текст и протестировать все режимы обработки
"""

"""
Интерактивный тестер ML модуля (запуск из корня):
python scripts/interactive_test.py
"""
import os
import sys
from datetime import datetime
from pathlib import Path

# Ensure repo root on sys.path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ml.deepseek_processor import DeepSeekProcessor


def test_custom_text() -> None:
    """Тестирование с готовым текстом."""
    your_lecture_text = (
        "Машинное обучение — это метод анализа данных, который автоматизирует построение "
        "аналитических моделей. Это раздел искусственного интеллекта, основанный на идее, "
        "что системы могут обучаться на данных, находить закономерности и принимать решения "
        "с минимальным вмешательством человека."
    )

    print("🎓 ИСХОДНЫЙ ТЕКСТ ЛЕКЦИИ:")
    print("=" * 60)
    print(your_lecture_text)
    print("=" * 60)

    try:
        p = DeepSeekProcessor()

        print("\n📄 РЕЖИМ: КРАТКИЙ КОНСПЕКТ")
        print("-" * 40)
        start = datetime.now()
        summary = p.summarize(your_lecture_text)
        print(summary)
        print(f"\n⏱️ Время обработки: {(datetime.now() - start).total_seconds():.2f} секунд")

        print("\n📚 РЕЖИМ: ИЗВЛЕЧЕНИЕ ТЕРМИНОВ")
        print("-" * 40)
        start = datetime.now()
        terms = p.extract_terms(your_lecture_text)
        print(terms)
        print(f"\n⏱️ Время обработки: {(datetime.now() - start).total_seconds():.2f} секунд")

        print("\n🔍 РЕЖИМ: РАСШИРЕНИЕ ТЕМЫ 'нейронные сети'")
        print("-" * 40)
        start = datetime.now()
        expansion = p.expand_topic("нейронные сети", your_lecture_text)
        print(expansion)
        print(f"\n⏱️ Время обработки: {(datetime.now() - start).total_seconds():.2f} секунд")

        print("\n❓ РЕЖИМ: ВОПРОСЫ ДЛЯ САМОПРОВЕРКИ")
        print("-" * 40)
        start = datetime.now()
        questions = p.generate_questions(your_lecture_text)
        print(questions)
        print(f"\n⏱️ Время обработки: {(datetime.now() - start).total_seconds():.2f} секунд")

        print("\n🗺️ РЕЖИМ: КАРТА ПАМЯТИ (MIND MAP)")
        print("-" * 40)
        start = datetime.now()
        mindmap = p.create_mindmap(your_lecture_text)
        print(mindmap)
        print(f"\n⏱️ Время обработки: {(datetime.now() - start).total_seconds():.2f} секунд")

        print("\n🎉 ВСЕ РЕЖИМЫ ПРОТЕСТИРОВАНЫ УСПЕШНО!")
    except Exception as e:
        print(f"❌ Ошибка: {e}")


def test_batch_processing() -> None:
    """Пакетная обработка - несколько режимов сразу."""
    lecture_text = (
        "Блокчейн — это технология распределенного реестра, которая поддерживает "
        "постоянно растущий список записей, называемых блоками, которые связаны и "
        "защищены с использованием криптографии."
    )

    print("\n📦 ПАКЕТНАЯ ОБРАБОТКА")
    print("=" * 50)
    print("Исходный текст:")
    print(lecture_text)
    print("=" * 50)

    try:
        p = DeepSeekProcessor()
        modes = ["summarize", "extract_terms", "generate_questions"]
        start = datetime.now()
        results = p.batch_process(lecture_text, modes)
        total_time = (datetime.now() - start).total_seconds()
        for mode, result in results.items():
            print(f"\n🔸 {mode.upper()}:")
            print("-" * 30)
            print(result)
        print(f"\n⏱️ Общее время пакетной обработки: {total_time:.2f} секунд")
        print("✅ Пакетная обработка завершена!")
    except Exception as e:
        print(f"❌ Ошибка пакетной обработки: {e}")


def interactive_mode() -> None:
    """Интерактивный режим - ввод своего текста."""
    print("\n🔄 ИНТЕРАКТИВНЫЙ РЕЖИМ")
    print("=" * 50)
    try:
        p = DeepSeekProcessor()
        while True:
            print("\nВыбери действие:")
            print("1. Краткий конспект")
            print("2. Извлечение терминов")
            print("3. Расширение темы")
            print("4. Вопросы для самопроверки")
            print("5. Mind map")
            print("0. Выход")
            choice = input("\nВведи номер (0-5): ").strip()
            if choice == "0":
                print("👋 До свидания!")
                break
            if choice in {"1", "2", "4", "5"}:
                text = input("\nВставь текст лекции: ").strip()
                if not text:
                    print("❌ Текст не может быть пустым!")
                    continue
                start = datetime.now()
                if choice == "1":
                    result = p.summarize(text)
                elif choice == "2":
                    result = p.extract_terms(text)
                elif choice == "4":
                    result = p.generate_questions(text)
                else:
                    result = p.create_mindmap(text)
                print("\n📋 РЕЗУЛЬТАТ:\n", result)
                print(f"\n⏱️ Время: {(datetime.now() - start).total_seconds():.2f} сек")
            elif choice == "3":
                text = input("\nВставь текст лекции: ").strip()
                topic = input("Тема для расширения: ").strip()
                if not text or not topic:
                    print("❌ Текст и тема обязательны!")
                    continue
                start = datetime.now()
                result = p.expand_topic(topic, text)
                print("\n🔍 РАСШИРЕНИЕ ТЕМЫ:\n", result)
                print(f"\n⏱️ Время: {(datetime.now() - start).total_seconds():.2f} сек")
            else:
                print("❌ Неверный выбор!")
    except KeyboardInterrupt:
        print("\n👋 Выход по Ctrl+C")
    except Exception as e:
        print(f"❌ Ошибка: {e}")


def main() -> None:
    print("🎯 ТЕСТЕР ML МОДУЛЯ")
    print("=" * 50)
    if not os.getenv("DEEPSEEK_API_KEY"):
        print("❌ DEEPSEEK_API_KEY не найден! Создай .env по образцу .env.example")
        return
    print("Выберите режим тестирования:")
    print("1. Тест с готовым текстом")
    print("2. Пакетная обработка")
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
