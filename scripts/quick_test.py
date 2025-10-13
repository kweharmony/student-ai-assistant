"""
Простой быстрый тест DeepSeek API
"""

import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)

from ml.deepseek_processor import DeepSeekProcessor

# Инициализируем процессор
print("🚀 Инициализация DeepSeek...")
processor = DeepSeekProcessor()

# Твой тестовый текст
text = """
Искусственный интеллект (ИИ) представляет собой область компьютерной науки, 
которая занимается созданием интеллектуальных машин, способных выполнять 
задачи, которые обычно требуют человеческого интеллекта. ИИ включает в себя 
машинное обучение, глубокое обучение, обработку естественного языка и 
компьютерное зрение.
"""

print("📝 Исходный текст:")
"""
Быстрый тест DeepSeek API (используй из корня репозитория):
python scripts/quick_test.py
"""
import os
import sys
from pathlib import Path

# Ensure repo root on sys.path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ml.deepseek_processor import DeepSeekProcessor


def main():
    print("🚀 Инициализация DeepSeek...")
    if not os.getenv("DEEPSEEK_API_KEY"):
        print("❌ DEEPSEEK_API_KEY не найден в окружении. Создай .env по образцу .env.example")
        return 1
    p = DeepSeekProcessor()

    text = (
        "Искусственный интеллект (ИИ) представляет собой область компьютерной науки, "
        "которая занимается созданием интеллектуальных машин, способных выполнять "
        "задачи, требующие человеческого интеллекта."
    )

    print("\n📝 Исходный текст:\n", text)

    print("\n🔄 Создание конспекта...")
    summary = p.summarize(text)
    print("\n📄 Конспект:\n", summary)

    print("\n🔍 Извлечение терминов...")
    terms = p.extract_terms(text)
    print("\n📚 Термины:\n", terms)

    print("\n✅ Тест завершен!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
