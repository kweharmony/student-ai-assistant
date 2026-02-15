# 🤖 Google Gemini ML Integration Guide

## Быстрый старт

### 1. Установка зависимостей

```bash
pip install -r requirements.txt
```

### 2. Настройка API ключа

Получите бесплатный API ключ на https://aistudio.google.com/apikey

Создайте файл `.env` в корне проекта и добавьте свой Gemini API ключ:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash-exp
```

### 3. Тестирование

Запустите тесты, чтобы убедиться, что все работает:

```powershell
# Тест ML процессора
python ml/gemini_processor.py

# Тест режима шпаргалки
python scripts/test_cheat_sheet_advanced.py

# Полное тестирование всех режимов (требует обновления для Gemini)
python scripts/test_api.py
```

## 📁 Структура ML модуля

```
ml/
├── __init__.py           # Экспорт основных классов
├── gemini_processor.py   # Главный класс для работы с Google Gemini
└── prompts.py           # Шаблоны промптов для разных задач

api/
├── __init__.py          # Экспорт API роутера  
└── ml_endpoints.py      # FastAPI эндпоинты
```

## 🎯 Основные возможности

### 1. Создание конспектов
```python
from ml.gemini_processor import GeminiProcessor

processor = GeminiProcessor()
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

### 5. Создание расширенного конспекта
```python
# Максимально подробное описание всех терминов
detailed_notes = processor.create_detailed_notes(lecture_text)

# Этот режим создает:
# - Детальное объяснение каждого термина (3-5 абзацев)
# - Определения, контекст, примеры
# - Взаимосвязи между понятиями
# - Практическое применение
```

### 6. Создание шпаргалки
```python
# Компактная выжимка с формулами и ключевыми фактами
cheat_sheet = processor.create_cheat_sheet(lecture_text)
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
from ml import GeminiProcessor

processor = GeminiProcessor()

# Проверяем соединение
if processor.health_check():
    print("✅ Gemini готов к работе!")
    
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

1. **Настройте .env файл** с вашим Gemini API ключом (бесплатно: https://aistudio.google.com/apikey)
2. **Запустите тесты** командой `python ml/gemini_processor.py`
3. **Интегрируйте с FastAPI** сервером вашего проекта
4. **Подключите к React** компонентам через API

## 💡 Советы по оптимизации

1. **Кэширование**: Добавьте Redis для кэширования частых запросов
2. **Пакетная обработка**: Используйте batch_process для экономии API вызовов
3. **Асинхронность**: Длинные тексты обрабатывайте в фоновых задачах
4. **Мониторинг**: Отслеживайте использование API (лимит: 15 req/min, 1500 req/день)

## 📞 Поддержка

При возникновении проблем:
1. Проверьте API ключ в .env файле
2. Убедитесь, что все зависимости установлены (`pip install -r requirements.txt`)
3. Запустите `python ml/gemini_processor.py` для диагностики
4. Проверьте лимиты на https://aistudio.google.com/quota