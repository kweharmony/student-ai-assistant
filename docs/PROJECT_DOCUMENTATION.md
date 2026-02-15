# 📚 Student AI Assistant - Полная документация проекта

## 📖 Обзор проекта

**Student AI Assistant** — веб-платформа для автоматической обработки студенческих лекций с использованием искусственного интеллекта. Система объединяет транскрибацию аудио (Whisper AI), фильтрацию текста и создание учебных материалов (DeepSeek v3.2 API через VseLLM).

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
│  │  Whisper AI      │        │  DeepSeek API     │          │
│  │  (локально)      │        │  (via VseLLM)     │          │
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
│       ├── deepseek_processor.py    # Обработчик конспектов ⭐
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

### 📋 Технологический стек

**Основа:**
- **React 18.2.0:** библиотека для построения UI
- **TypeScript 4.7.4:** статическая типизация
- **React Scripts 5.0.1:** инструментарий для разработки и сборки

**Маршрутизация:**
- **React Router DOM 6.3.0:** клиентская маршрутизация

**UI компоненты:**
- **TipTap 3.7.2:** расширяемый WYSIWYG редактор на базе ProseMirror
- **Framer Motion 12.23.24:** библиотека анимаций

**Стилизация:**
- **Tailwind CSS:** utility-first CSS фреймворк
- **PostCSS + Autoprefixer:** обработка CSS

**Экспорт документов:**
- **jsPDF 3.0.3:** генерация PDF
- **pdfmake 0.2.20:** создание PDF с форматированием
- **docx 8.5.0:** создание DOCX файлов
- **html-docx-js 0.3.1:** конвертация HTML в DOCX
- **file-saver 2.0.5:** сохранение файлов на клиенте

**Парсинг документов:**
- **mammoth 1.11.0:** чтение DOCX
- **pdf-parse 2.4.5:** парсинг PDF
- **pdfjs-dist 5.4.296:** рендеринг PDF
- **marked 16.4.1:** парсинг Markdown

### 📁 Структура фронтенда

```
src/
├── components/          # React компоненты
│   ├── AccountPage.tsx      # Страница аккаунта ⭐
│   ├── AuthPage.tsx         # Страница аутентификации
│   ├── Features.tsx         # Секция особенностей
│   ├── Footer.tsx           # Футер
│   ├── Header.tsx           # Шапка сайта
│   ├── Hero.tsx             # Главная секция
│   ├── HowItWorks.tsx       # Секция "Как работает"
│   ├── PricingPage.tsx      # Страница тарифов
│   ├── RichTextEditor.tsx   # WYSIWYG редактор ⭐
│   └── UploadDemo.tsx       # Демо загрузки файлов
├── contexts/            # React Context API
│   └── ThemeContext.tsx     # Контекст темы (светлая/темная)
├── hooks/               # Custom React Hooks
│   ├── useExport.ts         # Экспорт документов
│   ├── useFileUpload.ts     # Загрузка файлов
│   └── useMLProcessor.ts    # Взаимодействие с ML API
├── types/               # TypeScript типы
│   ├── ml.ts                # Типы для ML API
│   └── modules.d.ts         # Декларации модулей
├── App.tsx              # Главный компонент приложения
├── index.tsx            # Точка входа
├── index.css            # Глобальные стили
└── button-animations.css # Анимации кнопок
```

### 🧩 Ключевые компоненты

#### 1. `App.tsx` - Корневой компонент

Главный компонент приложения с маршрутизацией.

**Структура:**
```typescript
<ThemeProvider>
  <Router>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </Router>
</ThemeProvider>
```

**Особенности:**
- Обертка `ThemeProvider` для глобального управления темой
- Fallback маршрут перенаправляет на главную
- Wrapper компоненты для инжекции контекста темы

#### 2. `Header.tsx` - Навигационная шапка

**Функциональность:**
- Логотип с навигацией на главную
- Навигационные ссылки (Как работает, Аккаунт, Тарифы)
- Кнопка переключения темы
- Responsive дизайн (скрытие элементов на мобильных)
- Sticky позиционирование с blur эффектом

**Технические детали:**
- Использует `useLocation` для определения текущей страницы
- CSS переменные для динамической темизации
- Анимированные hover эффекты

#### 3. `RichTextEditor.tsx` - WYSIWYG редактор ⭐

WYSIWYG редактор на базе TipTap для работы с конспектами.

**Возможности редактора:**
- Форматирование текста (жирный, курсив, код, подчеркивание)
- Заголовки (H1-H3)
- Списки (маркированные, нумерованные)
- Цитаты
- Блоки кода
- Ссылки
- Таблицы
- Отмена/повтор действий

**Архитектура:**
```typescript
const editor = useEditor({
  extensions: [
    StarterKit,
    Underline,
    Link,
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Highlight,
    TextAlign.configure({ types: ['heading', 'paragraph'] })
  ],
  content: initialContent,
  onUpdate: ({ editor }) => {
    onContentChange?.(editor.getHTML());
  }
});
```

**Особенности:**
- Синхронизация состояния активных форматов
- Переключение между исходным и обработанным текстом
- Экспорт в HTML формате
- Кастомная панель инструментов
- Адаптивный дизайн панели инструментов

**Props интерфейс:**
```typescript
interface RichTextEditorProps {
  onContentChange?: (content: string) => void;
  initialContent?: string;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  showToolbar?: boolean;
  mode?: 'original' | 'processed' | 'split';
  processedContent?: string;
  isProcessing?: boolean;
}
```

#### 4. `AccountPage.tsx` - Личный кабинет ⭐

Главная рабочая страница для обработки лекций.

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
  setTranscribedText(result.text);
  setShowFilterModal(true); // Показать модальное окно фильтрации
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

#### 5. `Features.tsx` - Секция особенностей

**Отображаемые feature:**
- ✅ Высокая точность распознавания
- ⚡ Быстрая обработка текста
- 🔒 Защита данных

**Структура feature:**
```typescript
{
  icon: string;        // Эмодзи иконка
  title: string;       // Заголовок
  description: string; // Описание
}
```

**Визуальные эффекты:**
- Hover анимации карточек
- Градиентные фоны иконок
- Трансформации при наведении

#### 6. Модальные окна

**Прогресс транскрибации:**
- Анимированный спиннер
- Прогресс-бар
- Информация о текущем этапе
- Нельзя закрыть во время обработки

**Модальное окно фильтрации:**
- Выбор: применить AI-фильтр или пропустить
- Кнопки: "Обработать с ИИ" и "Пропустить"
- Автоматически открывается после транскрибации
- Объяснение преимуществ фильтрации

**Модальное окно ошибки:**
- Красная иконка предупреждения
- Описание ошибки
- Кнопка "Понятно"

### 🎣 Custom Hooks

#### `useMLProcessor.ts` - Взаимодействие с ML API

**Назначение:** обработка текста через DeepSeek API

**Интерфейс:**
```typescript
{
  // Состояние
  isProcessing: boolean;
  error: string | null;
  
  // Методы
  processText: (text: string, mode: MLMode, topic?: string) => Promise<string | null>;
  batchProcess: (text: string, modes: MLMode[]) => Promise<Record<MLMode, string> | null>;
  cancelProcessing: () => void;
}
```

**Ключевые возможности:**

1. **Обработка текста:**
```typescript
const processText = async (text: string, mode: MLMode, topic?: string) => {
  // Валидация
  if (!text || text.length < 10) {
    throw new Error('Текст слишком короткий (минимум 10 символов)');
  }
  
  // API запрос
  const response = await fetch('http://localhost:8000/api/ml/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, mode, topic }),
    signal: abortController.signal
  });
  
  const data = await response.json();
  return data.processed_text;
};
```

2. **Отмена запросов:**
```typescript
const cancelProcessing = () => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
};
```

3. **Обработка ошибок:**
- Парсинг различных форматов ошибок от API
- Обработка AbortError при отмене
- Детальное логирование

#### `useFileUpload.ts` - Загрузка файлов

**Назначение:** загрузка аудио файлов для транскрибации

**Интерфейс:**
```typescript
{
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  success: boolean;
  uploadFile: (file: File, endpoint: string) => Promise<any>;
  resetState: () => void;
}
```

**Функциональность:**
- Симуляция прогресса загрузки
- Обработка ошибок
- Автоматический сброс состояния через 3 секунды после успеха

#### `useExport.ts` - Экспорт документов

**Назначение:** экспорт содержимого редактора в различные форматы

**Интерфейс:**
```typescript
{
  exportToTxt: (options?: ExportOptions) => void;
  exportToMarkdown: (options?: ExportOptions) => void;
  exportToDocx: (options?: ExportOptions) => Promise<void>;
  exportToPdf: (options?: ExportOptions) => Promise<void>;
}
```

**Поддерживаемые форматы:**

1. **TXT (Plain Text):**
```typescript
const exportToTxt = (options = {}) => {
  const content = editor.getText();
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  downloadFile(blob, filename);
};
```

2. **Markdown:**
```typescript
const exportToMarkdown = (options = {}) => {
  const html = editor.getHTML();
  const markdown = htmlToMarkdown(html);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  downloadFile(blob, filename);
};
```

**Конвертация HTML → Markdown:**
- `<h1>` → `# `
- `<strong>` → `**text**`
- `<em>` → `*text*`
- `<ul><li>` → `- item`
- `<ol><li>` → `1. item`

3. **DOCX (Microsoft Word):**
```typescript
const exportToDocx = async (options = {}) => {
  const html = editor.getHTML();
  
  // Конвертация через html-docx-js
  const docxBlob = await htmlDocx.asBlob(html, {
    orientation: 'portrait',
    margins: { top: 720, right: 720, bottom: 720, left: 720 }
  });
  
  downloadFile(docxBlob, filename);
};
```

4. **PDF:**
```typescript
const exportToPdf = async (options = {}) => {
  const html = editor.getHTML();
  
  // Конвертация HTML структуры в pdfmake формат
  const docDefinition = {
    content: convertHtmlToPdfMake(html),
    defaultStyle: { font: 'Roboto', fontSize: 12 },
    styles: {
      header: { fontSize: 18, bold: true },
      subheader: { fontSize: 14, bold: true }
    }
  };
  
  pdfMake.createPdf(docDefinition).download(filename);
};
```

**Особенности PDF экспорта:**
- Поддержка кириллицы через шрифт Roboto
- Конвертация HTML структуры в pdfmake формат
- Сохранение форматирования (заголовки, списки, стили)
- Fallback на jsPDF при недоступности pdfMake

### 🧠 Управление состоянием

#### Context API: ThemeContext

**Назначение:** глобальное управление темой (светлая/темная)

**Интерфейс:**
```typescript
interface ThemeContextType {
  isLightTheme: boolean;
  toggleTheme: () => void;
}
```

**Реализация:**
```typescript
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isLightTheme, setIsLightTheme] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'light';
  });
  
  const toggleTheme = () => {
    setIsLightTheme(prev => {
      const newTheme = !prev;
      localStorage.setItem('theme', newTheme ? 'light' : 'dark');
      return newTheme;
    });
  };
  
  return (
    <ThemeContext.Provider value={{ isLightTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

**Особенности:**
- Персистентность через localStorage
- Автоматическая синхронизация с localStorage
- Доступ через `useTheme()` hook

#### Local State Management

Компоненты используют локальное состояние через `useState`:
- Состояние форм
- UI состояния (открыто/закрыто)
- Временные данные

### 📱 Маршруты и страницы

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/` | `HomePage` | Главная страница с Hero, Features, HowItWorks, UploadDemo |
| `/auth` | `AuthPage` | Страница входа/регистрации |
| `/account` | `AccountPage` | Личный кабинет пользователя |
| `/pricing` | `PricingPage` | Тарифные планы |
| `*` | `Navigate to="/"` | Fallback на главную для несуществующих маршрутов |

**Навигация:**
- Программная навигация через `useNavigate()` hook
- Декларативная навигация через `<Link>` компоненты
- Автоматическая прокрутка к началу страницы после навигации

### 🎨 Стилизация и темизация

#### Tailwind CSS конфигурация

**tailwind.config.js:**
```javascript
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#99b5ea',
        secondary: '#7c9dd6',
        dark: '#0a0e1f',
        light: '#ffffff'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
```

#### CSS переменные для темизации

**Темная тема (по умолчанию):**
```css
:root {
  --bg-primary: #0a0e1f;
  --bg-secondary: #1a1f35;
  --text-primary: #ffffff;
  --text-secondary: #99b5ea;
  --border-color: rgba(153, 181, 234, 0.1);
  --hover-bg: rgba(153, 181, 234, 0.03);
}
```

**Светлая тема:**
```css
.light-theme {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f7fa;
  --text-primary: #0a0e1f;
  --text-secondary: #5a6c8f;
  --border-color: rgba(0, 0, 0, 0.1);
  --hover-bg: rgba(0, 0, 0, 0.03);
}
```

**Применение:**
```typescript
<div style={{ 
  color: 'var(--text-primary)',
  background: 'var(--bg-primary)'
}}>
  Content
</div>
```

#### Анимации

**Кнопки (button-animations.css):**
- Hover эффекты
- Ripple эффект при клике
- Трансформации масштаба
- Переходы цвета

**Framer Motion анимации:**
```typescript
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.5 }}
>
  Content
</motion.div>
```

#### Responsive дизайн

**Breakpoints (Tailwind):**
- `sm:` 640px
- `md:` 768px
- `lg:` 1024px
- `xl:` 1280px

**Паттерны:**
```typescript
className="text-sm sm:text-base md:text-lg lg:text-xl"
className="hidden md:block"
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
```

### 📊 TypeScript типы

#### `ml.ts` - Типы для ML API

```typescript
// Режимы обработки
export type MLMode = 
  | 'summarize'
  | 'extract_terms'
  | 'expand_topic'
  | 'generate_questions'
  | 'detailed_notes'
  | 'cheat_sheet';

// Запрос на обработку
export interface MLProcessRequest {
  text: string;
  mode: MLMode;
  topic?: string;
}

// Ответ от API
export interface MLProcessResponse {
  processed_text: string;
  mode: string;
  success: boolean;
  error?: string;
  processing_time?: number;
}

// Состояние обработки
export interface MLProcessingState {
  isProcessing: boolean;
  currentMode: MLMode | null;
  progress: number;
  error: string | null;
}

// Метаданные режима
export interface MLModeInfo {
  id: MLMode;
  name: string;
  description: string;
  icon: string;
  requiresTopic?: boolean;
}

// Пакетная обработка
export interface BatchProcessResponse {
  results: Record<MLMode, string>;
  total_processing_time: number;
}
```

### 🌐 Взаимодействие с API

#### Конфигурация API

```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
```

Переменная окружения `REACT_APP_API_URL` позволяет настроить URL API для разных окружений.

#### Паттерн запросов

Все API запросы следуют единому паттерну:

```typescript
try {
  // 1. Валидация входных данных
  if (!text || text.length < 10) {
    throw new Error('Текст слишком короткий');
  }
  
  // 2. Установка состояния загрузки
  setIsProcessing(true);
  setError(null);
  
  // 3. Создание AbortController для отмены
  const abortController = new AbortController();
  
  // 4. Формирование запроса
  const response = await fetch(`${API_BASE_URL}/api/ml/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, mode, topic }),
    signal: abortController.signal
  });
  
  // 5. Проверка статуса
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Ошибка API');
  }
  
  // 6. Парсинг и возврат данных
  const data = await response.json();
  return data;

} catch (error) {
  // 7. Обработка ошибок
  if (error.name === 'AbortError') {
    console.log('Запрос отменен');
    return null;
  }
  
  setError(error.message);
  throw error;
  
} finally {
  // 8. Сброс состояния
  setIsProcessing(false);
}
```

#### Обработка ошибок

**Типы ошибок:**

1. **Сетевые ошибки:**
```typescript
catch (error) {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    setError('Ошибка сети. Проверьте подключение к интернету.');
  }
}
```

2. **HTTP ошибки:**
```typescript
if (!response.ok) {
  const errorData = await response.json();
  const errorMessage = errorData.detail || errorData.message || 'Ошибка сервера';
  throw new Error(errorMessage);
}
```

3. **Отмена запросов:**
```typescript
if (error.name === 'AbortError') {
  // Пользователь отменил запрос
  console.log('Запрос отменен пользователем');
  return null;
}
```

### ♿ UX стратегии

#### Индикаторы загрузки

- Спиннеры для асинхронных операций
- Progress bars для загрузки файлов
- Skeleton screens для контента
- Disabled состояния кнопок

#### Обратная связь

- Toast уведомления (success/error)
- Inline валидация форм
- Подсветка активных элементов
- Hover эффекты для интерактивных элементов

#### Доступность (A11y)

- Semantic HTML
- ARIA атрибуты
- Keyboard navigation
- Focus indicators
- Alt текст для изображений

#### Производительность

- Lazy loading компонентов
- Мемоизация дорогих вычислений
- Debounce для поисковых запросов
- Оптимизация ре-рендеров

---

## 🔧 Backend - FastAPI приложение

### 📋 Технологический стек

**Основной фреймворк:** FastAPI 0.104.1

FastAPI выбран по следующим причинам:
- Высокая производительность (на уровне NodeJS и Go)
- Автоматическая генерация OpenAPI документации
- Встроенная валидация данных через Pydantic
- Нативная поддержка async/await
- Автоматическая сериализация/десериализация JSON

**ASGI сервер:** Uvicorn 0.24.0 с поддержкой стандартных расширений

**Валидация данных:** Pydantic 2.9.0

### 📁 Структура бэкенда

```
api/
├── __init__.py           # Инициализация пакета
├── app.py                # Главный файл приложения, конфигурация FastAPI
├── ml_endpoints.py       # REST API endpoints для обработки текста
└── transcribe.py         # Endpoints транскрибации
```

### 🏗️ Основные модули

#### `app.py` - Главное приложение

Главный модуль приложения, отвечающий за инициализацию FastAPI и подключение middleware.

**Основные компоненты:**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .ml_endpoints import router, add_logging_middleware
from .transcribe import router as transcribe_router

app = FastAPI(title="Student AI Assistant ML API")

# Настройка CORS для работы с React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

add_logging_middleware(app)
app.include_router(router)
app.include_router(transcribe_router)
```

**CORS конфигурация:**

Настройки CORS разрешают:
- Запросы с локального фронтенда (порт 3000)
- Все HTTP методы (GET, POST, PUT, DELETE, OPTIONS)
- Все заголовки
- Передачу credentials (cookies, authorization headers)

**Подключение роутеров:**
- `ml_endpoints.router` - обработка текстовых данных
- `transcribe_router` - транскрибация аудио

#### `ml_endpoints.py` - API обработки текста

REST API для обработки текстовых данных через DeepSeek v3.2.

**Префикс роутера:** `/api/ml`

**Основные endpoints:**

| Метод | Путь | Описание | Параметры |
|-------|------|----------|-----------|
| GET | `/api/ml/health` | Проверка работоспособности API | - |
| POST | `/api/ml/process` | Обработка текста в выбранном режиме | `text`, `mode`, `topic?` |
| POST | `/api/ml/batch-process` | Пакетная обработка текста | `text`, `modes[]` |
| GET | `/api/ml/modes` | Получение списка доступных режимов | - |
| POST | `/api/ml/quick-summary` | Быстрое создание конспекта | `text` |

**Модели данных (Pydantic):**

1. **ProcessRequest** - Запрос на обработку:
```python
class ProcessRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=70000)
    mode: str = Field(..., description="Режим обработки")
    topic: Optional[str] = Field(None)
    context: Optional[str] = Field(None)
```

**Валидация:**
- `text`: 10-70000 символов (обязательно)
- `mode`: строка из списка допустимых режимов
- `topic`: опционально, обязательно для режима `expand_topic`

2. **ProcessResponse** - Ответ обработки:
```python
class ProcessResponse(BaseModel):
    success: bool
    mode: str
    processed_text: str
    processing_time: Optional[float]
    metadata: Optional[Dict[str, Any]]
    error: Optional[str] = None
```

3. **BatchProcessRequest** - Пакетная обработка:
```python
class BatchProcessRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=70000)
    modes: List[str] = Field(..., min_items=1, max_items=5)
```

4. **HealthResponse** - Health check:
```python
class HealthResponse(BaseModel):
    status: str
    model: str
    api_available: bool
    timestamp: datetime
```

**Логика обработки данных:**

**Endpoint `/api/ml/process`:**

```python
@router.post("/process")
async def process_text(request: ProcessRequest):
    """Обработка текста в одном режиме"""
    start_time = time.time()
    
    try:
        # 1. Валидация входных данных через Pydantic
        # 2. Проверка режима обработки (6 доступных режимов)
        if request.mode not in PROMPTS:
            raise HTTPException(400, f"Неизвестный режим: {request.mode}")
        
        # 3. Дополнительная валидация для expand_topic
        if request.mode == 'expand_topic' and not request.topic:
            raise HTTPException(400, "Требуется параметр 'topic'")
        
        # 4. Получение глобального экземпляра процессора
        processor = get_processor()
        
        # 5. Обработка текста через процессор
        if request.mode == 'summarize':
            result = processor.summarize(request.text)
        elif request.mode == 'extract_terms':
            result = processor.extract_terms(request.text)
        elif request.mode == 'expand_topic':
            result = processor.expand_topic(request.topic, request.text)
        elif request.mode == 'generate_questions':
            result = processor.generate_questions(request.text)
        elif request.mode == 'detailed_notes':
            result = processor.create_detailed_notes(request.text)
        elif request.mode == 'cheat_sheet':
            result = processor.create_cheat_sheet(request.text)
        
        # 6. Вычисление времени обработки
        processing_time = time.time() - start_time
        
        # 7. Формирование ответа с метаданными
        return ProcessResponse(
            success=True,
            mode=request.mode,
            processed_text=result,
            processing_time=processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка обработки текста: {str(e)}")
        raise HTTPException(500, f"Ошибка обработки: {str(e)}")
```

**Endpoint `/api/ml/batch-process`:**

Позволяет обработать один текст несколькими режимами за один запрос.

**Преимущества:**
- Снижение количества HTTP запросов
- Оптимизация времени обработки
- Единый контекст для всех режимов

**Ограничения:**
- Максимум 5 режимов за запрос
- Общий лимит текста 70000 символов

**Endpoint `/api/ml/modes`:**

Возвращает метаданные о доступных режимах обработки:

```json
{
  "modes": {
    "summarize": {
      "name": "Краткий конспект",
      "description": "Создание структурированного конспекта (~30% от оригинала)",
      "icon": "📝",
      "max_tokens": 8192
    },
    "extract_terms": {
      "name": "Извлечение терминов",
      "description": "Список ключевых терминов с определениями",
      "icon": "📚",
      "max_tokens": 8192
    }
    // ... остальные режимы
  }
}
```

### 🔒 Безопасность

#### Валидация входных данных

**Уровень 1: Pydantic валидация**
- Автоматическая проверка типов
- Ограничения длины строк (10-70000 символов)
- Проверка обязательных полей
- Валидация списков (min_items, max_items)

**Уровень 2: Бизнес-логика**
- Проверка допустимых значений `mode`
- Дополнительная валидация для специфичных режимов
- Санитизация входных данных

#### CORS политика

Строгая CORS политика разрешает запросы только с:
- `http://localhost:3000`
- `http://127.0.0.1:3000`

Для production необходимо добавить домены продакшн-сервера.

#### Обработка ошибок

Все ошибки обрабатываются централизованно:
- Логирование всех исключений
- Возврат структурированных ошибок клиенту
- Скрытие внутренних деталей реализации

### 📊 Логирование и мониторинг

#### Middleware логирования

```python
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = datetime.now()
    logger.info(f"ML API запрос: {request.method} {request.url}")
    
    response = await call_next(request)
    
    duration = (datetime.now() - start_time).total_seconds()
    logger.info(f"ML API ответ: {response.status_code}, время: {duration:.2f}с")
    
    return response
```

**Логируемые данные:**
- HTTP метод и URL
- Время обработки запроса
- Статус код ответа
- Ошибки обработки

#### Уровни логирования

- **INFO:** успешные операции, метрики производительности
- **ERROR:** ошибки обработки, исключения
- **DEBUG:** детальная информация для отладки (не используется в production)

### 🚀 Деплой и запуск

#### Development режим

```bash
uvicorn api.app:app --reload --host 0.0.0.0 --port 8000
```

Параметры:
- `--reload`: автоперезагрузка при изменении кода
- `--host 0.0.0.0`: доступ из внешней сети
- `--port 8000`: порт сервера

#### Production режим

**Вариант 1: Uvicorn с workers**
```bash
uvicorn api.app:app --host 0.0.0.0 --port 8000 --workers 4
```

**Вариант 2: Gunicorn + Uvicorn workers**
```bash
gunicorn api.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

Преимущества Gunicorn:
- Управление процессами
- Graceful restart
- Автоматический перезапуск упавших workers

#### Скрипты запуска

**Windows:** `start_api_medium.bat`
**Linux/Mac:** `start_api_medium.sh`

### 📦 Зависимости бэкенда

```txt
fastapi==0.104.1          # Веб-фреймворк
uvicorn[standard]==0.24.0 # ASGI сервер
pydantic==2.9.0           # Валидация данных
python-dotenv==1.0.0      # Переменные окружения
python-multipart==0.0.6   # Обработка multipart/form-data
aiofiles==23.2.1          # Асинхронная работа с файлами
gunicorn==21.2.0          # Production WSGI сервер
pytest==7.4.0             # Тестирование
httpx==0.25.0             # HTTP клиент для тестов
openai>=1.0.0                  # DeepSeek API (OpenAI-compatible)
openai-whisper            # Транскрибация
torch                     # ML фреймворк
requests>=2.31.0          # HTTP запросы
```

---
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
│  │  TranscriptionFilter│  │  DeepSeekProcessor   │   │
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

### 2. DeepSeekProcessor - Обработка конспектов

**Файлы:**
- `ml/deepseek_processor.py` - Класс процессора
- `ml/prompts.py` - Промпты для обработки

**Назначение:** Создание учебных материалов из текста лекций

**Основной класс:**
```python
from ml.deepseek_processor import DeepSeekProcessor

processor = DeepSeekProcessor()

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

### 📋 Обзор

Система транскрибации использует **OpenAI Whisper** — нейросетевую модель для распознавания речи. Работает **полностью локально**, без облачных API и без ограничений по количеству запросов.

**Основные преимущества:**
- ✅ **Офлайн работа** - не требует интернета после установки
- ✅ **Бесплатно** - без API ключей и лимитов
- ✅ **Высокая точность** - модель обучена на 680,000 часах аудио
- ✅ **Мультиязычность** - поддержка 99 языков, включая русский
- ✅ **Универсальность** - работает с любыми аудио/видео форматами

### 🏗️ Архитектура транскрибации

```
┌────────────────────────────────────────────────────┐
│              FRONTEND (React)                      │
│                                                    │
│  1. Пользователь загружает аудиофайл              │
│  2. FormData отправляется на /api/transcribe/audio│
│  3. Показывается прогресс-индикатор               │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│          BACKEND (FastAPI - transcribe.py)         │
│                                                    │
│  ┌──────────────────────────────────────────┐    │
│  │  1. Валидация формата файла              │    │
│  │  2. Сохранение во временный файл         │    │
│  │  3. Вызов Whisper.transcribe()           │    │
│  │  4. Возврат JSON с текстом               │    │
│  └──────────────────────────────────────────┘    │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│         WHISPER AI (локальная модель)              │
│                                                    │
│  ┌──────────────────────────────────────────┐    │
│  │  FFmpeg → декодирование аудио             │    │
│  │  Whisper → распознавание речи             │    │
│  │  Результат: текст + язык + метаданные     │    │
│  └──────────────────────────────────────────┘    │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│         AI-ФИЛЬТРАЦИЯ (опционально)                │
│                                                    │
│  Пользователь выбирает:                           │
│  • Применить AI-фильтр (DeepSeek) - очистка текста  │
│  • Пропустить - использовать как есть             │
└────────────────────────────────────────────────────┘
```

### 🎯 Поддерживаемые форматы

**Аудио:**
- **mp3** - MP3 Audio
- **wav** - Waveform Audio
- **m4a** - MPEG-4 Audio
- **flac** - Free Lossless Audio Codec
- **ogg** - Ogg Vorbis
- **opus** - Opus Audio

**Видео:**
- **mp4** - MPEG-4 Video
- **mov** - QuickTime Movie
- **avi** - Audio Video Interleave
- **mkv** - Matroska Video
- **webm** - WebM Video

**Ограничения:**
- Максимальный размер файла: ограничен только RAM/диском
- Рекомендуемая длительность: до 90 минут (больше работает, но медленно)
- Качество аудио: любое (Whisper автоматически ресемплирует)

### 🤖 Модели Whisper

| Модель | Размер | Параметры | RAM | Качество | Скорость | Рекомендация |
|--------|--------|-----------|-----|----------|----------|--------------|
| **tiny** | ~75 MB | 39M | 1 GB | ⭐⭐ | 🚀🚀🚀🚀 | Быстрые тесты |
| **base** | ~150 MB | 74M | 1 GB | ⭐⭐⭐ | 🚀🚀🚀 | Черновики |
| **small** | ~500 MB | 244M | 2 GB | ⭐⭐⭐⭐ | 🚀🚀 | **Лекции (рекомендуется)** ⭐ |
| **medium** | ~1.5 GB | 769M | 5 GB | ⭐⭐⭐⭐⭐ | 🚀 | Длинные лекции |
| **large** | ~3 GB | 1550M | 10 GB | ⭐⭐⭐⭐⭐ | 🐌 | Профессиональное качество |

**WER (Word Error Rate) для русского языка:**
- `tiny`: ~15% (каждое 6-7 слово с ошибкой)
- `base`: ~12% (каждое 8-9 слово)
- `small`: ~8% (каждое 12-13 слово) ⭐ **Оптимальный баланс**
- `medium`: ~5% (каждое 20-е слово)
- `large`: ~3% (каждое 33-е слово)

### ⏱️ Производительность

**Время обработки (модель small, CPU Intel i5-10400):**

| Длительность аудио | Время транскрибации | Соотношение |
|-------------------|---------------------|-------------|
| 1 минута | ~10-15 сек | 1:6 |
| 5 минут | ~45 сек - 1 мин | 1:5 |
| 15 минут | ~2.5-3 мин | 1:5 |
| 30 минут | ~5-6 мин | 1:5 |
| 60 минут | ~10-12 мин | 1:5 |
| 90 минут | ~15-18 мин | 1:5 |

**Время обработки (модель medium, CPU Intel i7-11700):**

| Длительность аудио | Время транскрибации | Соотношение |
|-------------------|---------------------|-------------|
| 1 минута | ~20-25 сек | 1:3 |
| 5 минут | ~1.5-2 мин | 1:3 |
| 15 минут | ~4-5 мин | 1:3 |
| 30 минут | ~8-10 мин | 1:3 |
| 60 минут | ~16-20 мин | 1:3 |
| 90 минут | ~24-30 мин | 1:3 |

**Ускорение на GPU (CUDA):**
- Модель `small` с GPU (RTX 3060): **в 10-15 раз быстрее**
- Модель `medium` с GPU (RTX 3060): **в 8-12 раз быстрее**

**Требования:**
- **CPU only:** 4+ ядер, 8+ GB RAM
- **GPU (опционально):** NVIDIA GPU с CUDA 11.8+, 4+ GB VRAM

### 🔧 Технические детали

#### API Эндпоинт: `POST /api/transcribe/audio`

**Запрос:**
```http
POST /api/transcribe/audio HTTP/1.1
Content-Type: multipart/form-data

audio: [файл]
```

**TypeScript (Frontend):**
```typescript
const handleAudioTranscription = async (file: File) => {
  const formData = new FormData();
  formData.append('audio', file);
  
  const response = await fetch('http://localhost:8000/api/transcribe/audio', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  console.log(result.text); // Транскрибированный текст
}
```

**Ответ:**
```json
{
  "success": true,
  "text": "сегодня мы рассмотрим основы машинного обучения...",
  "filename": "lecture.mp3",
  "duration": null,
  "language": "ru",
  "processing_time": 45.23
}
```

**Модель ответа (Pydantic):**
```python
class TranscriptionResponse(BaseModel):
    success: bool                      # Статус обработки
    text: str                          # Транскрибированный текст
    filename: str                      # Имя файла
    duration: Optional[float] = None   # Длительность аудио (секунды)
    language: Optional[str] = None     # Определенный язык (ISO код)
    processing_time: Optional[float]   # Время обработки (секунды)
```

#### Параметры Whisper

**В коде `api/transcribe.py`:**
```python
result = model.transcribe(
    temp_file_path,
    language='ru',        # Язык (ru/en/None для автоопределения)
    task='transcribe',    # 'transcribe' или 'translate' (в английский)
    fp16=False,           # False для CPU, True для GPU
    verbose=True,         # Показывать прогресс в консоли
    temperature=0.0,      # Креативность (0 = детерминированно)
    best_of=5,            # Количество попыток декодирования
    beam_size=5,          # Размер beam search
)
```

**Дополнительные параметры:**
- `initial_prompt` - Текстовая подсказка для контекста (например, "Лекция по математическому анализу")
- `condition_on_previous_text` - Использовать предыдущий текст для контекста (по умолчанию True)
- `compression_ratio_threshold` - Порог для определения галлюцинаций (по умолчанию 2.4)
- `logprob_threshold` - Порог вероятности для фильтрации (по умолчанию -1.0)

### 🔄 Полный Workflow транскрибации

```
┌─────────────────────────────────────────────────────┐
│ ЭТАП 1: ЗАГРУЗКА ФАЙЛА                              │
├─────────────────────────────────────────────────────┤
│ • Пользователь выбирает аудио/видео файл            │
│ • Frontend валидирует формат                        │
│ • Создается FormData с файлом                       │
│ • Отправляется POST /api/transcribe/audio           │
│ • Показывается модальное окно прогресса             │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ ЭТАП 2: ВАЛИДАЦИЯ НА BACKEND                        │
├─────────────────────────────────────────────────────┤
│ • Проверка расширения файла                         │
│ • Чтение содержимого (await audio.read())           │
│ • Проверка, что файл не пустой                      │
│ • Сохранение во временный файл                      │
│ • Синхронизация с диском (fsync)                    │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ ЭТАП 3: ТРАНСКРИБАЦИЯ ЧЕРЕЗ WHISPER                 │
├─────────────────────────────────────────────────────┤
│ • Загрузка модели (при первом запросе)              │
│ • FFmpeg декодирует аудио → 16kHz mono WAV          │
│ • Whisper разбивает на 30-секундные сегменты        │
│ • Обработка каждого сегмента через нейросеть        │
│ • Объединение результатов в единый текст            │
│ • Определение языка (если не указан)                │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ ЭТАП 4: ВОЗВРАТ РЕЗУЛЬТАТА                          │
├─────────────────────────────────────────────────────┤
│ • Удаление временного файла                         │
│ • Формирование JSON ответа                          │
│ • Возврат текста + метаданные                       │
│ • Логирование результатов                           │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ ЭТАП 5: МОДАЛЬНОЕ ОКНО ФИЛЬТРАЦИИ (FRONTEND)       │
├─────────────────────────────────────────────────────┤
│ Пользователю предлагается:                          │
│ ┌──────────────────┐   ┌──────────────────┐        │
│ │ Обработать с ИИ  │   │    Пропустить    │        │
│ │ (DeepSeek API)    │   │ (оставить как есть)│      │
│ └──────────────────┘   └──────────────────┘        │
└────────────────┬────────────────┬───────────────────┘
                 │                │
    ┌────────────┴──┐          ┌──┴────────────┐
    ▼               ▼          ▼               ▼
┌────────┐  ┌──────────────┐  ┌────────┐  ┌────────┐
│С AI    │  │POST /api/    │  │Без     │  │Текст   │
│фильтром│→ │transcribe/   │→ │фильтра │→ │в       │
│        │  │filter        │  │        │  │редактор│
└────────┘  └──────────────┘  └────────┘  └────────┘
```

### 🛠️ Настройка FFmpeg

FFmpeg требуется для декодирования аудио. Система автоматически ищет FFmpeg в PATH.

**Автоматический поиск (код в `api/transcribe.py`):**
```python
def setup_ffmpeg_path():
    """Добавляет FFmpeg в PATH если он не найден"""
    # Проверяем доступность
    if shutil.which('ffmpeg') is not None:
        return  # Уже в PATH
    
    # Поиск в стандартных местах (Windows)
    possible_paths = [
        Path(os.environ.get('LOCALAPPDATA', '')) / 'Microsoft' / 'WinGet' / 'Packages',
        Path('C:/ProgramData/chocolatey/bin'),
        Path('C:/ffmpeg/bin'),
        Path(os.environ.get('PROGRAMFILES', '')) / 'ffmpeg' / 'bin',
    ]
    
    # Рекурсивный поиск ffmpeg.exe
    for base_path in possible_paths:
        for ffmpeg_path in base_path.rglob('ffmpeg.exe'):
            bin_dir = str(ffmpeg_path.parent)
            os.environ['PATH'] = bin_dir + os.pathsep + os.environ['PATH']
            return
```

**Ручная установка:**
```bash
# Windows (WinGet)
winget install ffmpeg

# Windows (Chocolatey)
choco install ffmpeg

# macOS (Homebrew)
brew install ffmpeg

# Linux (Ubuntu/Debian)
sudo apt-get install ffmpeg

# Linux (Fedora)
sudo dnf install ffmpeg
```

**Проверка установки:**
```bash
ffmpeg -version
```

### 📊 Качество транскрибации

**Факторы, влияющие на качество:**

| Фактор | Влияние | Рекомендация |
|--------|---------|--------------|
| **Качество аудио** | ⭐⭐⭐⭐⭐ | Используйте микрофон, а не встроенный |
| **Фоновый шум** | ⭐⭐⭐⭐ | Запись в тихом месте |
| **Акцент говорящего** | ⭐⭐⭐ | Русский акцент распознается хорошо |
| **Скорость речи** | ⭐⭐ | Умеренная скорость лучше |
| **Технические термины** | ⭐⭐⭐⭐ | Требуется AI-фильтрация после |
| **Битрейт аудио** | ⭐⭐ | 64+ kbps достаточно |

**Типичные ошибки распознавания:**

1. **Технические термины:**
   - "машинное обучение" → "масинное абучение"
   - "интеграл" → "интиграл"
   - "алгоритм" → "алгаритм"
   
2. **Иностранные слова:**
   - "GitHub" → "гит хаб"
   - "Python" → "питон"
   - "API" → "а пи ай"

3. **Омофоны:**
   - "код" ↔ "кот"
   - "луг" ↔ "лук"

4. **Фразы-паразиты (сохраняются):**
   - "ээ", "ну", "вот", "это самое", "короче"

**Решение:** Используйте AI-фильтрацию (TranscriptionFilter) для исправления этих ошибок.

### 🔍 Дополнительные эндпоинты

#### `GET /api/transcribe/health` - Проверка Whisper

```python
@router.get("/health")
async def health_check():
    try:
        model = get_whisper_model()
        return {
            "status": "healthy",
            "message": "✅ Модель Whisper 'medium' загружена и готова",
            "model": "medium",
            "local": True
        }
    except Exception as e:
        return {"status": "unhealthy", "message": f"❌ {e}"}
```

**Ответ:**
```json
{
  "status": "healthy",
  "message": "✅ Модель Whisper 'medium' загружена и готова",
  "model": "medium",
  "local": true
}
```

#### `GET /api/transcribe/model-info` - Информация о модели

```json
{
  "model": "medium",
  "size": "~1.5 GB",
  "loaded": true,
  "cache_location": "C:/Users/user/.cache/whisper/",
  "supported_formats": ["mp3", "wav", "m4a", "flac", "ogg", "opus", "mp4", "mov", "avi", "mkv", "webm"]
}
```

#### `GET /api/transcribe/filter/health` - Проверка AI-фильтра

```json
{
  "status": "healthy",
  "message": "✅ AI-фильтр готов к работе",
  "uses_deepseek": true
}
```

### 🚀 Установка и запуск

**1. Установка зависимостей:**
```bash
pip install openai-whisper ffmpeg-python torch torchaudio
```

**2. Установка FFmpeg:**
```bash
winget install ffmpeg  # Windows
```

**3. Настройка переменных окружения (.env):**
```bash
# Модель Whisper (tiny/base/small/medium/large)
WHISPER_MODEL=medium
```

**4. Загрузка модели (опционально, произойдет автоматически):**
```bash
python download_model.py
# Выберите модель: medium
```

**5. Запуск backend:**
```bash
# Windows
start_api_medium.bat

# macOS/Linux
./start_api_medium.sh

# Или вручную
python -m uvicorn api.app:app --reload --host 0.0.0.0 --port 8000
```

**6. Проверка:**
```bash
curl http://localhost:8000/api/transcribe/health
```

### 🐛 Troubleshooting

#### Ошибка: "FFmpeg not found"

**Решение:**
```bash
# 1. Установите FFmpeg
winget install ffmpeg

# 2. Перезапустите терминал

# 3. Проверьте
ffmpeg -version
```

#### Ошибка: "moov atom not found"

**Причина:** Файл не полностью загружен или поврежден.

**Решение:**
- Используйте `fsync()` при сохранении (уже реализовано)
- Проверьте целостность аудиофайла

#### Ошибка: "CUDA out of memory"

**Решение:**
```python
# Отключите GPU, используйте CPU
result = model.transcribe(audio_path, fp16=False)
```

#### Медленная транскрибация

**Решение:**
1. Используйте меньшую модель (`small` вместо `medium`)
2. Установите CUDA для GPU ускорения
3. Уменьшите длительность аудио (разбейте на части)

### 📈 Оптимизация производительности

**1. GPU ускорение (CUDA):**
```bash
# Установите PyTorch с CUDA
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# В коде используйте fp16=True
result = model.transcribe(audio_path, fp16=True)
```

**2. Кэширование модели:**
```python
# Модель загружается ОДИН раз при старте сервера
_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        _whisper_model = whisper.load_model('medium')
    return _whisper_model
```

**3. Асинхронная обработка:**
```python
# Используйте BackgroundTasks для длинных аудио
from fastapi import BackgroundTasks

@router.post("/audio-async")
async def transcribe_async(audio: UploadFile, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_audio, audio)
    return {"status": "processing", "task_id": "..."}
```

### 📚 Дополнительные ресурсы

- **Whisper GitHub:** https://github.com/openai/whisper
- **Whisper Paper:** https://arxiv.org/abs/2212.04356
- **FFmpeg:** https://ffmpeg.org/
- **Модели:** https://github.com/openai/whisper/blob/main/model-card.md

---
# или
./start_api_medium.sh  # macOS/Linux
```

---

## ⚙️ Настройка и конфигурация

### Файл .env

```bash
# ============================================
# DEEPSEEK API (via VseLLM)
# ============================================
# Получить ключ: https://vsellm.ru
DEEPSEEK_API_KEY=vsellm_your_api_key_here

# Base URL провайдера VseLLM
DEEPSEEK_BASE_URL=https://api.vsellm.ru/v1

# Модель DeepSeek
DEEPSEEK_MODEL=deepseek/deepseek-v3.2

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

#### Ошибка: "503 Service Unavailable"
- Сервер VseLLM временно недоступен
- Retry логика автоматически повторит (3 попытки)
- Проверьте баланс на https://vsellm.ru

#### Ошибка: "Rate limit exceeded"
- Превышен лимит запросов API
- Подождите несколько минут и повторите

---

## 📦 Зависимости

### Python (requirements.txt)

```txt
# DeepSeek API (OpenAI-compatible)
openai>=1.0.0

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
