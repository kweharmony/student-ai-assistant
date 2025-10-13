"""
Простой быстрый тест DeepSeek API
"""

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
print(text)

print("\n🔄 Создание конспекта...")
summary = processor.summarize(text)
print("📄 Конспект:")
print(summary)

print("\n🔍 Извлечение терминов...")
terms = processor.extract_terms(text)
print("📚 Термины:")
print(terms)

print("\n✅ Тест завершен!")