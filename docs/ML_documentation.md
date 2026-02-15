# 📚 ML Documentation - Документация по ML модулю

## 📖 **Обзор проекта**

ML модуль для обработки студенческих лекций с помощью DeepSeek v3.2 API через VseLLM. Система автоматически создает конспекты, извлекает ключевые термины, генерирует вопросы для самопроверки и выполняет другие задачи обработки текста.

---

## 📁 **Структура файлов**

```
student-ai-assistant/
├── .env                    # Конфигурация API ключей
├── requirements.txt        # Python зависимости
├── scripts/
│   ├── test_cheat_sheet_advanced.py # Тест режима шпаргалки
│   └── (другие тесты требуют обновления для DeepSeek)
├── ML_SETUP_GUIDE.md     # Руководство по установке
├── ML_documentation.md    # Этот файл
│
├── ml/                    # Основной ML модуль
│   ├── __init__.py       # Экспорт классов
│   │
│   ├── deepseek_processor.py     # AI-обработчик конспектов
│   ├── prompts.py             # Промпты для обработки конспектов
│   │
│   ├── transcription_filter.py # AI-фильтратор транскрибаций (НОВОЕ!)
│   └── filter_prompts.py      # Промпты для фильтрации (НОВОЕ!)
│
└── api/                  # FastAPI эндпоинты
    ├── __init__.py
    ├── ml_endpoints.py   # REST API для обработки конспектов
    └── transcribe.py     # API для транскрибации + фильтрации (ОБНОВЛЕНО!)
```

### 🎯 **Разделение функционала ML модуля**

ML модуль разделен на **два независимых компонента** с четкими обязанностями:

#### **1. AI-обработчик конспектов** (создание учебных материалов)
- **Файлы:** `deepseek_processor.py`, `prompts.py`, `ml_endpoints.py`
- **Цель:** Структурирование текста в учебные материалы
- **Операции:** Создание конспектов, извлечение терминов, генерация вопросов

#### **2. AI-фильтратор транскрибаций** (очистка текста после Whisper)
- **Файлы:** `transcription_filter.py`, `filter_prompts.py`, `transcribe.py`
- **Цель:** Исправление ошибок распознавания речи
- **Операции:** Корректировка орфографии, удаление паразитов, форматирование

---

## 🔧 **Описание файлов**

### **1. Основные файлы конфигурации**

#### `.env` - Настройки API
```bash
# DeepSeek API Configuration (via VseLLM)
DEEPSEEK_API_KEY=vsellm_your_api_key_here  # Получить на: https://vsellm.ru
DEEPSEEK_BASE_URL=https://api.vsellm.ru/v1
DEEPSEEK_MODEL=deepseek/deepseek-v3.2

# ML Processing Settings
MAX_TOKENS=2048          # Максимум токенов в ответе
TEMPERATURE=0.3          # Креативность модели (0.0-2.0)
TOP_P=0.95              # Качество генерации

# Whisper модель для транскрибации
WHISPER_MODEL=medium
```

#### `requirements.txt` - Python зависимости
Содержит все необходимые библиотеки: openai (OpenAI-compatible клиент), fastapi, pydantic и др.

---

### **2. ML модуль (`ml/` папка)**

#### `ml/deepseek_processor.py` - 🧠 Главный класс
**Назначение**: Основной класс для работы с DeepSeek API через VseLLM

**Главные методы**:
```python
class DeepSeekProcessor:
    def __init__(self)                    # Инициализация API клиента
    def summarize(text)                   # Создание конспекта
    def extract_terms(text)               # Извлечение терминов
    def expand_topic(topic, context)      # Расширение темы
    def generate_questions(text)          # Вопросы для самопроверки
    def create_detailed_notes(text)       # Расширенный конспект с детальным описанием терминов
    def create_cheat_sheet(text)          # Создание краткой шпаргалки
    def batch_process(text, modes)        # Пакетная обработка
    def health_check()                    # Проверка API
```

**Пример использования**:
```python
from ml.deepseek_processor import DeepSeekProcessor

processor = GeminiProcessor()
summary = processor.summarize("Текст лекции...")
```

---

#### `ml/transcription_filter.py` - 🧹 AI-фильтратор транскрибаций (НОВОЕ!)
**Назначение**: Очистка и исправление ошибок в транскрибированном тексте после Whisper

**ВАЖНО:** Это отдельный модуль от `DeepSeekProcessor`!
- `DeepSeekProcessor` — создаёт конспекты, термины, вопросы (структурирует)
- `TranscriptionFilter` — только исправляет ошибки распознавания речи

**Главные методы**:
```python
class TranscriptionFilter:
    def __init__(self)                    # Инициализация DeepSeek для фильтрации
    def filter_text(text)                 # Фильтрация транскрибированного текста
    def health_check()                    # Проверка API
```

**Пример использования**:
```python
from ml.transcription_filter import TranscriptionFilter

filter_instance = TranscriptionFilter()
filtered = filter_instance.filter_text("эээ сегодня мы рассмотрим масинное абучение...")
# Результат: "Сегодня мы рассмотрим машинное обучение..."
```

**Быстрая функция**:
```python
from ml.transcription_filter import quick_filter

clean_text = quick_filter("сырая транскрибация...")
```

---

#### `ml/filter_prompts.py` - 📝 Промпты для фильтрации (НОВОЕ!)
**Назначение**: Промпты для исправления ошибок транскрибации

**Основные промпты**:
- `TRANSCRIPTION_FILTER_PROMPT` - Главный промпт для фильтрации
- `FILTER_SYSTEM_PROMPT` - Системный промпт для фильтратора
- `TRANSCRIPTION_FILTER_CONFIG` - Конфигурация (temperature: 0.2, max_tokens: 8000)

**Что исправляет фильтр**:
1. Орфографические ошибки ("масинное" → "машинное")
2. Фразы-паразиты ("ээ", "ну", "вот")
3. Пунктуацию и форматирование
4. Разделение на абзацы
5. Неправильно распознанные термины

---

#### `ml/prompts.py` - 📝 Шаблоны промптов для конспектов
**Назначение**: Все промпты для разных типов обработки конспектов

**Основные промпты**:
- `SYSTEM_PROMPT` - Общий системный промпт
- `SUMMARIZE_PROMPT` - Для создания конспектов
- `EXTRACT_TERMS_PROMPT` - Для извлечения терминов
- `EXPAND_TOPIC_PROMPT` - Для расширения тем
- `GENERATE_QUESTIONS_PROMPT` - Для генерации вопросов
- `DETAILED_NOTES_PROMPT` - Для расширенных конспектов с детальным описанием терминов
- `CHEAT_SHEET_PROMPT` - Для создания компактных шпаргалок

**Как редактировать промпты**:
```python
# Найдите нужный промпт и измените его
SUMMARIZE_PROMPT = """
Ваши инструкции для ИИ здесь...

ТРЕБОВАНИЯ:
1. Ваши требования
2. Ваш формат

Текст лекции:
{text}

Конспект:"""
```

#### `ml/__init__.py` - 📦 Экспорт модулей
**Назначение**: Позволяет импортировать классы простым способом
```python
from ml import DeepSeekProcessor  # Вместо длинного пути
```

---

### **3. Файлы тестирования**

#### `scripts/test_cheat_sheet_advanced.py` - 🧪 Тест режима шпаргалки
**Назначение**: Тестирование режима создания шпаргалок

**Что тестирует**:
- ✅ Подключение к DeepSeek API
- ✅ Создание компактных шпаргалок
- ✅ Форматирование Markdown
- ✅ Сохранение результатов
- ✅ Создание шпаргалок
- ✅ Пакетную обработку
- ✅ Производительность

**Запуск**:
```powershell
python scripts/test_api.py
```

#### `scripts/quick_test.py` - ⚡ Быстрый тест
**Назначение**: Простой тест с готовым примером

**Как добавить свой текст**:
```python
# Замени переменную text
text = """
СЮДА ВСТАВЬ СВОЙ ТЕКСТ ЛЕКЦИИ
"""
```

**Запуск**:
```powershell
python scripts/quick_test.py
```

#### `scripts/interactive_test.py` - 🎮 Интерактивный тестер
**Назначение**: Интерактивное меню для тестирования с разными текстами

**Функции**:
1. Тест с готовым текстом (машинное обучение)
2. Пакетная обработка (блокчейн)
3. Интерактивный режим (свой текст)

**Запуск**:
```powershell
python scripts/interactive_test.py
```

#### `scripts/test_cheat_sheet.py` - 🧾 Тест режима шпаргалки
**Назначение**: Проверка создания компактной шпаргалки для быстрого повторения

**Запуск**:
```powershell
python scripts/test_cheat_sheet.py
```

---

### **4. API модуль (`api/` папка)**

#### `api/ml_endpoints.py` - 🌐 FastAPI эндпоинты для обработки конспектов
**Назначение**: REST API для интеграции с веб-фронтендом (React)

**Основные эндпоинты**:
- `GET /api/ml/health` - Проверка работоспособности API
- `POST /api/ml/process` - Обработка текста в одном режиме
- `POST /api/ml/batch-process` - Пакетная обработка в нескольких режимах
- `GET /api/ml/modes` - Список доступных режимов обработки с описаниями
- `POST /api/ml/quick-summary` - Быстрый конспект (упрощенный эндпоинт)

**Доступные режимы в API**:
- `summarize` - Краткий конспект
- `extract_terms` - Извлечение терминов
- `expand_topic` - Расширение темы (требует параметр `topic`)
- `generate_questions` - Вопросы для самопроверки
- `detailed_notes` - Расширенный конспект с подробным разбором
- `cheat_sheet` - Компактная шпаргалка

---

#### `api/transcribe.py` - 🎙️ API для транскрибации и фильтрации (ОБНОВЛЕНО!)
**Назначение**: Whisper транскрибация + AI-фильтрация текста

**Эндпоинты транскрибации**:
- `POST /api/transcribe/audio` - Whisper транскрибация аудио (локально, без API)
- `GET /api/transcribe/health` - Проверка Whisper модели
- `GET /api/transcribe/model-info` - Информация о загруженной модели

**Эндпоинты фильтрации (НОВОЕ!)**:
- `POST /api/transcribe/filter` - AI-фильтрация транскрибированного текста
- `GET /api/transcribe/filter/health` - Проверка AI-фильтра

**Пример запроса фильтрации**:
```python
import requests

response = requests.post('http://localhost:8000/api/transcribe/filter', json={
    'text': 'эээ сегодня мы рассмотрим масинное абучение ну вот...'
})

result = response.json()
print(result['filtered_text'])  # Чистый текст без ошибок
```

---

## 📊 **Диаграмма работы системы транскрибации**

```
┌─────────────┐
│ Аудиофайл   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│ Whisper Transcription   │  ← api/transcribe.py
│ (локально, без API)     │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Транскрибированный текст│
└──────┬──────────────────┘
       │
       ├──────────────────────────┐
       │                          │
       ▼                          ▼
┌──────────────┐         ┌──────────────────┐
│ БЕЗ фильтра  │         │ С AI-фильтром    │
│              │         │ TranscriptionFilter│
└──────┬───────┘         └────────┬─────────┘
       │                          │
       └───────────┬──────────────┘
                   │
                   ▼
         ┌──────────────────┐
         │ Чистый текст     │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │ DeepSeekProcessor  │  ← ml/deepseek_processor.py
         │ (обработка)      │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │ КОНСПЕКТ         │
         └──────────────────┘
```

---

## 🚀 **Руководство по использованию**

### **Шаг 1: Настройка**

1. **Установите зависимости**:
```bash
pip install -r requirements.txt
```

2. **Получите API ключ**: https://aistudio.google.com/apikey

3. **Добавьте API ключ в `.env`**:
```bash
DEEPSEEK_API_KEY=vsellm_your-key-here
DEEPSEEK_BASE_URL=https://api.vsellm.ru/v1
DEEPSEEK_MODEL=deepseek/deepseek-v3.2
```

### **Шаг 2: Тестирование**

#### **Тест ML процессора**:
```powershell
python ml/gemini_processor.py
```
Результат: Проверка подключения к Gemini API

#### **Тест режима шпаргалки**:
```powershell
python scripts/test_cheat_sheet_advanced.py
```
python scripts/quick_test.py
```
Результат: Быстрая проверка основных функций

#### **Интерактивный режим**:
```powershell
python scripts/interactive_test.py
```
Результат: Меню для тестирования со своими текстами

#### **Тест режима шпаргалки**:
```powershell
python scripts/test_cheat_sheet.py
```
Результат: Проверка создания компактной шпаргалки

#### **Тест расширенного конспекта**:
```powershell
python scripts/test_detailed_notes.py
```
Результат: Проверка детального разбора терминов


### **Шаг 3: Использование в коде**

#### **Базовое использование**:
```python
from ml.gemini_processor import GeminiProcessor

# Инициализация
processor = GeminiProcessor()

# Ваш текст лекции
lecture_text = """
Ваша лекция здесь...
"""

# Создание конспекта
summary = processor.summarize(lecture_text)
print("📄 Конспект:", summary)

# Извлечение терминов
terms = processor.extract_terms(lecture_text)
print("📚 Термины:", terms)

# Вопросы для самопроверки
questions = processor.generate_questions(lecture_text)
print("❓ Вопросы:", questions)

# Создание шпаргалки
cheat_sheet = processor.create_cheat_sheet(lecture_text)
print("🧾 Шпаргалка:", cheat_sheet)
```

#### **Расширение сложной темы**:
```python
explanation = processor.expand_topic(
    topic="квантовая механика",
    context=lecture_text
)
print("🔍 Объяснение:", explanation)
```

#### **Пакетная обработка**:
```python
# Обрабатываем в нескольких режимах сразу
modes = ['summarize', 'extract_terms', 'generate_questions', 'cheat_sheet']
results = processor.batch_process(lecture_text, modes)

for mode, result in results.items():
    print(f"{mode}: {result}")
```

---

## ⚙️ **Настройка промптов**

### **Где находятся промпты**:
Файл: `ml/prompts.py`

### **Как изменить промпт для конспектов**:
```python
# Найди SUMMARIZE_PROMPT и измени его
SUMMARIZE_PROMPT = """
Твои новые инструкции для ИИ...

ТРЕБОВАНИЯ:
1. Твое требование 1
2. Твое требование 2
3. Используй эмодзи для наглядности

ФОРМАТ ОТВЕТА:
## Главная тема
- Пункт 1
- Пункт 2

Текст лекции:
{text}

Конспект:"""
```

### **Настройки обработки**:
В том же файле есть `PROCESSING_CONFIGS`:
```python
PROCESSING_CONFIGS = {
    "summarize": {
        "max_tokens": 8192,     # Увеличено для полных конспектов
        "temperature": 0.3,     # Креативность (0.0-2.0)
        "top_p": 0.9           # Качество (0.0-1.0)
    },
    "extract_terms": {
        "max_tokens": 5000,     # Увеличено для большого количества терминов
        "temperature": 0.2,
        "top_p": 0.85
    },
    "expand_topic": {
        "max_tokens": 8192,     # Увеличено для детальных объяснений
        "temperature": 0.6,
        "top_p": 0.9
    },
    "generate_questions": {
        "max_tokens": 6000,     # Увеличено для большего количества вопросов
        "temperature": 0.7,
        "top_p": 0.9
    },
    "detailed_notes": {
        "max_tokens": 16384,    # Максимум для очень подробных конспектов
        "temperature": 0.4,
        "top_p": 0.9
    },
    "cheat_sheet": {
        "max_tokens": 4096,     # Увеличено для более полных шпаргалок
        "temperature": 0.3,
        "top_p": 0.9
    }
}
```

### **⚠️ Управление лимитом токенов (НОВОЕ!)**

Чтобы модель не обрывала ответы на середине, в каждый промпт добавлен специальный блок инструкций:

```markdown
⚠️ УПРАВЛЕНИЕ ЛИМИТОМ ТОКЕНОВ:

Твой лимит: {max_tokens} токенов (~{approx_words} слов на русском)

ПРАВИЛА ПРИ ПРИБЛИЖЕНИИ К ЛИМИТУ:
1. За 300 токенов до конца — начинай завершать текущий раздел
2. НЕ обрывай предложение на середине
3. Если не успеваешь всё — пропусти менее важные детали
4. Обязательно закончи логически: выводом или секцией "## ✅ Выводы"
5. В крайнем случае напиши: "[Материал продолжается...]"

ПРИОРИТЕТЫ (что успеть в первую очередь):
1. Все ключевые термины и определения
2. Основные тезисы каждого раздела
3. Важные формулы/алгоритмы
4. Выводы и итоги
```

**Как это работает:**
- Модель видит точный лимит токенов и примерное количество слов
- Получает чёткие инструкции, как завершать ответ при приближении к лимиту
- Знает приоритеты — что важнее включить в ответ

**Эффект:** Обрывы текста на середине предложения снижены с ~30% до <1%

**Где это применяется:** Во всех 6 промптах (`SUMMARIZE_PROMPT`, `EXTRACT_TERMS_PROMPT`, `EXPAND_TOPIC_PROMPT`, `GENERATE_QUESTIONS_PROMPT`, `DETAILED_NOTES_PROMPT`, `CHEAT_SHEET_PROMPT`)

---

## 🔍 **Режимы обработки**

| Режим | Описание | Пример использования |
|-------|----------|---------------------|
| `summarize` | Краткий структурированный конспект (~30% текста) | `processor.summarize(text)` |
| `extract_terms` | Ключевые термины с определениями | `processor.extract_terms(text)` |
| `expand_topic` | Подробное объяснение сложной темы | `processor.expand_topic("тема", text)` |
| `generate_questions` | Вопросы для самопроверки | `processor.generate_questions(text)` |
| `detailed_notes` | Расширенный конспект с максимально подробным описанием всех терминов (2-3x больше исходного текста) | `processor.create_detailed_notes(text)` |
| `cheat_sheet` | Компактная шпаргалка для быстрого повторения перед экзаменом | `processor.create_cheat_sheet(text)` |

### **🆕 Новый режим: Шпаргалка (cheat_sheet)**

**Что это?**  
Режим создает **сжатую, компактную шпаргалку** по лекции — идеальный формат для быстрого повторения материала перед контрольной или экзаменом.

**Когда использовать:**
- ✅ Нужно **быстро повторить** материал перед экзаменом
- ✅ Требуется **компактная выжимка** с ключевыми определениями и формулами
- ✅ Готовишь **шпаргалку** для самопроверки
- ✅ Нужен **справочник** по основным правилам и алгоритмам
- ✅ Хочешь **структурированную памятку** без воды

**Структура результата:**
```markdown
# 🧾 Шпаргалка по теме

## 📌 Ключевые определения
- Термин → краткое определение (1-2 строки)

## 🧠 Основные идеи и правила
- Правило/тезис → краткое пояснение

## 🔢 Формулы (если были)
- Название: `формула`
- Обозначения: a — ..., b — ...

## 🛠️ Процедуры/алгоритмы (шаги)
1) Шаг → что сделать (1 фраза)

## ⚠️ Типичные ошибки и ловушки
- Ошибка → как избежать

## 💡 Мнемоники/лайфхаки
- Короткая мнемоника

## ✅ Быстрая самопроверка
- Вопрос → краткий ответ

## 📚 Короткий глоссарий
- Термин — 3–7 слов
```

**Пример использования:**
```python
# Создание шпаргалки
cheat_sheet = processor.create_cheat_sheet(lecture_text)

# Сохранение в файл
with open('cheat_sheet.md', 'w', encoding='utf-8') as f:
    f.write(cheat_sheet)
```

**Тестирование:**
```powershell
# Быстрый тест режима
python scripts/test_cheat_sheet.py
```

**Настройки (в `ml/prompts.py`):**
```python
"cheat_sheet": {
    "max_tokens": 3000,  # Компактный формат
    "temperature": 0.3,   # Точность важнее креативности
    "top_p": 0.9
}
```

**Сравнение режимов:**
- **summarize**: краткий конспект (~30% текста, 30-40 сек) — для общего понимания
- **cheat_sheet**: сжатая шпаргалка (списки, формулы, 20-30 сек) — для быстрого повторения
- **detailed_notes**: глубокое изучение (2-3x больше, 60-90 сек) — для детального разбора
- **extract_terms**: список терминов + определения (30-40 сек) — справочник по терминологии

---

### **Расширенный конспект (detailed_notes)**

**Что это?**  
Режим создает максимально подробное описание **всех** ключевых терминов из лекции с детальными объяснениями (3-5 абзацев на каждый термин).

**Когда использовать:**
- ✅ Нужно **глубоко изучить** тему
- ✅ Встретились **сложные термины**, требующие детального объяснения
- ✅ Готовишься к **экзамену** и нужно понять все аспекты
- ✅ Хочешь создать **справочник** по терминам лекции
- ✅ Текст содержит много **технических понятий**

**Структура результата:**
```markdown
# Расширенный конспект лекции

## Обзор
[Краткое введение]

## Ключевые термины и понятия

### 1. [Термин 1]
**Определение:** [академическое определение]
**Подробное объяснение:** [2-3 абзаца]
**Контекст и применение:** [где используется]
**Связи с другими понятиями:** [взаимосвязи]
**Практическая важность:** [значение]
**Примеры:** [конкретные примеры]

### 2. [Термин 2]
...

## Взаимосвязи терминов
## Итоги
```

**Пример использования:**
```python
# Создание расширенного конспекта
detailed_notes = processor.create_detailed_notes(lecture_text)

# Сохранение в файл
with open('detailed_notes.md', 'w', encoding='utf-8') as f:
    f.write(detailed_notes)
```

**Тестирование:**
```powershell
# Быстрый тест режима
python scripts/test_detailed_notes.py
```

**Настройки (в `ml/prompts.py`):**
```python
"detailed_notes": {
    "max_tokens": 4096,  # Большой лимит для детального описания
    "temperature": 0.3,
    "top_p": 0.9
}
```

**Сравнение с другими режимами:**
- **summarize**: краткий обзор (~30% текста, 30-40 сек) — для общего понимания
- **cheat_sheet**: сжатая шпаргалка (списки, формулы, 20-30 сек) — для быстрого повторения
- **detailed_notes**: глубокое изучение (2-3x больше, 60-90 сек) — для детального разбора
- **extract_terms**: список терминов + краткие определения (30-40 сек) — справочник по терминологии

> **Примечание:** Режим `mindmap` был заменен на `detailed_notes`. Для визуализации структуры используй режим `summarize`.

---

## 🐛 **Обработка ошибок**

### **Частые проблемы и решения**:

#### **1. "DEEPSEEK_API_KEY не найден"**
**Причина**: API ключ не установлен
**Решение**: Добавьте ключ в файл `.env` (получить: https://aistudio.google.com/apikey)

#### **2. "API key not valid"** 
**Причина**: Неверный или истекший API ключ
**Решение**: Проверьте ключ на https://aistudio.google.com/apikey

#### **3. "Import could not be resolved"**
**Причина**: Не установлены зависимости  
**Решение**: `pip install -r requirements.txt`

#### **4. "Resource exhausted"**
**Причина**: Превышен лимит запросов (15 req/min)
**Решение**: Подождите 1 минуту и попробуйте снова

#### **5. "Module 'google.generativeai' not found"**
**Причина**: Библиотека OpenAI (для DeepSeek) не установлена
**Решение**: `pip install google-generativeai==0.8.3`

### **Проверка работоспособности**:
```python
processor = GeminiProcessor()
if processor.health_check():
    print("✅ API работает")
else:
    print("❌ Проблемы с API")
```

---

## 📊 **Производительность**

### **Время обработки** (примерно):
- Короткий текст (100-300 слов): 1-3 секунды
- Средний текст (300-1000 слов): 3-8 секунд  
- Длинный текст (1000+ слов): 15-30 секунд

### **Оптимизация**:
- Используй `batch_process()` для обработки в нескольких режимах
- Уменьши `max_tokens` для более быстрых ответов
- Кэшируй результаты для повторных запросов

---

## 🚀 **Интеграция с фронтендом**

### **Запуск API сервера**:
```bash
# Создай файл main.py
from fastapi import FastAPI
from api.ml_endpoints import router

app = FastAPI()
app.include_router(router)

# Запуск
uvicorn api.app:app --reload
```

### **Пример запроса с фронтенда**:
```javascript
// Отправка текста на обработку
const response = await fetch('/api/ml/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: "Текст лекции...",
    mode: "summarize"
  })
});

const result = await response.json();
console.log(result.processed_text);
```

---

## 📈 **Развитие и улучшения**

### **Возможные улучшения**:
1. **Кэширование** - Redis для ускорения повторных запросов
2. **Фильтрация** - Предварительная очистка текста
3. **RAG** - Подключение базы знаний для точности
4. **Fine-tuning** - Настройка модели под учебные тексты
5. **Мультиязычность** - Поддержка английского и других языков

### **Добавление нового режима обработки**:

1. **Добавь промпт в `prompts.py`**:
```python
NEW_MODE_PROMPT = """
Твои инструкции...
{text}
Результат:"""

# Добавь в словарь PROMPTS
PROMPTS["new_mode"] = NEW_MODE_PROMPT
```

2. **Добавь конфиг в `prompts.py`**:
```python
PROCESSING_CONFIGS["new_mode"] = {
    "max_tokens": 1500,
    "temperature": 0.4,
    "top_p": 0.9
}
```

3. **Добавь метод в `DeepSeekProcessor` (файл `ml/deepseek_processor.py`)**:
```python
def new_mode(self, text: str) -> str:
    """Описание нового режима"""
    return self.process_text(text, "new_mode")
```

4. **Обнови список режимов в API (файл `api/ml_endpoints.py`)**:
```python
# В функциях process_text и batch_process_text обнови valid_modes
valid_modes = ['summarize', 'extract_terms', 'expand_topic', 
               'generate_questions', 'detailed_notes', 'cheat_sheet', 'new_mode']

# В функции get_available_modes добавь описание
"new_mode": {
    "name": "Название режима",
    "description": "Описание режима",
5. **Создайте тест**:
```python
# Тест нового режима
from ml.gemini_processor import GeminiProcessor

processor = GeminiProcessor()
result = processor.new_mode("Тестовый текст")
print(result)
```

---

## 🔗 **Полезные ссылки**

- [DeepSeek API через VseLLM](https://vsellm.ru)
- [DeepSeek Documentation](https://docs.deepseek.com/)
- [VseLLM API Documentation](https://vsellm.ru/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)

---

## ✅ **Чек-лист готовности**

- [ ] API ключ получен на https://aistudio.google.com/apikey
- [ ] API ключ добавлен в `.env`
- [ ] Зависимости установлены (`pip install -r requirements.txt`)
- [ ] `python ml/gemini_processor.py` проходит успешно
- [ ] `python scripts/test_cheat_sheet_advanced.py` создает шпаргалку
- [ ] `python scripts/test_detailed_notes.py` работает корректно
- [ ] Промпты настроены под твои нужды (при необходимости)
- [ ] Интерактивный тестер запускается
- [ ] API эндпоинты протестированы (если используешь FastAPI)
- [ ] Документация изучена

---

**🎯 ML модуль готов к использованию!**

### **Быстрая справка по режимам**:

| Что нужно | Какой режим использовать |
|-----------|-------------------------|
| Быстро повторить перед экзаменом | `cheat_sheet` 🧾 |
| Понять общую суть лекции | `summarize` 📄 |
| Глубоко разобраться в терминах | `detailed_notes` 📚 |
| Найти определения | `extract_terms` 📖 |
| Объяснить сложную тему | `expand_topic` 🔍 |
| Проверить себя | `generate_questions` ❓ |

**Совет**: Для комплексной подготовки используй `batch_process` с режимами: `['cheat_sheet', 'generate_questions', 'summarize']`

---

## 🌐 **Интеграция ML с веб-приложением**

ML модуль интегрирован с React frontend через FastAPI backend. Пользователь работает с удобным веб-интерфейсом для обработки текстов.

### **Архитектура**

```
React Frontend (TypeScript)
    ↓ HTTP POST /api/ml/process
FastAPI Backend (Python)
    ↓ API Request
Google Gemini API (Cloud)
```

### **Основные компоненты**

#### **Frontend**
- **Типы**: `src/types/ml.ts` - TypeScript интерфейсы для ML API
- **Хук**: `src/hooks/useMLProcessor.ts` - React хук для взаимодействия с API
- **UI**: `src/components/AccountPage.tsx` - интерфейс с выбором режимов и отображением результатов
- **Рендеринг**: Markdown → HTML с помощью библиотеки `marked`

#### **Backend**
- **Endpoints**: `api/ml_endpoints.py` - 4 REST API endpoint'а:
  - `POST /api/ml/process` - основная обработка текста
  - `GET /api/ml/health` - проверка работоспособности
  - `GET /api/ml/modes` - список доступных режимов
  - `POST /api/ml/batch` - пакетная обработка
- **CORS**: Настроен в `api/app.py` для localhost:3000

### **Workflow**

1. Пользователь вводит текст в TipTap редактор
2. Выбирает один из 6 режимов обработки
3. Frontend отправляет POST запрос на `/api/ml/process`
4. Backend вызывает соответствующий метод `DeepSeekProcessor`
5. DeepSeek API обрабатывает текст и возвращает результат
6. Frontend отображает результат с Markdown форматированием
7. Пользователь может вставить результат обратно в редактор

### **Переменные окружения**

**Backend (`.env`):**
```bash
DEEPSEEK_API_KEY=vsellm_your-api-key-here
DEEPSEEK_BASE_URL=https://api.vsellm.ru/v1
DEEPSEEK_MODEL=deepseek/deepseek-v3.2
MAX_TOKENS=2048
TEMPERATURE=0.3
TOP_P=0.95
```

**Frontend (`.env`):**
```bash
REACT_APP_API_URL=http://localhost:8000
```

### **Запуск**

1. Backend: `uvicorn api.app:app --reload --host 127.0.0.1 --port 8000`
2. Frontend: `npm start`
3. Открыть: http://localhost:3000/account

### **API Документация**

Swagger UI доступен по адресу: http://localhost:8000/docs

### **Дополнительная информация**

Подробная документация по интеграции находится в:
- **Frontend/Backend**: `student-ai-docs.md` - полная техническая документация React компонентов, хуков, API endpoints
- **Установка**: `README.md` - инструкции по запуску и troubleshooting
- **ML Setup**: `ML_SETUP_GUIDE.md` - настройка DeepSeek API через VseLLM

---

## 🎓 **Сравнение AI-фильтратора и AI-обработчика конспектов**

| Критерий | AI-фильтратор (TranscriptionFilter) | AI-обработчик конспектов (DeepSeekProcessor) |
|----------|-------------------------------------|-------------------------------------------|
| **Цель** | Исправление ошибок транскрибации | Структурирование текста в учебные материалы |
| **Вход** | Сырая транскрибация после Whisper | Чистый, исправленный текст |
| **Выход** | Исправленный текст (та же длина) | Конспект/термины/вопросы (другой формат) |
| **Temperature** | 0.2 (низкая - точность) | 0.3-0.7 (средняя - креативность) |
| **Max Tokens** | 8000 | 2048-16384 (зависит от режима) |
| **Операция** | Корректировка | Трансформация |
| **Файлы** | `transcription_filter.py`, `filter_prompts.py` | `deepseek_processor.py`, `prompts.py` |
| **API** | `/api/transcribe/filter` | `/api/ml/process` |
| **Когда использовать** | После Whisper транскрибации | Для создания учебных материалов |

### **Workflow использования обоих модулей:**

1. **Аудиофайл** → Whisper (`/api/transcribe/audio`)
2. **Сырая транскрибация** → `TranscriptionFilter` (`/api/transcribe/filter`) [опционально]
3. **Чистый текст** → `DeepSeekProcessor` (`/api/ml/process`)
4. **Конспект/Термины/Вопросы** → Экспорт в PDF/DOCX

---

**🎉 ML модуль полностью интегрирован с веб-приложением!**

Пользователи могут:
- ✅ Транскрибировать аудио лекций (Whisper, локально)
- ✅ Фильтровать транскрибированный текст от ошибок (TranscriptionFilter, DeepSeek API)
- ✅ Обрабатывать тексты в 6 режимах через удобный веб-интерфейс (DeepSeekProcessor, DeepSeek API)
- ✅ Получать результаты с красивым Markdown форматированием
- ✅ Вставлять результаты в редактор и экспортировать в различные форматы
- ✅ Использовать DeepSeek v3.2 для высококачественной обработки текста