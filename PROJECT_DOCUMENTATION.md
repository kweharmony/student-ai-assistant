# 📚 Student AI Assistant - Полная документация проекта

## 📖 Обзор проекта

**Student AI Assistant** — веб-платформа для автоматической обработки студенческих лекций с использованием искусственного интеллекта. Система объединяет транскрибацию аудио (Whisper AI), фильтрацию текста и создание учебных материалов (Google Gemini API).

### 🎯 Основные возможности

1. **🎙️ Транскрибация аудио** - Конвертация аудиозаписей лекций в текст (Whisper AI, локально)
2. **🧹 AI-фильтрация** - Очистка транскрибированного текста от ошибок распознавания
3. **📝 Создание конспектов** - Автоматическое структурирование материала
4. **📚 Извлечение терминов** - Список ключевых понятий с определениями
5. **❓ Генерация вопросов** - Вопросы для самопроверки
6. **🧾 Создание шпаргалок** - Компактные памятки для быстрого повторения
7. **🔍 Расширенные конспекты** - Детальный разбор всех терминов
8. **📄 Экспорт** - Сохранение в PDF, DOCX, TXT

---

## 🏗️ Архитектура проекта

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + TypeScript)            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Главная    │  │   Личный     │  │  Обработка   │      │
│  │   страница   │  │   кабинет    │  │    текста    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI + Python)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              API Endpoints                           │   │
│  │  • /api/transcribe/*  - Транскрибация               │   │
│  │  • /api/ml/*          - Обработка конспектов        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                     ML МОДУЛЬ (Python)                      │
│  ┌──────────────────┐        ┌──────────────────┐          │
│  │  Whisper AI      │        │  Gemini API      │          │
│  │  (локально)      │        │  (Google)        │          │
│  │                  │        │                  │          │
│  │ • Транскрибация  │        │ • Фильтрация     │          │
│  │   аудио          │        │ • Конспекты      │          │
│  │                  │        │ • Термины        │          │
│  └──────────────────┘        │ • Вопросы        │          │
│                              └──────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Структура проекта

```
student-ai-assistant/
│
├── 📄 Конфигурация
│   ├── .env                        # API ключи и настройки
│   ├── package.json                # Node.js зависимости
│   ├── requirements.txt            # Python зависимости
│   ├── tsconfig.json              # TypeScript конфигурация
│   └── tailwind.config.js         # Tailwind CSS настройки
│
├── 📚 Документация
│   ├── PROJECT_DOCUMENTATION.md    # Общая документация (этот файл)
│   ├── ML_documentation.md         # Документация ML модуля
│   ├── CHANGELOG_TRANSCRIPTION.md  # История транскрибатора
│   ├── WHISPER_INSTALL.md         # Установка Whisper
│   ├── QUICK_START_TRANSCRIPTION.md # Быстрый старт
│   └── README.md                   # Основной README
│
├── 🎨 Frontend (React + TypeScript)
│   ├── public/
│   │   └── index.html             # Основной HTML
│   │
│   └── src/
│       ├── index.tsx              # Точка входа React
│       ├── App.tsx                # Главный компонент
│       ├── index.css              # Глобальные стили
│       │
│       ├── components/            # React компоненты
│       │   ├── Header.tsx         # Шапка сайта
│       │   ├── Footer.tsx         # Подвал сайта
│       │   ├── Hero.tsx           # Главный экран
│       │   ├── Features.tsx       # Возможности
│       │   ├── HowItWorks.tsx     # Как это работает
│       │   ├── AccountPage.tsx    # Личный кабинет ⭐
│       │   ├── RichTextEditor.tsx # WYSIWYG редактор
│       │   ├── AuthPage.tsx       # Авторизация
│       │   └── PricingPage.tsx    # Тарифы
│       │
│       ├── hooks/                 # React хуки
│       │   ├── useFileUpload.ts   # Загрузка файлов
│       │   ├── useMLProcessor.ts  # Обработка ML
│       │   └── useExport.ts       # Экспорт документов
│       │
│       ├── contexts/              # React контексты
│       │   └── ThemeContext.tsx   # Темная/светлая тема
│       │
│       └── types/                 # TypeScript типы
│           ├── ml.ts              # Типы для ML
│           └── modules.d.ts       # Типы модулей
│
├── 🔧 Backend (FastAPI + Python)
│   └── api/
│       ├── __init__.py
│       ├── app.py                 # Главное FastAPI приложение
│       ├── transcribe.py          # API транскрибации ⭐
│       └── ml_endpoints.py        # API обработки конспектов ⭐
│
├── 🤖 ML модуль (Python)
│   └── ml/
│       ├── __init__.py            # Экспорт классов
│       │
│       ├── gemini_processor.py    # Обработчик конспектов ⭐
│       ├── prompts.py             # Промпты для конспектов
│       │
│       ├── transcription_filter.py # Фильтратор транскрибаций ⭐
│       └── filter_prompts.py      # Промпты для фильтрации
│
├── 🧪 Скрипты и тесты
│   ├── scripts/
│   │   ├── test_cheat_sheet_advanced.py
│   │   └── download_model.py      # Загрузка Whisper моделей
│   │
│   ├── start_api_medium.bat       # Запуск API (Windows)
│   └── start_api_medium.sh        # Запуск API (macOS/Linux)
│
└── 📦 Build
    └── build/                     # Собранный фронтенд
```

---

## 🎨 Frontend - React приложение

### Технологический стек

- **React 18** - UI библиотека
- **TypeScript** - Типизация
- **React Router** - Навигация
- **TipTap** - WYSIWYG редактор
- **Tailwind CSS** - Стилизация
- **Framer Motion** - Анимации

### Основные компоненты

#### 1. `AccountPage.tsx` - Личный кабинет (главный компонент)

**Разделы:**
- 📊 **Главная панель** - Статистика и быстрые действия
- 🎙️ **Транскрибатор** - Загрузка и обработка аудио
- ✍️ **Обработка текста** - AI-обработка конспектов
- 📅 **Расписание** - Календарь занятий
- 📁 **Мои записи** - История обработанных лекций

**Ключевые функции:**

```typescript
// Транскрибация аудио
const handleAudioTranscription = async (file: File) => {
  const formData = new FormData();
  formData.append('audio', file);
  
  const response = await fetch('http://localhost:8000/api/transcribe/audio', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  // Показать модальное окно фильтрации
  setTranscribedText(result.text);
  setShowFilterModal(true);
}

// AI-фильтрация транскрибированного текста
const handleApplyFilter = async () => {
  const response = await fetch('http://localhost:8000/api/transcribe/filter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: transcribedText })
  });
  
  const result = await response.json();
  editorInstance.commands.setContent(result.filtered_text);
}

// Обработка текста с помощью AI
const handleProcess = async () => {
  const response = await fetch('http://localhost:8000/api/ml/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      text: originalText, 
      mode: processingMode 
    })
  });
  
  const result = await response.json();
  setProcessedText(result.processed_text);
}
```

**Состояния:**
- `activeSection` - Текущий раздел ('dashboard' | 'transcription' | 'text-processing' | 'schedule' | 'records')
- `isTranscribing` - Идет ли транскрибация
- `showFilterModal` - Показать модальное окно фильтрации
- `isFiltering` - Идет ли фильтрация
- `isProcessing` - Идет ли ML обработка
- `processingMode` - Режим обработки ('summarize' | 'extract_terms' | и др.)
- `originalText` - Исходный текст в редакторе
- `processedText` - Обработанный AI текст
- `editorMode` - Режим редактора ('original' | 'processed' | 'split')

#### 2. `RichTextEditor.tsx` - WYSIWYG редактор

**Возможности:**
- Форматирование текста (жирный, курсив, подчеркивание)
- Заголовки (H1, H2, H3)
- Списки (нумерованные, маркированные)
- Таблицы
- Код (блоки и инлайн)
- Ссылки
- Экспорт в PDF/DOCX/TXT

**Расширения TipTap:**
```typescript
const extensions = [
  StarterKit,
  Underline,
  Link,
  Table,
  TableRow,
  TableCell,
  TableHeader,
  Highlight,
  TextAlign
]
```

#### 3. Модальные окна

**Прогресс транскрибации:**
- Анимированный спиннер
- Прогресс-бар
- Информация о текущем этапе
- Нельзя закрыть во время обработки

**Модальное окно фильтрации:**
- Выбор: применить AI-фильтр или пропустить
- Кнопки: "Обработать с ИИ" и "Пропустить"
- Автоматически открывается после транскрибации

**Модальное окно ошибки:**
- Красная иконка предупреждения
- Описание ошибки
- Кнопка "Понятно"

### Хуки (Custom Hooks)

#### `useFileUpload.ts`
```typescript
// Загрузка аудиофайла
const { uploadFile, isUploading } = useFileUpload();

const handleUpload = async (file: File) => {
  const result = await uploadFile(file, '/api/transcribe/audio');
  console.log(result.text);
}
```

#### `useMLProcessor.ts`
```typescript
// Обработка текста
const { processText, isProcessing } = useMLProcessor();

const result = await processText(text, 'summarize');
```

#### `useExport.ts`
```typescript
// Экспорт документа
const { exportToPDF, exportToDocx, exportToTxt } = useExport();

await exportToPDF(content, 'конспект.pdf');
```

### Контексты

#### `ThemeContext.tsx`
```typescript
// Управление темой
const { theme, toggleTheme } = useTheme();
// theme: 'light' | 'dark'
```

---

## 🔧 Backend - FastAPI приложение

### Технологический стек

- **FastAPI** - Веб-фреймворк
- **Uvicorn** - ASGI сервер
- **Pydantic** - Валидация данных
- **Python 3.10+**

### Структура API

#### `api/app.py` - Главное приложение

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.transcribe import router as transcribe_router
from api.ml_endpoints import router as ml_router

app = FastAPI(title="Student AI Assistant API")

# CORS для фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(transcribe_router)
app.include_router(ml_router)
```

#### `api/transcribe.py` - API транскрибации

**Эндпоинты:**

1. **POST /api/transcribe/audio** - Транскрибация аудио
   ```python
   @router.post("/audio", response_model=TranscriptionResponse)
   async def transcribe_audio(audio: UploadFile = File(...)):
       # Сохранение временного файла
       # Транскрибация через Whisper
       # Возврат текста
   ```

2. **POST /api/transcribe/filter** - AI-фильтрация текста
   ```python
   @router.post("/filter", response_model=FilterResponse)
   async def filter_transcription(request: FilterRequest):
       filter_instance = TranscriptionFilter()
       filtered_text = filter_instance.filter_text(request.text)
       return FilterResponse(
           success=True,
           filtered_text=filtered_text,
           original_length=len(request.text),
           filtered_length=len(filtered_text)
       )
   ```

3. **GET /api/transcribe/health** - Проверка Whisper
4. **GET /api/transcribe/model-info** - Информация о модели
5. **GET /api/transcribe/filter/health** - Проверка AI-фильтра

**Модели данных:**
```python
class TranscriptionResponse(BaseModel):
    success: bool
    text: str
    filename: str
    duration: Optional[float]
    language: Optional[str]
    processing_time: Optional[float]

class FilterRequest(BaseModel):
    text: str

class FilterResponse(BaseModel):
    success: bool
    filtered_text: str
    original_length: int
    filtered_length: int
    processing_time: float
```

**Особенности:**
- Автоматический поиск FFmpeg в PATH
- Поддержка всех аудио/видео форматов
- Retry логика для AI-фильтра (3 попытки)
- Safety фильтры отключены для фильтрации
- Timeout 2 минуты для Gemini API

#### `api/ml_endpoints.py` - API обработки конспектов

**Эндпоинты:**

1. **POST /api/ml/process** - Обработка текста в одном режиме
   ```python
   @router.post("/process")
   async def process_text(request: ProcessRequest):
       processor = GeminiProcessor()
       
       if request.mode == 'summarize':
           result = processor.summarize(request.text)
       elif request.mode == 'extract_terms':
           result = processor.extract_terms(request.text)
       # и т.д.
       
       return ProcessResponse(
           success=True,
           mode=request.mode,
           processed_text=result
       )
   ```

2. **POST /api/ml/batch-process** - Пакетная обработка
   ```python
   @router.post("/batch-process")
   async def batch_process_text(request: BatchProcessRequest):
       processor = GeminiProcessor()
       results = processor.batch_process(request.text, request.modes)
       return BatchProcessResponse(success=True, results=results)
   ```

3. **GET /api/ml/health** - Проверка Gemini API
4. **GET /api/ml/modes** - Список доступных режимов

**Модели данных:**
```python
class ProcessRequest(BaseModel):
    text: str
    mode: str  # 'summarize', 'extract_terms', и др.
    topic: Optional[str] = None  # Для expand_topic

class ProcessResponse(BaseModel):
    success: bool
    mode: str
    processed_text: str
    processing_time: Optional[float]

class BatchProcessRequest(BaseModel):
    text: str
    modes: List[str]

class BatchProcessResponse(BaseModel):
    success: bool
    results: Dict[str, str]
    processing_time: Optional[float]
```

**Доступные режимы:**
- `summarize` - Краткий конспект
- `extract_terms` - Извлечение терминов
- `expand_topic` - Расширение темы
- `generate_questions` - Генерация вопросов
- `detailed_notes` - Расширенный конспект
- `cheat_sheet` - Компактная шпаргалка

---

## 🤖 ML модуль - Обработка текста

### Архитектура ML модуля

ML модуль разделен на **два независимых компонента**:

```
┌──────────────────────────────────────────────────────┐
│              ML МОДУЛЬ                               │
│                                                      │
│  ┌────────────────────┐  ┌─────────────────────┐   │
│  │  TranscriptionFilter│  │  GeminiProcessor    │   │
│  │  (фильтрация)      │  │  (конспекты)        │   │
│  │                    │  │                     │   │
│  │ • Исправление      │  │ • Создание          │   │
│  │   ошибок Whisper   │  │   конспектов        │   │
│  │ • Удаление         │  │ • Извлечение        │   │
│  │   паразитов        │  │   терминов          │   │
│  │ • Форматирование   │  │ • Генерация         │   │
│  │                    │  │   вопросов          │   │
│  │ Модель:            │  │ • Шпаргалки         │   │
│  │ gemini-1.5-flash   │  │                     │   │
│  │ Temperature: 0.2   │  │ Модель:             │   │
│  │ Max tokens: 8000   │  │ gemini-2.5-flash    │   │
│  │                    │  │ Temperature: 0.3-0.7│   │
│  └────────────────────┘  └─────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### 1. TranscriptionFilter - Фильтрация транскрибаций

**Файлы:**
- `ml/transcription_filter.py` - Класс фильтратора
- `ml/filter_prompts.py` - Промпты для фильтрации

**Назначение:** Очистка текста после Whisper от ошибок распознавания

**Основной класс:**
```python
from ml.transcription_filter import TranscriptionFilter

filter_instance = TranscriptionFilter()
filtered = filter_instance.filter_text("эээ сегодня мы рассмотрим масинное абучение...")
# Результат: "Сегодня мы рассмотрим машинное обучение..."
```

**Что исправляет:**
1. ✅ Орфографические ошибки ("масинное" → "машинное")
2. ✅ Фразы-паразиты ("ээ", "ну", "вот", "значит")
3. ✅ Пунктуацию и форматирование
4. ✅ Разделение на абзацы
5. ✅ Технические термины ("интиграл" → "интеграл")
6. ✅ SQL команды ("делит фрог" → "DELETE FROM")
7. ✅ Артефакты распознавания

**Промпт (ml/filter_prompts.py):**
```python
TRANSCRIPTION_FILTER_PROMPT = """
Ты — эксперт по обработке транскрибированного текста студенческих лекций.

ТВОЯ МИССИЯ:
Преобразовать сырой текст в чистый, структурированный материал.

ПРИОРИТЕТЫ:
1. Восстановление технических терминов
2. Удаление артефактов
3. Исправление орфографии
4. Структурирование по абзацам
...
"""
```

**Конфигурация:**
```python
TRANSCRIPTION_FILTER_CONFIG = {
    "temperature": 0.2,      # Низкая креативность (точность важнее)
    "max_tokens": 8000,      # Большой лимит для длинных лекций
    "top_p": 0.9
}
```

**Особенности реализации:**
- Retry логика (3 попытки при ошибках)
- Timeout 120 секунд
- Safety фильтры отключены (`BLOCK_NONE`)
- Автоматический fallback на оригинальный текст при ошибке
- Логирование первых 150 символов до/после фильтрации

### 2. GeminiProcessor - Обработка конспектов

**Файлы:**
- `ml/gemini_processor.py` - Класс процессора
- `ml/prompts.py` - Промпты для обработки

**Назначение:** Создание учебных материалов из текста лекций

**Основной класс:**
```python
from ml.gemini_processor import GeminiProcessor

processor = GeminiProcessor()

# Создание конспекта
summary = processor.summarize("Текст лекции...")

# Извлечение терминов
terms = processor.extract_terms("Текст лекции...")

# Генерация вопросов
questions = processor.generate_questions("Текст лекции...")

# Создание шпаргалки
cheat_sheet = processor.create_cheat_sheet("Текст лекции...")

# Расширенный конспект
detailed = processor.create_detailed_notes("Текст лекции...")

# Расширение темы
explanation = processor.expand_topic("квантовая механика", "Контекст...")

# Пакетная обработка
results = processor.batch_process("Текст...", ['summarize', 'extract_terms'])
```

**Режимы обработки:**

| Режим | Описание | Temperature | Max Tokens | Время |
|-------|----------|-------------|------------|-------|
| `summarize` | Краткий конспект (~30% текста) | 0.3 | 2048 | 30-40с |
| `extract_terms` | Термины с определениями | 0.2 | 2048 | 30-40с |
| `expand_topic` | Подробное объяснение темы | 0.5 | 2048 | 40-50с |
| `generate_questions` | Вопросы для самопроверки | 0.7 | 1024 | 20-30с |
| `detailed_notes` | Расширенный конспект (2-3x больше) | 0.3 | 4096 | 60-90с |
| `cheat_sheet` | Компактная шпаргалка | 0.2 | 3000 | 20-30с |

**Пример промпта (ml/prompts.py):**
```python
SUMMARIZE_PROMPT = """
Ты — эксперт по созданию конспектов студенческих лекций.

ЦЕЛЬ: Создать краткий структурированный конспект (~30% от исходного текста).

ТРЕБОВАНИЯ:
1. Сохрани все ключевые идеи и термины
2. Используй эмодзи для наглядности
3. Структурируй по разделам
4. Выдели важные моменты
5. Добавь итоговые выводы

ФОРМАТ ОТВЕТА:
# 📚 [Название темы]

## 🎯 Основные тезисы
- Тезис 1
- Тезис 2

## 📖 Ключевые термины
**Термин** — определение

## ✅ Выводы

⚠️ УПРАВЛЕНИЕ ЛИМИТОМ ТОКЕНОВ:
Твой лимит: {max_tokens} токенов (~{approx_words} слов)
...

Текст лекции:
{text}

Конспект:
"""
```

**Управление лимитом токенов:**

Каждый промпт содержит специальный блок для предотвращения обрывов:

```python
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

**Эффект:** Обрывы текста снижены с ~30% до <1%

---

## 🎙️ Транскрибация - Whisper AI

### Технология

- **Модель:** OpenAI Whisper (локальная)
- **Движок:** FFmpeg для обработки аудио
- **Язык:** Русский (автоопределение)
- **Работа:** Полностью офлайн, без API

### Поддерживаемые форматы

**Аудио:** mp3, wav, m4a, flac, ogg, opus  
**Видео:** mp4, mov, avi, mkv, webm

### Модели Whisper

| Модель | Размер | Качество | Рекомендация |
|--------|--------|----------|--------------|
| tiny | ~75 MB | Низкое | Тесты |
| base | ~150 MB | Среднее | Быстрая проверка |
| **small** | **~500 MB** | **Хорошее** | **Лекции** ⭐ |
| medium | ~1.5 GB | Очень хорошее | Длинные лекции |
| large | ~3 GB | Максимальное | Профессиональное |

### Время обработки (модель medium)

- **5 минут аудио:** ~30 сек - 1 мин
- **30 минут аудио:** ~3-5 мин
- **60 минут аудио:** ~6-10 мин

*Зависит от CPU*

### Workflow транскрибации

```
┌─────────────────┐
│ 1. Загрузка     │
│    аудиофайла   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Whisper AI   │
│    транскрибация│
│    (3-10 мин)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. Модальное    │
│    окно выбора  │
│ ┌─────┐ ┌─────┐ │
│ │ ИИ  │ │Проп.││
│ └─────┘ └─────┘ │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────────┐
│Без     │ │С AI-       │
│фильтра │ │фильтрацией │
│        │ │(Gemini)    │
└───┬────┘ └────┬───────┘
    │           │
    └─────┬─────┘
          ▼
   ┌──────────────┐
   │ 4. Текст в   │
   │    редакторе │
   └──────────────┘
```

### Установка Whisper

```bash
# 1. Установка FFmpeg (Windows)
winget install ffmpeg

# 2. Установка Python зависимостей
pip install -r requirements.txt

# 3. Загрузка модели
python download_model.py
# Выберите модель: medium

# 4. Запуск API
start_api_medium.bat  # Windows
# или
./start_api_medium.sh  # macOS/Linux
```

---

## ⚙️ Настройка и конфигурация

### Файл .env

```bash
# ============================================
# GOOGLE GEMINI API
# ============================================
# Получить ключ: https://aistudio.google.com/apikey
GEMINI_API_KEY=your_api_key_here

# Модель для создания конспектов
GEMINI_MODEL=gemini-2.5-flash

# Модель для фильтрации транскрибаций (опционально)
GEMINI_FILTER_MODEL=gemini-1.5-flash

# ============================================
# ML PROCESSING SETTINGS
# ============================================
MAX_TOKENS=10000
TEMPERATURE=0.3
TOP_P=0.95

# ============================================
# WHISPER TRANSCRIPTION
# ============================================
# Модель Whisper (tiny/base/small/medium/large)
WHISPER_MODEL=medium

# ============================================
# APPLICATION SETTINGS
# ============================================
DEBUG=True
LOG_LEVEL=INFO

# Frontend API URL
REACT_APP_API_URL=http://localhost:8000
```

### Переменные окружения

| Переменная | Описание | Значение по умолчанию |
|------------|----------|---------------------|
| `GEMINI_API_KEY` | API ключ Google Gemini | - (обязательно) |
| `GEMINI_MODEL` | Модель для конспектов | `gemini-2.5-flash` |
| `GEMINI_FILTER_MODEL` | Модель для фильтрации | `gemini-1.5-flash` |
| `WHISPER_MODEL` | Модель Whisper | `medium` |
| `MAX_TOKENS` | Макс. токенов | `10000` |
| `TEMPERATURE` | Креативность | `0.3` |
| `TOP_P` | Качество генерации | `0.95` |
| `DEBUG` | Режим отладки | `True` |
| `LOG_LEVEL` | Уровень логов | `INFO` |

---

## 🚀 Запуск проекта

### Требования

- **Node.js** 16+ (для фронтенда)
- **Python** 3.10+ (для бэкенда)
- **FFmpeg** (для транскрибации)
- **Git** (опционально)

### Установка

```bash
# 1. Клонирование репозитория
git clone https://github.com/kweharmony/student-ai-assistant.git
cd student-ai-assistant

# 2. Установка зависимостей Python
python -m venv .venv
.venv\Scripts\activate  # Windows
# или
source .venv/bin/activate  # macOS/Linux

pip install -r requirements.txt

# 3. Установка зависимостей Node.js
npm install

# 4. Настройка .env
# Создайте файл .env и добавьте GEMINI_API_KEY

# 5. Установка FFmpeg
winget install ffmpeg  # Windows
# или
brew install ffmpeg  # macOS

# 6. Загрузка модели Whisper
python download_model.py
# Выберите: medium
```

### Запуск Backend (FastAPI)

```bash
# Активировать виртуальное окружение
.venv\Scripts\activate

# Установить модель Whisper
set WHISPER_MODEL=medium

# Запустить API
python -m uvicorn api.app:app --reload --host 0.0.0.0 --port 8000

# Или через скрипт
start_api_medium.bat  # Windows
./start_api_medium.sh  # macOS/Linux
```

**API доступен:** http://localhost:8000  
**Документация:** http://localhost:8000/docs

### Запуск Frontend (React)

```bash
# Development режим
npm start

# Production build
npm run build

# Запуск собранной версии
npm install -g serve
serve -s build
```

**Приложение доступно:** http://localhost:3000

---

## 📊 Производительность

### Время обработки

| Операция | Входные данные | Время |
|----------|----------------|-------|
| Транскрибация (small) | 30 мин аудио | ~3-5 мин |
| Транскрибация (medium) | 30 мин аудио | ~5-8 мин |
| AI-фильтрация | 5000 символов | ~10-20 сек |
| Создание конспекта | 5000 символов | ~30-40 сек |
| Извлечение терминов | 5000 символов | ~30-40 сек |
| Генерация вопросов | 5000 символов | ~20-30 сек |
| Расширенный конспект | 5000 символов | ~60-90 сек |
| Шпаргалка | 5000 символов | ~20-30 сек |

### Лимиты API

**Google Gemini (бесплатный тариф):**
- 15 запросов/минуту
- 1,500 запросов/день
- 1M токенов/минуту

**Whisper (локально):**
- Без лимитов (зависит от CPU)

### Оптимизация

1. **Пакетная обработка** - используйте `batch_process()` для нескольких режимов
2. **Кэширование** - сохраняйте результаты обработки
3. **Модель Whisper** - используйте `small` для быстрой транскрибации
4. **Уменьшение токенов** - снизьте `max_tokens` для ускорения

---

## 🐛 Troubleshooting

### Frontend

#### Ошибка: "Cannot find module 'framer-motion'"
```bash
npm install framer-motion
```

#### Ошибка: "Failed to fetch"
- Проверьте, запущен ли backend на http://localhost:8000
- Проверьте CORS настройки в `api/app.py`

#### Ошибка компиляции TypeScript
```bash
npm install --save-dev @types/node @types/react @types/react-dom
```

### Backend

#### Ошибка: "GEMINI_API_KEY не найден"
- Добавьте ключ в `.env`
- Получите ключ: https://aistudio.google.com/apikey

#### Ошибка: "Module 'google.generativeai' not found"
```bash
pip install google-generativeai==0.8.3
```

#### Ошибка: "FFmpeg not found"
```bash
# Windows
winget install ffmpeg

# macOS
brew install ffmpeg

# Linux
sudo apt-get install ffmpeg
```

#### Ошибка: "Whisper model not found"
```bash
python download_model.py
# Выберите нужную модель
```

### ML модуль

#### Ошибка: "API key not valid"
- Проверьте правильность ключа на https://aistudio.google.com/apikey
- Убедитесь, что в `.env` нет пробелов после `=`

#### Ошибка: "Resource exhausted"
- Превышен лимит 15 запросов/минуту
- Подождите 1 минуту и повторите

#### Ошибка: "503 The model is overloaded"
- Сервер Google перегружен
- Retry логика автоматически повторит (3 попытки)
- Попробуйте другую модель (`gemini-1.5-flash`)

#### Ошибка: "finish_reason=2" (SAFETY)
- Контент заблокирован фильтром безопасности
- Safety фильтры уже отключены в `transcription_filter.py`
- Если повторяется - сообщите о проблеме

---

## 📦 Зависимости

### Python (requirements.txt)

```txt
# Google Gemini API
google-generativeai==0.8.3

# Веб-фреймворк
fastapi==0.104.1
uvicorn[standard]==0.24.0

# Обработка данных
pydantic==2.9.0
python-dotenv==1.0.0
python-multipart==0.0.6
aiofiles==23.2.1

# Транскрибация
openai-whisper
ffmpeg-python
torch
torchaudio
tqdm
requests

# Для работы с документами
PyPDF2==3.0.1
python-docx==0.8.11

# Тестирование
pytest==7.4.0
httpx==0.25.0

# Продакшен
gunicorn==21.2.0
```

### Node.js (package.json)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@tiptap/react": "^2.1.13",
    "@tiptap/starter-kit": "^2.1.13",
    "@tiptap/extension-underline": "^2.1.13",
    "@tiptap/extension-link": "^2.1.13",
    "@tiptap/extension-table": "^2.1.13",
    "framer-motion": "^10.16.5",
    "tailwindcss": "^3.3.5",
    "typescript": "^4.9.5"
  }
}
```

---

## 📚 Дополнительная документация

### Основные файлы

- **PROJECT_DOCUMENTATION.md** (этот файл) - Полная документация проекта
- **ML_documentation.md** - Подробная документация ML модуля
- **CHANGELOG_TRANSCRIPTION.md** - История изменений транскрибатора
- **WHISPER_INSTALL.md** - Установка и настройка Whisper
- **QUICK_START_TRANSCRIPTION.md** - Быстрый старт (5 минут)
- **README.md** - Краткое описание проекта

### Полезные ссылки

- **Google Gemini API:** https://ai.google.dev/
- **API ключ:** https://aistudio.google.com/apikey
- **OpenAI Whisper:** https://github.com/openai/whisper
- **FFmpeg:** https://ffmpeg.org/
- **FastAPI:** https://fastapi.tiangolo.com/
- **React:** https://react.dev/
- **TipTap:** https://tiptap.dev/

---

## 👥 Команда разработки

- **ML-инженер (текст)** - ML модуль для обработки конспектов
- **ML-инженер (аудио)** - Интеграция Whisper транскрибации
- **Fullstack разработчик** - Frontend (React) + Backend (FastAPI)

---

## 📄 Лицензия

MIT License

---

## 🎯 Roadmap

### v1.0 (Текущая версия) ✅
- ✅ Транскрибация аудио (Whisper AI)
- ✅ AI-фильтрация транскрибаций
- ✅ Создание конспектов
- ✅ Извлечение терминов
- ✅ Генерация вопросов
- ✅ Шпаргалки
- ✅ Расширенные конспекты
- ✅ Экспорт (PDF/DOCX/TXT)

### v1.1 (Планируется)
- ⏳ Авторизация пользователей
- ⏳ Сохранение истории обработки
- ⏳ Расписание занятий
- ⏳ Календарь
- ⏳ Темная тема

### v2.0 (Будущее)
- 📋 База знаний (RAG)
- 📋 Мультиязычность
- 📋 Мобильное приложение
- 📋 Кэширование результатов (Redis)
- 📋 Улучшенная аналитика

---

**Версия документации:** 1.0  
**Дата обновления:** 24 ноября 2025  
**Статус:** ✅ Актуальная
