"""
Тестирование режима "шпаргалка" (cheat_sheet)
Запуск: python scripts/test_cheat_sheet.py
"""
import os
import sys
from pathlib import Path
from datetime import datetime

# Ensure repo root on sys.path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ml.deepseek_processor import DeepSeekProcessor


def main():
    print("=" * 70)
    print("🧾 ТЕСТ РЕЖИМА ШПАРГАЛКИ (cheat_sheet)")
    print("=" * 70)

    if not os.getenv("DEEPSEEK_API_KEY"):
        print("\n❌ DEEPSEEK_API_KEY не найден. Добавьте ключ в .env и повторите запуск.")
        return 1

    # Пример текста лекции (можно заменить своим)
    lecture_text = (
        "Машинное обучение — это раздел искусственного интеллекта, который изучает методы, позволяющие "+
        "компьютерам улучшать качество решения задач на основе данных. Основные типы обучения: "+
        "обучение с учителем, без учителя и с подкреплением. Ключевые понятия: модель, признаки, целевая переменная, "
        "ошибка и переобучение. Для линейной регрессии используется функция потерь MSE, оптимизация возможна через "
        "градиентный спуск. Переобучение контролируется регуляризацией (L1/L2) и кросс-валидацией."
    )

    try:
        processor = DeepSeekProcessor()
        start = datetime.now()
        result = processor.create_cheat_sheet(lecture_text)
        elapsed = (datetime.now() - start).total_seconds()

        print(f"\n✅ Шпаргалка получена за {elapsed:.2f} сек")
        print(f"📏 Длина результата: {len(result)} символов")
        print("\n" + "-" * 70)
        print("ПРЕВЬЮ РЕЗУЛЬТАТА:")
        print("-" * 70)
        print(result[:1200] + ("..." if len(result) > 1200 else ""))
        print("\n" + "-" * 70)

        # Опционально: сохранение в файл
        save = input("\n💾 Сохранить шпаргалку в файл? (y/n): ").strip().lower()
        if save == 'y':
            out_path = ROOT / "scripts" / "cheat_sheet_output.md"
            with open(out_path, 'w', encoding='utf-8') as f:
                f.write(result)
            print(f"✅ Сохранено: {out_path}")

        return 0

    except Exception as e:
        print(f"\n❌ Ошибка во время теста cheat_sheet: {e}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
