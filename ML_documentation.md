# 📚 ML Documentation - Документация по ML модулю

## 📖 **Обзор проекта**

ML модуль для обработки студенческих лекций с помощью DeepSeek API. Система автоматически создает конспекты, извлекает ключевые термины, генерирует вопросы для самопроверки и выполняет другие задачи обработки текста.

---

## 📁 **Структура файлов**

```
student-ai-assistant/
├── .env                    # Конфигурация API ключей
├── requirements.txt        # Python зависимости
├── scripts/
│   ├── test_api.py            # Полные тесты всех функций
│   ├── quick_test.py          # Быстрый тест с примером
│   └── interactive_test.py    # Интерактивный тестер
├── ML_SETUP_GUIDE.md     # Руководство по установке
├── ML_documentation.md    # Этот файл
│
├── ml/                    # Основной ML модуль
│   ├── __init__.py       # Экспорт классов
│   ├── deepseek_processor.py  # Главный класс DeepSeek
│   └── prompts.py        # Шаблоны промптов
│
└── api/                  # FastAPI эндпоинты (для будущей интеграции)
    ├── __init__.py
    └── ml_endpoints.py   # REST API для веб-интерфейса
```

---

## 🔧 **Описание файлов**

### **1. Основные файлы конфигурации**

#### `.env` - Настройки API
```bash
# DeepSeek API Configuration
DEEPSEEK_API_KEY=sk-your-key-here  # Твой API ключ
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# ML Processing Settings
MAX_TOKENS=2048          # Максимум токенов в ответе
TEMPERATURE=0.3          # Креативность модели (0.0-2.0)
TOP_P=0.95              # Качество генерации
```

#### `requirements.txt` - Python зависимости
Содержит все необходимые библиотеки: openai (для DeepSeek), fastapi, pydantic и др.

---

### **2. ML модуль (`ml/` папка)**

#### `ml/deepseek_processor.py` - 🧠 Главный класс
**Назначение**: Основной класс для работы с DeepSeek API

**Главные методы**:
```python
class DeepSeekProcessor:
    def __init__(self)                    # Инициализация API клиента
    def summarize(text)                   # Создание конспекта
    def extract_terms(text)               # Извлечение терминов
    def expand_topic(topic, context)      # Расширение темы
    def generate_questions(text)          # Вопросы для самопроверки
    def create_detailed_notes(text)       # Расширенный конспект с детальным описанием терминов
    def batch_process(text, modes)        # Пакетная обработка
    def health_check()                    # Проверка API
```

**Пример использования**:
```python
from ml.deepseek_processor import DeepSeekProcessor

processor = DeepSeekProcessor()
summary = processor.summarize("Текст лекции...")
```

#### `ml/prompts.py` - 📝 Шаблоны промптов
**Назначение**: Все промпты для разных типов обработки

**Основные промпты**:
- `SYSTEM_PROMPT` - Общий системный промпт
- `SUMMARIZE_PROMPT` - Для создания конспектов
- `EXTRACT_TERMS_PROMPT` - Для извлечения терминов
- `EXPAND_TOPIC_PROMPT` - Для расширения тем
- `GENERATE_QUESTIONS_PROMPT` - Для генерации вопросов
- `DETAILED_NOTES_PROMPT` - Для расширенных конспектов с детальным описанием терминов

**Как редактировать промпты**:
```python
# Найди нужный промпт и измени его
SUMMARIZE_PROMPT = """
Твои инструкции для ИИ здесь...

ТРЕБОВАНИЯ:
1. Твои требования
2. Твой формат

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

#### `scripts/test_api.py` - 🧪 Полное тестирование
**Назначение**: Комплексное тестирование всех функций ML модуля

**Что тестирует**:
- ✅ Подключение к DeepSeek API
- ✅ Создание конспектов
- ✅ Извлечение терминов
- ✅ Расширение тем
- ✅ Генерацию вопросов
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

---

### **4. API модуль (`api/` папка)**

#### `api/ml_endpoints.py` - 🌐 FastAPI эндпоинты
**Назначение**: REST API для интеграции с веб-фронтендом (React)

**Основные эндпоинты**:
- `GET /api/ml/health` - Проверка работоспособности
- `POST /api/ml/process` - Обработка текста
- `POST /api/ml/batch-process` - Пакетная обработка
- `GET /api/ml/modes` - Список доступных режимов
- `POST /api/ml/quick-summary` - Быстрый конспект

---

## 🚀 **Руководство по использованию**

### **Шаг 1: Настройка**

1. **Установи зависимости**:
```bash
pip install -r requirements.txt
```

2. **Добавь API ключ в `.env`**:
```bash
DEEPSEEK_API_KEY=sk-твой-ключ-здесь
```

### **Шаг 2: Тестирование**

#### **Полное тестирование**:
```powershell
python scripts/test_api.py
```
Результат: Все функции протестированы с готовыми примерами

#### **Быстрый тест**:
```powershell
python scripts/quick_test.py
```
Результат: Быстрая проверка основных функций

#### **Интерактивный режим**:
```powershell
python scripts/interactive_test.py
```
Результат: Меню для тестирования со своими текстами

### **Шаг 3: Использование в коде**

#### **Базовое использование**:
```python
from ml.deepseek_processor import DeepSeekProcessor

# Инициализация
processor = DeepSeekProcessor()

# Твой текст лекции
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
modes = ['summarize', 'extract_terms', 'generate_questions']
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
        "max_tokens": 2048,     # Максимум слов в ответе
        "temperature": 0.3,     # Креативность (0.0-2.0)
        "top_p": 0.9           # Качество (0.0-1.0)
    }
}
```

---

## 🔍 **Режимы обработки**

| Режим | Описание | Пример использования |
|-------|----------|---------------------|
| `summarize` | Краткий структурированный конспект (~30% текста) | `processor.summarize(text)` |
| `extract_terms` | Ключевые термины с определениями | `processor.extract_terms(text)` |
| `expand_topic` | Подробное объяснение сложной темы | `processor.expand_topic("тема", text)` |
| `generate_questions` | Вопросы для самопроверки | `processor.generate_questions(text)` |
| `detailed_notes` | Расширенный конспект с максимально подробным описанием всех терминов (2-3x больше исходного текста) | `processor.create_detailed_notes(text)` |

### **🆕 Новый режим: Расширенный конспект (detailed_notes)**

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
- **summarize**: краткий обзор (~30% текста, 30-40 сек)
- **detailed_notes**: глубокое изучение (2-3x больше, 60-90 сек)
- **extract_terms**: список терминов + краткие определения (30-40 сек)

> **Примечание:** Режим `mindmap` был заменен на `detailed_notes`. Для визуализации структуры используй режим `summarize`.

---

## 🐛 **Обработка ошибок**

### **Частые проблемы и решения**:

#### **1. "DEEPSEEK_API_KEY не найден"**
**Причина**: API ключ не установлен
**Решение**: Добавь ключ в файл `.env`

#### **2. "Insufficient Balance"** 
**Причина**: На аккаунте DeepSeek нет средств
**Решение**: Пополни баланс на platform.deepseek.com

#### **3. "Import could not be resolved"**
**Причина**: Не установлены зависимости  
**Решение**: `pip install -r requirements.txt`

#### **4. "Ошибка DeepSeek API: 429"**
**Причина**: Превышен лимит запросов
**Решение**: Подожди несколько минут и попробуй снова

### **Проверка работоспособности**:
```python
processor = DeepSeekProcessor()
if processor.health_check():
    print("✅ API работает")
else:
    print("❌ Проблемы с API")
```

---

## 📊 **Производительность**

### **Время обработки** (примерно):
- Короткий текст (100-300 слов): 2-5 секунд
- Средний текст (300-1000 слов): 5-15 секунд  
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
```

2. **Добавь метод в `DeepSeekProcessor`**:
```python
def new_mode(self, text: str) -> str:
    return self.process_text(text, "new_mode")
```

3. **Обнови конфиг**:
```python
PROCESSING_CONFIGS["new_mode"] = {
    "max_tokens": 1500,
    "temperature": 0.4
}
```

---

## 🔗 **Полезные ссылки**

- [DeepSeek API Documentation](https://platform.deepseek.com/api-docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)

---

## ✅ **Чек-лист готовности**

- [ ] API ключ добавлен в `.env`
- [ ] Зависимости установлены
- [ ] `python scripts/test_api.py` проходит успешно
- [ ] `python scripts/quick_test.py` работает с твоим текстом
- [ ] Промпты настроены под твои нужды
- [ ] Интерактивный тестер запускается
- [ ] Документация изучена

---

**🎯 ML модуль готов к использованию! Удачи в разработке студенческого ассистента! 🚀**