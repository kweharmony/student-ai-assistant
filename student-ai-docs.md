# Student AI Assistant - Техническая документация по Frontend и Backend

> **Примечание:** Эта документация описывает только фронтенд и бэкенд части веб-приложения. Документация по ML-модулю находится в `ML_documentation.md`.

---

## 📋 Описание проекта

**Student AI Assistant** — полнофункциональное веб-приложение для работы с учебными материалами. Позволяет:
- 🎙 Транскрибировать аудиозаписи лекций (через Nexara API)
- 📝 Редактировать текст в WYSIWYG редакторе
- 🤖 Обрабатывать текст через ML-модели
- 📄 Экспортировать результаты в 4 форматах (TXT, Markdown, DOCX, PDF)
- 📅 Управлять расписанием и записями лекций

### Основные возможности
1. **Транскрибация аудио** — загрузка аудио/видео файлов и получение текста
2. **Текстовый редактор** — полнофункциональный редактор с форматированием
3. **ML обработка** — 6 режимов обработки текста (конспекты, термины, вопросы и т.д.)
4. **Экспорт** — сохранение в TXT, MD, DOCX, PDF
5. **Календарь** — управление записями по датам
6. **Расписание** — просмотр занятий

---

## 🛠 Технологический стек

### Frontend
| Технология | Версия | Назначение |
|-----------|--------|-----------|
| **React** | 18.2.0 | Основной UI фреймворк |
| **TypeScript** | 4.7.4 | Статическая типизация |
| **React Router DOM** | 6.3.0 | Маршрутизация между страницами |
| **TipTap** | 3.7.2 | WYSIWYG редактор (расширяемый, основан на ProseMirror) |
| **Tailwind CSS** | 3.3.0 | Utility-first CSS фреймворк |

**Библиотеки для экспорта:**
- `file-saver` 2.0.5 — сохранение файлов в браузере
- `jspdf` 2.5.1 — генерация PDF документов
- `html-docx-js` 0.3.1 — конвертация HTML → DOCX
- `pdfmake` 0.2.7 — PDF с кастомными шрифтами
- `docx` 8.5.0 — создание Word документов программно
- `html2canvas` 1.4.1 — рендеринг HTML в canvas (для PDF)

### Backend
| Технология | Назначение |
|-----------|-----------|
| **Python** 3.10+ | Язык бэкенда |
| **FastAPI** | Современный веб-фреймворк для REST API |
| **uvicorn** | ASGI-сервер для запуска приложения |
| **python-dotenv** | Загрузка переменных окружения из `.env` |
| **requests** | HTTP-клиент для внешних API |
| **Nexara API** | Облачный сервис транскрибации (поддержка 9 форматов) |

---

## 🏗 Архитектура приложения

### Структура проекта
```
student-ai-assistant/
├── api/                        # Backend (FastAPI)
│   ├── __init__.py
│   ├── app.py                 # Главный файл приложения (точка входа)
│   ├── ml_endpoints.py        # API endpoints для ML обработки
│   └── transcribe.py          # API endpoints для транскрибации
│
├── ml/                         # ML модуль (документация в ML_documentation.md)
│   ├── __init__.py
│   ├── deepseek_processor.py
│   └── prompts.py
│
├── src/                        # Frontend (React + TypeScript)
│   ├── components/            # React компоненты
│   │   ├── AccountPage.tsx   # Главная страница приложения (личный кабинет)
│   │   ├── AuthPage.tsx      # Страница авторизации/регистрации
│   │   ├── Features.tsx      # Блок "Возможности" (лендинг)
│   │   ├── Footer.tsx        # Футер (лендинг)
│   │   ├── Header.tsx        # Хедер с навигацией
│   │   ├── Hero.tsx          # Главный экран (лендинг)
│   │   ├── HowItWorks.tsx    # Блок "Как это работает"
│   │   ├── RichTextEditor.tsx # Текстовый редактор (TipTap)
│   │   └── UploadDemo.tsx    # Демо загрузки файлов (лендинг)
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── useExport.ts      # Логика экспорта (4 формата)
│   │   └── useFileUpload.ts  # Логика загрузки файлов
│   │
│   ├── types/
│   │   └── modules.d.ts      # TypeScript декларации для модулей
│   │
│   ├── App.tsx               # Корневой компонент с роутингом
│   ├── index.tsx             # Точка входа React-приложения
│   └── index.css             # Глобальные стили + Tailwind
│
├── public/                    # Статические файлы
│   └── index.html            # HTML шаблон
│
├── scripts/                   # Скрипты для тестирования
├── .env                       # Переменные окружения (не в git)
├── .env.example              # Пример файла .env
├── package.json              # npm зависимости
├── tsconfig.json             # Конфигурация TypeScript
├── tailwind.config.js        # Конфигурация Tailwind CSS
└── requirements.txt          # Python зависимости
```

### Общая архитектура

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Лендинг   │  │    Авто     │  │   Личный    │     │
│  │             │  │ ризация     │  │   кабинет   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                            │             │
│                                    ┌───────┴────────┐   │
│                                    │  RichTextEditor │   │
│                                    │  + useExport    │   │
│                                    └────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP Requests
┌──────────────────────┴──────────────────────────────────┐
│              Backend (FastAPI + uvicorn)                 │
│  ┌──────────────────────┐  ┌──────────────────────┐    │
│  │   /api/transcribe/*  │  │    /api/ml/*         │    │
│  │  (Audio → Text)      │  │  (Text Processing)   │    │
│  └──────────┬───────────┘  └─────────┬────────────┘    │
│             │                         │                  │
│     ┌───────┴────────┐       ┌───────┴────────┐        │
│     │  Nexara API    │       │  DeepSeek API  │        │
│     │ (Transcription)│       │  (ML Models)   │        │
│     └────────────────┘       └────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

---

## 🎨 Frontend - Детальное описание

### Маршрутизация (React Router)

Приложение использует **React Router DOM v6** для навигации между страницами:

| Маршрут | Компонент | Описание |
|---------|-----------|----------|
| `/` | Лендинг (Hero + Features + HowItWorks + UploadDemo + Footer) | Главная страница с презентацией проекта |
| `/auth` | `AuthPage` | Страница входа и регистрации |
| `/account` | `AccountPage` | Личный кабинет (основной функционал) |

**Реализация в `App.tsx`:**
```typescript
function App() {
  const [isLightTheme, setIsLightTheme] = useState(false);

  return (
    <Router>
      <div className={isLightTheme ? 'light' : 'dark'}>
        <Header 
          onToggleTheme={() => setIsLightTheme(!isLightTheme)} 
          isLightTheme={isLightTheme} 
        />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Routes>
      </div>
    </Router>
  );
}
```

---

## 📄 Компоненты Frontend

### 1. `Header.tsx` - Навигационная панель

**Описание:** Хедер отображается на всех страницах. Содержит логотип, навигацию и переключатель темы.

**Props:**
```typescript
interface HeaderProps {
  onToggleTheme: () => void;   // Функция переключения темы
  isLightTheme: boolean;        // Текущая тема
}
```

**Особенности:**
- Навигация по секциям лендинга (плавный скролл через якорные ссылки)
- Кнопка "Войти" → переход на `/auth`
- Переключатель темы (☀️ светлая / ☾ тёмная)
- Адаптивная верстка (мобильное меню)

---

### 2. `Hero.tsx` - Главный экран лендинга

**Описание:** Первый экран с призывом к действию и демо-анимацией загрузки файла.

**Основные элементы:**
- Заголовок: "Превратите лекции в знания с помощью ИИ"
- Описание возможностей
- Кнопка "Начать бесплатно" → `/auth`
- Визуализация процесса загрузки файла

---

### 3. `Features.tsx` - Преимущества сервиса

**Описание:** Секция с карточками основных функций:
- 🎙 Транскрибация аудио
- 🤖 AI обработка текста
- 📄 Экспорт в разные форматы
- 📚 Организация материалов

---

### 4. `HowItWorks.tsx` - Процесс работы

**Описание:** Пошаговое объяснение использования сервиса (3 шага):
1. Загрузка файла
2. Выбор режима обработки
3. Получение результата

---

### 5. `UploadDemo.tsx` - Интерактивная демонстрация

**Описание:** Демо загрузки файла с drag-and-drop зоной.

**Использует:** `useFileUpload` hook для симуляции загрузки.

---

### 6. `Footer.tsx` - Футер

**Описание:** Нижний блок с информацией:
- Ссылки на социальные сети
- Контактная информация
- Copyright

---

### 7. `AuthPage.tsx` - Авторизация/Регистрация

**Описание:** Страница с формами входа и регистрации.

**Состояние:**
```typescript
const [isLogin, setIsLogin] = useState(true); // true = вход, false = регистрация
```

**Поля форм:**
- **Вход:** Email, Пароль
- **Регистрация:** Имя, Email, Пароль, Подтверждение пароля

**Примечание:** Сейчас форма статична (нет реальной авторизации). После успешного "входа" редирект на `/account`.

---

### 8. `AccountPage.tsx` - Личный кабинет (главный функционал)

**Описание:** Самый сложный компонент (1177 строк). Объединяет все основные функции приложения.

#### Интерфейсы данных

```typescript
// Запись лекции
interface Record {
  id: string;
  title: string;         // Название лекции
  date: string;          // Дата в формате YYYY-MM-DD
  content: string;       // Текст записи
}

// Элемент расписания
interface ScheduleItem {
  id: string;
  subject: string;       // Название предмета
  time: string;          // Время занятия (например, "09:00 - 10:30")
  room: string;          // Аудитория (например, "Ауд. 301")
  teacher: string;       // Преподаватель
  type: 'lecture' | 'seminar';  // Тип занятия
  date: string;          // Дата YYYY-MM-DD
}
```

#### Основные секции интерфейса

1. **Профиль пользователя**
   - Аватар, имя, email
   - Статистика (количество записей, обработано текста)

2. **Календарь**
   - Отображение месяца с датами
   - Индикаторы наличия записей (синие точки)
   - Индикаторы занятий в расписании (зелёные точки)
   - Клик по дате → показ записей или расписания

3. **Просмотр записей/расписания**
   - При клике на дату отображаются записи или расписание для этого дня
   - Переключатель "Записи" / "Расписание"
   - Кнопка "Очистить выбор"

4. **Вкладки функционала:**
   - **Транскрибация:** загрузка аудио → получение текста
   - **Обработка текста:** выбор ML-режима и обработка
   - **Текстовый редактор:** редактирование текста (TipTap)

---

### 9. `RichTextEditor.tsx` - Текстовый редактор

**Описание:** WYSIWYG редактор на базе **TipTap 3.7.2** (расширение ProseMirror).

#### Props
```typescript
interface RichTextEditorProps {
  onContentChange?: (html: string) => void;  // Вызывается при изменении текста
  onEditorReady?: (editor: any) => void;     // Передаёт инстанс редактора наружу
}
```

#### Используемые расширения TipTap

```typescript
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';  // Базовые функции
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';

const editor = useEditor({
  extensions: [
    StarterKit,
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight,
    Link.configure({ openOnClick: false }),
    Image
  ],
  content: '<p>Начните печатать...</p>',
  onUpdate: ({ editor }) => {
    const html = editor.getHTML();
    if (onContentChange) {
      onContentChange(html);
    }
  }
});
```

#### Панель инструментов (Toolbar)

Кнопки форматирования:
- **Жирный** (`Bold`) — `editor.chain().focus().toggleBold().run()`
- **Курсив** (`Italic`) — `editor.chain().focus().toggleItalic().run()`
- **Подчёркнутый** (`Underline`) — `editor.chain().focus().toggleUnderline().run()`
- **Зачёркнутый** (`Strike`) — `editor.chain().focus().toggleStrike().run()`
- **Заголовки** (H1, H2, H3) — `editor.chain().focus().toggleHeading({ level: 1 }).run()`
- **Нумерованный список** — `editor.chain().focus().toggleOrderedList().run()`
- **Маркированный список** — `editor.chain().focus().toggleBulletList().run()`
- **Выделение** (Highlight) — `editor.chain().focus().toggleHighlight().run()`
- **Выравнивание текста** (Left, Center, Right, Justify)
- **Отмена/Повтор** — `editor.chain().focus().undo().run()` / `redo()`

---

## 🪝 Custom Hooks

### 1. `useFileUpload.ts` - Загрузка файлов

**Описание:** Хук для управления состоянием загрузки файлов. Сейчас симулирует загрузку, готов для интеграции с реальным API.

#### Интерфейсы

```typescript
interface FileUploadState {
  isUploading: boolean;     // Идёт ли загрузка
  progress: number;          // Прогресс 0-100
  uploadedFile: File | null; // Загруженный файл
  error: string | null;      // Ошибка загрузки
}
```

#### Использование

```typescript
const { 
  isUploading, 
  progress, 
  uploadedFile, 
  error, 
  uploadFile, 
  resetState 
} = useFileUpload();

// Загрузка файла
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?[0];
  if (file) {
    await uploadFile(file);
  }
};
```

---

### 2. `useExport.ts` - Экспорт документов

**Описание:** Хук предоставляет 4 функции для экспорта содержимого редактора в различные форматы.

#### Возвращаемое значение

```typescript
interface UseExportReturn {
  exportToTxt: (content: string, filename: string) => void;
  exportToMarkdown: (content: string, filename: string) => void;
  exportToDocx: (content: string, filename: string) => void;
  exportToPdf: (content: string, filename: string) => Promise<void>;
}
```

#### Использование

```typescript
const { exportToTxt, exportToMarkdown, exportToDocx, exportToPdf } = useExport();

// Получить HTML из редактора
const html = editorInstance.getHTML();

// Экспорт
exportToTxt(html, 'document.txt');
exportToMarkdown(html, 'document.md');
exportToDocx(html, 'document.docx');
await exportToPdf(html, 'document.pdf');
```

---

## 🔌 Backend API - Детальное описание

### Структура Backend

Бэкенд построен на **FastAPI** и состоит из:
- `api/app.py` — главный файл приложения (инициализация FastAPI)
- `api/transcribe.py` — эндпоинты для транскрибации аудио
- `api/ml_endpoints.py` — эндпоинты для ML обработки текста (документация в `ML_documentation.md`)

---

### `api/app.py` - Главное приложение

**Описание:** Точка входа бэкенда. Создаёт FastAPI приложение и подключает роутеры.

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from api.transcribe import router as transcribe_router
from api.ml_endpoints import router as ml_router

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Создание приложения
app = FastAPI(title="Student AI Assistant API", version="1.0.0")

# CORS для frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене укажите конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware для логирования запросов
@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response

# Подключение роутеров
app.include_router(transcribe_router, prefix="/api/transcribe", tags=["Transcription"])
app.include_router(ml_router, prefix="/api/ml", tags=["ML Processing"])
```

**Запуск:**
```bash
uvicorn api.app:app --reload
```

После запуска API доступен на `http://localhost:8000`, документация на `http://localhost:8000/docs`.

---

### `api/transcribe.py` - Транскрибация аудио

**Описание:** Роутер для конвертации аудио/видео файлов в текст через **Nexara API**.

#### Поддерживаемые форматы

| Аудио | Видео |
|-------|-------|
| `.mp3` | `.mp4` |
| `.wav` | `.mov` |
| `.m4a` | `.avi` |
| `.flac` | `.mkv` |
| `.ogg` |  |
| `.opus` |  |

---

#### Эндпоинт: `POST /api/transcribe/audio`

**Описание:** Загружает аудио/видео файл и возвращает текстовую транскрипцию.

**Request:**
```http
POST /api/transcribe/audio
Content-Type: multipart/form-data

{
  "audio": <binary file>
}
```

**Response:**
```typescript
interface TranscriptionResponse {
  success: boolean;       // Успешность операции
  text: string;           // Транскрибированный текст
  filename: string;       // Имя загруженного файла
  duration?: number;      // Длительность аудио (секунды)
  language?: string;      // Определённый язык (например, "ru")
}
```

**Пример успешного ответа:**
```json
{
  "success": true,
  "text": "Сегодня мы рассмотрим основы математического анализа...",
  "filename": "lecture.mp3",
  "duration": 3600,
  "language": "ru"
}
```

#### Эндпоинт: `GET /api/transcribe/health`

**Описание:** Проверка работоспособности API транскрибации.

**Response:**
```json
{
  "status": "healthy",
  "message": "✅ Nexara API ключ найден",
  "api_configured": true
}
```

---

### Настройка Nexara API

1. Получите API ключ на [nexara.ai](https://nexara.ai)
2. Создайте файл `.env` в корне проекта:
   ```bash
   NEXARA_API_KEY=your_api_key_here
   ```
3. Пример `.env.example`:
   ```
   NEXARA_API_KEY=nsk_xxxxxxxxxxxxxxxxxxxxx
   ```

---

## 🚀 Запуск приложения

### Требования

- **Node.js** 16+ и npm 8+
- **Python** 3.10+
- **pip** для установки Python зависимостей

---

### Установка зависимостей

#### Frontend
```bash
npm install
```

#### Backend
```bash
pip install -r requirements.txt
```

---

### Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```env
# Nexara API (для транскрибации)
NEXARA_API_KEY=your_nexara_key_here

# DeepSeek API (для ML обработки, см. ML_documentation.md)
DEEPSEEK_API_KEY=your_deepseek_key_here
```

---

### Запуск проекта

#### 1. Запуск Backend (в первом терминале)
```bash
uvicorn api.app:app --reload
```

API будет доступен на `http://localhost:8000`

Swagger документация: `http://localhost:8000/docs`

#### 2. Запуск Frontend (во втором терминале)
```bash
npm start
```

React приложение откроется на `http://localhost:3000`

---

## 📦 Сборка для продакшена

### Frontend
```bash
npm run build
```

Создаст оптимизированную сборку в папке `build/`

### Backend

Для развёртывания используйте:
```bash
# Установка gunicorn (production ASGI server)
pip install gunicorn

# Запуск с несколькими воркерами
gunicorn api.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

---

## 🧪 Тестирование

### Тестирование транскрибации

Используйте скрипт `scripts/simple_trans_test.py`:

```python
import requests

# Путь к аудио файлу
audio_file_path = "path/to/your/audio.mp3"

# Отправка запроса
with open(audio_file_path, 'rb') as f:
    files = {'audio': f}
    response = requests.post('http://localhost:8000/api/transcribe/audio', files=files)

# Результат
result = response.json()
print(f"Успех: {result['success']}")
print(f"Текст: {result['text'][:200]}...")  # Первые 200 символов
```

### Тестирование ML обработки

См. скрипты в `scripts/`:
- `test_cheat_sheet.py` — тест режима создания шпаргалки
- `test_detailed_notes.py` — тест режима детального конспекта
- `test_large_text.py` — тест с большими текстами (18K токенов)

---

## 📊 Потоки данных

### Поток транскрибации аудио

```
1. Пользователь загружает файл в AccountPage
   └─> useFileUpload hook обрабатывает File объект

2. Frontend отправляет POST /api/transcribe/audio
   └─> FormData с audio файлом

3. Backend (transcribe.py):
   ├─> Валидация формата файла
   ├─> Сохранение во временную директорию
   ├─> Запрос к Nexara API
   ├─> Получение JSON с text, duration, language
   └─> Возврат TranscriptionResponse

4. Frontend получает результат:
   └─> Вставка текста в RichTextEditor
       └─> editorInstance.commands.setContent(text)
```

### Поток экспорта документа

```
1. Пользователь нажимает кнопку "Экспорт" в AccountPage

2. Получение HTML из редактора:
   const html = editorInstance.getHTML();

3. Вызов функции экспорта из useExport:
   ├─> exportToTxt(html, filename)
   ├─> exportToMarkdown(html, filename)
   ├─> exportToDocx(html, filename)
   └─> exportToPdf(html, filename)

4. Обработка HTML:
   ├─> Конвертация в целевой формат
   ├─> Создание Blob объекта
   └─> Скачивание через file-saver

5. Браузер инициирует загрузку файла
```

---

## 🎯 Планы развития

### Текущие возможности
- ✅ Полнофункциональный WYSIWYG редактор (TipTap)
- ✅ Транскрибация аудио через Nexara API
- ✅ ML обработка текста (6 режимов) через DeepSeek API
- ✅ Экспорт в 4 форматах (TXT, MD, DOCX, PDF)
- ✅ Календарь с записями и расписанием
- ✅ Адаптивный дизайн (мобильная версия)
- ✅ Тёмная/светлая тема

### Планируемые улучшения

#### Frontend
- [ ] Реальная авторизация (JWT токены)
- [ ] Интеграция с бэкенд API (замена mock данных)
- [ ] Drag-and-drop загрузка файлов
- [ ] Прогресс-бар при транскрибации
- [ ] Редактирование записей и расписания
- [ ] Поиск по записям
- [ ] Теги для организации записей
- [ ] История обработок ML

#### Backend
- [ ] База данных (PostgreSQL) для хранения записей
- [ ] Аутентификация пользователей (JWT)
- [ ] Пагинация для больших списков
- [ ] Кэширование результатов ML обработки
- [ ] Очереди для длительных задач (Celery + Redis)
- [ ] Вебсокеты для real-time обновлений
- [ ] Admin панель для управления

---

## 📚 Полезные ссылки

### Документация технологий

- [React](https://react.dev/) — официальная документация React 18
- [TypeScript](https://www.typescriptlang.org/docs/) — справочник TypeScript
- [TipTap](https://tiptap.dev/) — документация WYSIWYG редактора
- [Tailwind CSS](https://tailwindcss.com/docs) — utility-first CSS фреймворк
- [FastAPI](https://fastapi.tiangolo.com/) — современный Python веб-фреймворк
- [Nexara API](https://nexara.ai/docs) — документация по транскрибации аудио

### Репозитории библиотек

- [file-saver](https://github.com/eligrey/FileSaver.js) — сохранение файлов в браузере
- [jspdf](https://github.com/parallax/jsPDF) — генерация PDF на клиенте
- [html-docx-js](https://github.com/evidenceprime/html-docx-js) — HTML → DOCX конвертация

---

**Версия документации:** 1.0  
**Дата обновления:** 2025-01-15  
**Автор:** Student AI Assistant Team
