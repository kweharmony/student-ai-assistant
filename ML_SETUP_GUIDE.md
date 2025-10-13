# 🤖 DeepSeek ML Integration Guide

## Быстрый старт

### 1. Установка зависимостей

```bash
pip install -r requirements.txt
```

### 2. Настройка API ключа

Создай файл `.env` в корне проекта и добавь свой DeepSeek API ключ:

```bash
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

### 3. Тестирование

Запусти тесты, чтобы убедиться, что все работает:

```powershell
# Полное тестирование всех режимов
python scripts/test_api.py

# Быстрый тест основных функций
python scripts/quick_test.py

# Тест расширенного конспекта
python scripts/test_detailed_notes.py

# Интерактивный тестер
python scripts/interactive_test.py

# Тест обработки больших текстов
python scripts/test_large_text.py
```

## 📁 Структура ML модуля

```
ml/
├── __init__.py           # Экспорт основных классов
├── deepseek_processor.py # Главный класс для работы с DeepSeek
└── prompts.py           # Шаблоны промптов для разных задач

api/
├── __init__.py          # Экспорт API роутера  
└── ml_endpoints.py      # FastAPI эндпоинты
```

## 🎯 Основные возможности

### 1. Создание конспектов
```python
from ml.deepseek_processor import DeepSeekProcessor

processor = DeepSeekProcessor()
summary = processor.summarize(lecture_text)
```

### 2. Извлечение терминов
```python
terms = processor.extract_terms(lecture_text)
```

### 3. Расширение сложных тем
```python
explanation = processor.expand_topic(
    topic="квантовая механика",
    context="контекст из лекции"
)
```

### 4. Генерация вопросов
```python
questions = processor.generate_questions(lecture_text)
```

### 5. 🆕 Создание расширенного конспекта
```python
# Максимально подробное описание всех терминов
detailed_notes = processor.create_detailed_notes(lecture_text)

# Этот режим создает:
# - Детальное объяснение каждого термина (3-5 абзацев)
# - Определения, контекст, примеры
# - Взаимосвязи между понятиями
# - Практическое применение
```

**Когда использовать расширенный конспект:**
- ✅ Глубокое изучение сложной темы
- ✅ Подготовка к экзамену
- ✅ Создание справочника терминов
- ✅ Тексты с большим количеством технических понятий

**Сравнение режимов:**
- `summarize` - краткий обзор (~30% текста, быстро)
- `detailed_notes` - глубокий анализ (2-3x больше, детально)
- `extract_terms` - список + краткие определения

## 🌐 API эндпоинты

### Проверка здоровья
```
GET /api/ml/health
```

### Обработка текста
```
POST /api/ml/process
{
  "text": "текст лекции",
  "mode": "summarize",
  "topic": "опционально для expand_topic"
}
```

### Пакетная обработка
```
POST /api/ml/batch-process
{
  "text": "текст лекции", 
  "modes": ["summarize", "extract_terms", "generate_questions"]
}
```

### Доступные режимы
```
GET /api/ml/modes
```

### Быстрый конспект
```
POST /api/ml/quick-summary?text=ваш_текст
```

## 🔧 Интеграция с FastAPI сервером

```python
from fastapi import FastAPI
from api.ml_endpoints import router

app = FastAPI()
app.include_router(router)

# Запуск: uvicorn api.app:app --reload
```

## 📋 Пример использования

```python
# Базовое использование
from ml import DeepSeekProcessor

processor = DeepSeekProcessor()

# Проверяем соединение
if processor.health_check():
    print("✅ DeepSeek готов к работе!")
    
    # Обрабатываем лекцию
    lecture = "Ваш текст лекции здесь..."
    
    # Создаем конспект
    summary = processor.summarize(lecture)
    print("📄 Конспект:")
    print(summary)
    
    # Извлекаем термины
    terms = processor.extract_terms(lecture)
    print("📚 Термины:")
    print(terms)
    
    # Пакетная обработка
    results = processor.batch_process(
        lecture, 
        ["summarize", "extract_terms", "generate_questions"]
    )
    
    for mode, result in results.items():
        print(f"\n{mode}:")
        print(result)
```

## ⚙️ Конфигурация промптов

Промпты можно настраивать в файле `ml/prompts.py`:

- `SYSTEM_PROMPT` - общий системный промпт
- `SUMMARIZE_PROMPT` - для создания конспектов
- `EXTRACT_TERMS_PROMPT` - для извлечения терминов
- `EXPAND_TOPIC_PROMPT` - для расширения тем
- `GENERATE_QUESTIONS_PROMPT` - для генерации вопросов
- `DETAILED_NOTES_PROMPT` - для расширенных конспектов с детальным описанием терминов

### Настройки обработки (PROCESSING_CONFIGS):

```python
"detailed_notes": {
    "max_tokens": 4096,      # Большой лимит для детального описания
    "temperature": 0.3,      # Баланс между точностью и детальностью
    "top_p": 0.9
}

"summarize": {
    "max_tokens": 2048,      # Стандартный лимит
    "temperature": 0.3,
    "top_p": 0.9
}
```

> **Примечание:** Режим `mindmap` был заменен на `detailed_notes` для более глубокого анализа терминов.

## 🚨 Обработка ошибок

Все методы включают обработку ошибок:

```python
try:
    result = processor.summarize(text)
except Exception as e:
    print(f"Ошибка: {e}")
```

## 📊 Мониторинг

- Все запросы логируются
- Время обработки отслеживается
- Доступен health check эндпоинт

## 🔄 Интеграция с фронтендом

Для интеграции с React фронтендом используй API эндпоинты:

```javascript
// Пример запроса с фронтенда
const processText = async (text, mode) => {
  const response = await fetch('/api/ml/process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, mode })
  });
  
  return await response.json();
};
```

## 🎯 Следующие шаги

1. **Настрой .env файл** с твоим DeepSeek API ключом
2. **Запусти тесты** командой `python scripts/test_api.py`
3. **Интегрируй с FastAPI** сервером твоего проекта
4. **Подключи к React** компонентам через API

## 💡 Советы по оптимизации

1. **Кэширование**: Добавь Redis для кэширования частых запросов
2. **Пакетная обработка**: Используй batch_process для экономии API вызовов
3. **Асинхронность**: Длинные тексты обрабатывай в фоновых задачах
4. **Мониторинг**: Отслеживай использование API и лимиты

## 📞 Поддержка

При возникновении проблем:
1. Проверь API ключ в .env файле
2. Убедись, что все зависимости установлены
3. Запусти `python scripts/test_api.py` для диагностики