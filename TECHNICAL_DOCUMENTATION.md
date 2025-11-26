# Техническая документация веб-приложения Student AI Assistant

**Версия:** 0.1.0  
**Дата:** 26 ноября 2025  
**Статус:** Production Ready

---

## 1. Общая архитектура системы

### 1.1 Архитектурный паттерн

Приложение построено по классической клиент-серверной архитектуре с разделением на фронтенд и бэкенд:

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  React 18 + TypeScript SPA (Single Page Application)        │
│  - Компонентная архитектура                                  │
│  - React Router для маршрутизации                            │
│  - Context API для управления состоянием                     │
│  - Custom Hooks для бизнес-логики                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP/REST API
                     │ JSON payload
                     │
┌────────────────────▼────────────────────────────────────────┐
│                        SERVER LAYER                          │
│  FastAPI (Python 3.13) REST API                             │
│  - RESTful endpoints                                         │
│  - Pydantic для валидации данных                             │
│  - CORS middleware                                           │
│  - Логирование запросов                                      │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Технологический стек

**Фронтенд:**
- React 18.2.0 (UI библиотека)
- TypeScript 4.7.4 (типизация)
- React Router DOM 6.3.0 (маршрутизация)
- TipTap 3.7.2 (WYSIWYG редактор)
- Tailwind CSS (стилизация)
- Framer Motion 12.23.24 (анимации)

**Бэкенд:**
- FastAPI 0.104.1 (веб-фреймворк)
- Uvicorn 0.24.0 (ASGI сервер)
- Pydantic 2.9.0 (валидация данных)
- Python 3.13

**Вспомогательные технологии:**
- PostCSS + Autoprefixer (CSS обработка)
- React Scripts 5.0.1 (сборка и разработка)

### 1.3 Коммуникационный протокол

- **Протокол:** HTTP/HTTPS
- **Формат данных:** JSON
- **API стиль:** REST
- **Порты:** 
  - Frontend: 3000 (development)
  - Backend: 8000 (default)

---

## 2. Бэкенд: детальное описание

### 2.1 Технологии и фреймворки

**Основной фреймворк:** FastAPI 0.104.1

FastAPI выбран по следующим причинам:
- Высокая производительность (на уровне NodeJS и Go)
- Автоматическая генерация OpenAPI документации
- Встроенная валидация данных через Pydantic
- Нативная поддержка async/await
- Автоматическая сериализация/десериализация JSON

**ASGI сервер:** Uvicorn 0.24.0 с поддержкой стандартных расширений

### 2.2 Структура бэкенда

```
api/
├── __init__.py           # Инициализация пакета
├── app.py                # Главный файл приложения, конфигурация FastAPI
├── ml_endpoints.py       # REST API endpoints для обработки текста
└── transcribe.py         # Endpoints транскрибации (исключено из документации)
```

### 2.3 Основные модули

#### 2.3.1 Модуль `app.py`

Главный модуль приложения, отвечающий за инициализацию FastAPI и подключение middleware.

**Основные компоненты:**

```python
app = FastAPI(title="Student AI Assistant ML API")
```

**CORS конфигурация:**
```python
CORSMiddleware(
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
```

Настройки CORS разрешают:
- Запросы с локального фронтенда (порт 3000)
- Все HTTP методы (GET, POST, PUT, DELETE, OPTIONS)
- Все заголовки
- Передачу credentials (cookies, authorization headers)

**Подключение роутеров:**
- `ml_endpoints.router` - обработка текстовых данных
- `transcribe_router` - транскрибация (исключено)

#### 2.3.2 Модуль `ml_endpoints.py`

REST API для обработки текстовых данных.

**Префикс роутера:** `/api/ml`

**Основные endpoints:**

| Метод | Путь | Описание | Параметры |
|-------|------|----------|-----------|
| GET | `/api/ml/health` | Проверка работоспособности API | - |
| POST | `/api/ml/process` | Обработка текста в выбранном режиме | `text`, `mode`, `topic?` |
| POST | `/api/ml/batch-process` | Пакетная обработка текста | `text`, `modes[]` |
| GET | `/api/ml/modes` | Получение списка доступных режимов | - |
| POST | `/api/ml/quick-summary` | Быстрое создание конспекта | `text` |

### 2.4 Модели данных (Pydantic)

#### 2.4.1 `ProcessRequest`

Запрос на обработку текста:

```python
class ProcessRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=70000)
    mode: str = Field(...)
    topic: Optional[str] = Field(None)
    context: Optional[str] = Field(None)
```

**Валидация:**
- `text`: 10-70000 символов (обязательно)
- `mode`: строка из списка допустимых режимов
- `topic`: опционально, обязательно для режима `expand_topic`

#### 2.4.2 `ProcessResponse`

Ответ обработки текста:

```python
class ProcessResponse(BaseModel):
    success: bool
    mode: str
    processed_text: str
    processing_time: float
    timestamp: datetime
    error: Optional[str] = None
```

#### 2.4.3 `BatchProcessRequest`

Запрос пакетной обработки:

```python
class BatchProcessRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=70000)
    modes: List[str] = Field(..., min_items=1, max_items=5)
```

#### 2.4.4 `HealthResponse`

Ответ health check:

```python
class HealthResponse(BaseModel):
    status: str
    gemini_api_available: bool
    message: str
    timestamp: datetime
```

### 2.5 Логика обработки данных

#### 2.5.1 Endpoint `/api/ml/process`

**Алгоритм обработки:**

1. Валидация входных данных через Pydantic
2. Проверка режима обработки (6 доступных режимов)
3. Дополнительная валидация для `expand_topic`
4. Получение глобального экземпляра процессора
5. Обработка текста через процессор
6. Вычисление времени обработки
7. Формирование ответа с метаданными

**Обработка ошибок:**
- HTTP 400: невалидные параметры
- HTTP 500: внутренняя ошибка обработки
- Все ошибки логируются

#### 2.5.2 Endpoint `/api/ml/batch-process`

Позволяет обработать один текст несколькими режимами за один запрос.

**Преимущества:**
- Снижение количества HTTP запросов
- Оптимизация времени обработки
- Единый контекст для всех режимов

**Ограничения:**
- Максимум 5 режимов за запрос
- Общий лимит текста 70000 символов

#### 2.5.3 Endpoint `/api/ml/modes`

Возвращает метаданные о доступных режимах обработки:

```json
{
  "modes": {
    "summarize": {
      "name": "Краткий конспект",
      "description": "Создание структурированного конспекта лекции",
      "requires_topic": false
    },
    "extract_terms": {
      "name": "Извлечение терминов",
      "description": "Поиск ключевых терминов и их определений",
      "requires_topic": false
    },
    // ... другие режимы
  }
}
```

### 2.6 Безопасность

#### 2.6.1 Валидация входных данных

**Уровень 1: Pydantic валидация**
- Автоматическая проверка типов
- Ограничения длины строк (10-70000 символов)
- Проверка обязательных полей
- Валидация списков (min_items, max_items)

**Уровень 2: Бизнес-логика**
- Проверка допустимых значений `mode`
- Дополнительная валидация для специфичных режимов
- Санитизация входных данных

#### 2.6.2 CORS политика

Строгая CORS политика разрешает запросы только с:
- `http://localhost:3000`
- `http://127.0.0.1:3000`

Для production необходимо добавить домены продакшн-сервера.

#### 2.6.3 Обработка ошибок

Все ошибки обрабатываются централизованно:
- Логирование всех исключений
- Возврат структурированных ошибок клиенту
- Скрытие внутренних деталей реализации

### 2.7 Логирование и мониторинг

#### 2.7.1 Middleware логирования

```python
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = datetime.now()
    logger.info(f"ML API запрос: {request.method} {request.url}")
    response = await call_next(request)
    process_time = (datetime.now() - start_time).total_seconds()
    logger.info(f"ML API ответ: {response.status_code}, время: {process_time:.2f}с")
    return response
```

**Логируемые данные:**
- HTTP метод и URL
- Время обработки запроса
- Статус код ответа
- Ошибки обработки

#### 2.7.2 Уровни логирования

- **INFO:** успешные операции, метрики производительности
- **ERROR:** ошибки обработки, исключения
- **DEBUG:** детальная информация для отладки (не используется в production)

### 2.8 Деплой и запуск

#### 2.8.1 Development режим

```bash
uvicorn api.app:app --reload --host 0.0.0.0 --port 8000
```

Параметры:
- `--reload`: автоперезагрузка при изменении кода
- `--host 0.0.0.0`: доступ из внешней сети
- `--port 8000`: порт сервера

#### 2.8.2 Production режим

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

#### 2.8.3 Скрипты запуска

**Windows:** `start_api_medium.bat`
**Linux/Mac:** `start_api_medium.sh`

### 2.9 Зависимости бэкенда

```
fastapi==0.104.1          # Веб-фреймворк
uvicorn[standard]==0.24.0 # ASGI сервер
pydantic==2.9.0           # Валидация данных
python-dotenv==1.0.0      # Переменные окружения
python-multipart==0.0.6   # Обработка multipart/form-data
aiofiles==23.2.1          # Асинхронная работа с файлами
gunicorn==21.2.0          # Production WSGI сервер
pytest==7.4.0             # Тестирование
httpx==0.25.0             # HTTP клиент для тестов
```

---

## 3. Фронтенд: детальное описание

### 3.1 Технологический стек

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

### 3.2 Структура фронтенда

```
src/
├── components/          # React компоненты
│   ├── AccountPage.tsx      # Страница аккаунта
│   ├── AuthPage.tsx         # Страница аутентификации
│   ├── Features.tsx         # Секция особенностей
│   ├── Footer.tsx           # Футер
│   ├── Header.tsx           # Шапка сайта
│   ├── Hero.tsx             # Главная секция
│   ├── HowItWorks.tsx       # Секция "Как работает"
│   ├── PricingPage.tsx      # Страница тарифов
│   ├── RichTextEditor.tsx   # WYSIWYG редактор
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

### 3.3 Ключевые компоненты

#### 3.3.1 `App.tsx`

Корневой компонент приложения с маршрутизацией.

**Структура:**
```typescript
<ThemeProvider>
  <Router>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/auth" element={<AuthPageWrapper />} />
      <Route path="/account" element={<AccountPageWrapper />} />
      <Route path="/pricing" element={<PricingPageWrapper />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Router>
</ThemeProvider>
```

**Особенности:**
- Обертка `ThemeProvider` для глобального управления темой
- Fallback маршрут перенаправляет на главную
- Wrapper компоненты для инжекции контекста темы

#### 3.3.2 `Header.tsx`

Навигационная шапка сайта.

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

#### 3.3.3 `RichTextEditor.tsx`

WYSIWYG редактор на базе TipTap.

**Возможности редактора:**
- Форматирование текста (жирный, курсив, код)
- Заголовки (H1-H3)
- Списки (маркированные, нумерованные)
- Цитаты
- Блоки кода
- Отмена/повтор действий

**Архитектура:**
```typescript
const editor = useEditor({
  extensions: [
    StarterKit.configure({...}),
    HardBreak,
    CodeBlock,
  ],
  content: initialContent,
  onUpdate: ({ editor }) => {
    const html = editor.getHTML();
    onContentChange?.(html);
  },
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
  onEditorReady?: (editor: any) => void;
  showModeSwitcher?: boolean;
  originalText?: string;
  processedText?: string;
  currentMode?: 'original' | 'processed';
  onModeChange?: (mode: 'original' | 'processed') => void;
  isProcessing?: boolean;
}
```

#### 3.3.4 `UploadDemo.tsx`

Компонент демонстрации загрузки файлов.

**Функциональность:**
- Кнопка выбора файла
- Индикатор прогресса загрузки
- Обработка ошибок
- Навигация на страницу аккаунта после клика

**Состояние:**
```typescript
{
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  success: boolean;
}
```

#### 3.3.5 `Features.tsx`

Секция особенностей платформы.

**Отображаемые feature:**
- Высокая точность
- Быстрая обработка
- Защита данных

**Структура feature:**
```typescript
{
  icon: string;
  title: string;
  description: string;
}
```

**Визуальные эффекты:**
- Hover анимации карточек
- Градиентные фоны иконок
- Трансформации при наведении

#### 3.3.6 `Hero.tsx`

Главная секция landing page.

**Содержимое:**
- Заголовок приложения
- Описание функциональности
- CTA кнопка
- Декоративные элементы

#### 3.3.7 `HowItWorks.tsx`

Секция с описанием процесса работы.

**Структура:**
- Пошаговое описание
- Визуальные индикаторы
- Анимированные переходы

#### 3.3.8 `Footer.tsx`

Футер сайта.

**Содержимое:**
- Copyright информация
- Дополнительные ссылки
- Социальные сети (опционально)

#### 3.3.9 `AuthPage.tsx`

Страница аутентификации.

**Функциональность:**
- Форма входа
- Форма регистрации
- Переключение между режимами
- Валидация полей

#### 3.3.10 `AccountPage.tsx`

Личный кабинет пользователя.

**Функциональность:**
- Отображение информации профиля
- Управление настройками
- История операций

#### 3.3.11 `PricingPage.tsx`

Страница с тарифными планами.

**Содержимое:**
- Сравнительная таблица тарифов
- Описание возможностей каждого плана
- Кнопки подписки

### 3.4 Маршруты и страницы

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

### 3.5 Управление состоянием

#### 3.5.1 Context API: ThemeContext

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
    const saved = localStorage.getItem('isLightTheme');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('isLightTheme', JSON.stringify(isLightTheme));
  }, [isLightTheme]);

  const toggleTheme = () => {
    setIsLightTheme(!isLightTheme);
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

#### 3.5.2 Local State Management

Компоненты используют локальное состояние через `useState`:
- Состояние форм
- UI состояния (открыто/закрыто)
- Временные данные

### 3.6 Custom Hooks

#### 3.6.1 `useMLProcessor`

**Назначение:** взаимодействие с ML API для обработки текста

**Интерфейс:**
```typescript
{
  // Состояние
  isProcessing: boolean;
  currentMode: MLMode | null;
  result: string | null;
  error: string | null;
  
  // Методы
  processText: (text: string, mode: MLMode, topic?: string) => Promise<string | null>;
  batchProcess: (text: string, modes: MLMode[]) => Promise<Record<MLMode, string> | null>;
  getModes: () => Promise<any>;
  reset: () => void;
  cancelProcessing: () => void;
}
```

**Ключевые возможности:**

1. **Обработка текста:**
```typescript
const processText = async (text: string, mode: MLMode, topic?: string) => {
  // Валидация
  if (!text.trim()) {
    setState(prev => ({ ...prev, error: 'Текст не может быть пустым' }));
    return null;
  }

  // Отправка запроса
  const response = await fetch(`${API_BASE_URL}/api/ml/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, mode, topic }),
    signal: abortControllerRef.current.signal
  });

  // Обработка ответа
  const data = await response.json();
  setState({
    isProcessing: false,
    currentMode: mode,
    result: data.processed_text,
    error: null
  });

  return data.processed_text;
};
```

2. **Отмена запросов:**
```typescript
const cancelProcessing = () => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
  }
};
```

3. **Обработка ошибок:**
- Парсинг различных форматов ошибок от API
- Обработка AbortError при отмене
- Детальное логирование

#### 3.6.2 `useFileUpload`

**Назначение:** загрузка файлов на сервер

**Интерфейс:**
```typescript
{
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  success: boolean;
  uploadFile: (file: File) => Promise<void>;
  resetState: () => void;
}
```

**Функциональность:**
- Симуляция прогресса загрузки
- Обработка ошибок
- Автоматический сброс состояния через 3 секунды после успеха

**Примечание:** текущая реализация содержит симуляцию. Для production необходимо реализовать реальную загрузку.

#### 3.6.3 `useExport`

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
  const markdown = convertHtmlToMarkdown(html);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  downloadFile(blob, filename);
};
```

Конвертация HTML → Markdown:
- `<h1>` → `# `
- `<strong>` → `**text**`
- `<em>` → `*text*`
- `<ul><li>` → `- item`
- `<ol><li>` → `1. item`

3. **DOCX (Microsoft Word):**
```typescript
const exportToDocx = async (options = {}) => {
  const html = editor.getHTML();
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Times New Roman', serif; }
        h1, h2, h3 { font-weight: bold; }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `;
  
  const docxBlob = htmlDocx.asBlob(htmlContent);
  downloadFile(docxBlob, filename);
};
```

4. **PDF:**
```typescript
const exportToPdf = async (options = {}) => {
  const html = editor.getHTML();
  
  // Загрузка шрифта Roboto для кириллицы
  const robotoFont = await loadFont('/Roboto-Regular.ttf');
  
  // Конвертация HTML в pdfmake структуру
  const pdfContent = convertHtmlToPdfContent(html);
  
  // Создание PDF
  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [50, 60, 50, 60],
    content: pdfContent,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 12,
      lineHeight: 1.5
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

### 3.7 TypeScript типы

#### 3.7.1 `ml.ts`

Типы для взаимодействия с ML API:

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
  mode: MLMode;
  input_length: number;
  output_length: number;
  processing_time?: number;
}

// Состояние обработки
export interface MLProcessingState {
  isProcessing: boolean;
  currentMode: MLMode | null;
  result: string | null;
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

### 3.8 Взаимодействие с API

#### 3.8.1 Конфигурация API

```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
```

Переменная окружения `REACT_APP_API_URL` позволяет настроить URL API для разных окружений.

#### 3.8.2 Паттерн запросов

Все API запросы следуют единому паттерну:

```typescript
try {
  // 1. Валидация входных данных
  if (!data.isValid()) {
    throw new Error('Invalid data');
  }

  // 2. Установка состояния загрузки
  setState({ isProcessing: true, error: null });

  // 3. Отправка запроса
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal: abortController.signal
  });

  // 4. Проверка статуса
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Request failed');
  }

  // 5. Парсинг ответа
  const result = await response.json();

  // 6. Обновление состояния
  setState({ 
    isProcessing: false, 
    result: result.data,
    error: null 
  });

  return result.data;

} catch (error) {
  // 7. Обработка ошибок
  if (error.name === 'AbortError') {
    // Запрос отменен
    return null;
  }
  
  setState({ 
    isProcessing: false, 
    error: error.message 
  });
  
  return null;
}
```

#### 3.8.3 Обработка ошибок

**Типы ошибок:**

1. **Сетевые ошибки:**
```typescript
catch (error) {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    // Сервер недоступен
    setState({ error: 'Сервер недоступен. Проверьте подключение.' });
  }
}
```

2. **HTTP ошибки:**
```typescript
if (!response.ok) {
  const errorData = await response.json();
  
  // FastAPI validation errors
  if (errorData.detail && Array.isArray(errorData.detail)) {
    const messages = errorData.detail.map(e => e.msg).join(', ');
    throw new Error(messages);
  }
  
  // Custom error messages
  throw new Error(errorData.detail || errorData.message);
}
```

3. **Отмена запросов:**
```typescript
if (error.name === 'AbortError') {
  // Пользователь отменил запрос
  setState({ isProcessing: false, error: null });
  return null;
}
```

### 3.9 Стилизация и темизация

#### 3.9.1 Tailwind CSS конфигурация

**tailwind.config.js:**

```javascript
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0e1f',
        'bg-secondary': '#13265c',
        'text-primary': '#e9effa',
        'text-secondary': '#99b5ea',
        'border-color': 'rgba(153, 181, 234, 0.1)',
        'hover-bg': 'rgba(153, 181, 234, 0.03)',
      },
      fontFamily: {
        'serif': ['Georgia', 'Times New Roman', 'serif'],
      },
      animation: {
        'cloud-drift': 'cloudDrift 60s ease-in-out infinite',
        'cloud-drift-reverse': 'cloudDrift 50s ease-in-out infinite reverse',
      },
      spacing: {
        '15': '3.75rem',
        '25': '6.25rem',
        '30': '7.5rem',
        '40': '10rem',
        '60': '15rem',
        '70': '17.5rem',
      }
    },
  },
  plugins: [],
}
```

#### 3.9.2 CSS переменные для темизации

**Темная тема (по умолчанию):**
```css
:root {
  --bg-primary: #0a0e1f;
  --bg-secondary: #13265c;
  --text-primary: #e9effa;
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
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
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

#### 3.9.3 Анимации

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
  transition={{ duration: 0.5 }}
>
  Content
</motion.div>
```

#### 3.9.4 Responsive дизайн

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

### 3.10 UX стратегии

#### 3.10.1 Индикаторы загрузки

- Спиннеры для асинхронных операций
- Progress bars для загрузки файлов
- Skeleton screens для контента
- Disabled состояния кнопок

#### 3.10.2 Обратная связь

- Toast уведомления (success/error)
- Inline валидация форм
- Подсветка активных элементов
- Hover эффекты для интерактивных элементов

#### 3.10.3 Доступность (A11y)

- Semantic HTML
- ARIA атрибуты
- Keyboard navigation
- Focus indicators
- Alt текст для изображений

#### 3.10.4 Производительность

- Lazy loading компонентов
- Мемоизация дорогих вычислений
- Debounce для поисковых запросов
- Оптимизация ре-рендеров

---

## 4. Зависимости, конфигурации и потоки данных

### 4.1 Зависимости проекта

#### 4.1.1 Фронтенд зависимости (package.json)

**Production зависимости:**

```json
{
  "dependencies": {
    "@tiptap/core": "3.7.2",
    "@tiptap/pm": "3.7.2",
    "@tiptap/react": "3.7.2",
    "@tiptap/starter-kit": "3.7.2",
    "docx": "^8.5.0",
    "file-saver": "^2.0.5",
    "framer-motion": "^12.23.24",
    "html-docx-js": "^0.3.1",
    "html-to-docx": "^1.8.0",
    "html2canvas": "^1.4.1",
    "jspdf": "^3.0.3",
    "mammoth": "^1.11.0",
    "marked": "^16.4.1",
    "pdf-lib": "^1.17.1",
    "pdf-parse": "^2.4.5",
    "pdfjs-dist": "^5.4.296",
    "pdfmake": "^0.2.20",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "react-router-dom": "^6.3.0",
    "react-scripts": "5.0.1",
    "turndown": "7.1.2",
    "typescript": "^4.7.4"
  }
}
```

**Dev зависимости:**

```json
{
  "devDependencies": {
    "@types/file-saver": "^2.0.7",
    "@types/pdfmake": "^0.2.12",
    "@types/html2canvas": "^0.5.35",
    "@types/jest": "^27.5.2",
    "@types/node": "^16.11.56",
    "@types/react": "^18.0.17",
    "@types/react-dom": "^18.0.6",
    "@testing-library/jest-dom": "^5.16.4",
    "@testing-library/react": "^13.3.0",
    "@testing-library/user-event": "^13.5.0"
  }
}
```

#### 4.1.2 Бэкенд зависимости (requirements.txt)

```
# Веб-фреймворк
fastapi==0.104.1
uvicorn[standard]==0.24.0

# Обработка данных
pydantic==2.9.0
python-dotenv==1.0.0

# Утилиты
python-multipart==0.0.6
aiofiles==23.2.1

# Тестирование
pytest==7.4.0
httpx==0.25.0

# Работа с документами
PyPDF2==3.0.1
python-docx==0.8.11

# Production сервер
gunicorn==21.2.0

# Дополнительно
numpy>=1.26.2
requests
```

### 4.2 Конфигурационные файлы

#### 4.2.1 TypeScript конфигурация (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "typeRoots": ["node_modules/@types", "src/types"]
}
```

**Ключевые настройки:**
- `strict: true` - строгая типизация
- `jsx: "react-jsx"` - новый JSX transform (React 17+)
- `moduleResolution: "node"` - разрешение модулей как в Node.js
- `esModuleInterop: true` - совместимость с CommonJS модулями

#### 4.2.2 PostCSS конфигурация (postcss.config.js)

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

#### 4.2.3 Package.json scripts

```json
{
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}
```

**Команды:**
- `npm start` - запуск dev сервера (порт 3000)
- `npm run build` - production сборка в папку `build/`
- `npm test` - запуск тестов
- `npm run eject` - извлечение конфигурации (необратимо)

### 4.3 Переменные окружения

#### 4.3.1 Фронтенд (.env)

```
REACT_APP_API_URL=http://localhost:8000
```

**Использование:**
```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
```

**Примечание:** все переменные должны начинаться с `REACT_APP_`

#### 4.3.2 Бэкенд (.env)

```
# API ключи (не включены в документацию по требованию)
GEMINI_API_KEY=your_api_key_here

# Настройки сервера
HOST=0.0.0.0
PORT=8000
WORKERS=4

# Режим
ENVIRONMENT=development
```

### 4.4 Потоки данных

#### 4.4.1 Поток обработки текста

```
┌─────────────┐
│   User      │
│  вводит     │
│   текст     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  RichTextEditor Component               │
│  - Получает ввод пользователя          │
│  - Форматирует текст                    │
│  - Вызывает onContentChange             │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Parent Component (AccountPage)         │
│  - Сохраняет текст в state              │
│  - Пользователь выбирает режим          │
│  - Вызывает useMLProcessor.processText  │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  useMLProcessor Hook                    │
│  - Валидирует входные данные            │
│  - Устанавливает isProcessing = true    │
│  - Формирует HTTP запрос                │
└──────┬──────────────────────────────────┘
       │
       │ HTTP POST /api/ml/process
       │ { text, mode, topic? }
       ▼
┌─────────────────────────────────────────┐
│  FastAPI Backend                        │
│  /api/ml/process endpoint               │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Pydantic Validation                    │
│  - Проверка типов                       │
│  - Проверка длины текста (10-70000)     │
│  - Проверка режима                      │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Business Logic                         │
│  - Получение процессора                 │
│  - Обработка текста (исключено)         │
│  - Вычисление времени обработки         │
└──────┬──────────────────────────────────┘
       │
       │ HTTP Response
       │ { success, mode, processed_text, processing_time }
       ▼
┌─────────────────────────────────────────┐
│  useMLProcessor Hook                    │
│  - Парсит ответ                         │
│  - Обновляет state                      │
│  - Устанавливает isProcessing = false   │
│  - Возвращает processed_text            │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Parent Component                       │
│  - Получает обработанный текст          │
│  - Обновляет редактор                   │
│  - Показывает результат пользователю    │
└─────────────────────────────────────────┘
```

#### 4.4.2 Поток экспорта документа

```
┌─────────────┐
│   User      │
│  нажимает   │
│  "Экспорт"  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Component с редактором                 │
│  - Вызывает useExport hook              │
│  - Выбирает формат (PDF/DOCX/MD/TXT)    │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  useExport Hook                         │
│  - Получает HTML из editor.getHTML()    │
│  - Выбирает метод экспорта              │
└──────┬──────────────────────────────────┘
       │
       ├─────────────┬─────────────┬──────────────┐
       │             │             │              │
       ▼             ▼             ▼              ▼
   ┌──────┐    ┌─────────┐   ┌────────┐    ┌─────────┐
   │ TXT  │    │   MD    │   │  DOCX  │    │   PDF   │
   └──┬───┘    └────┬────┘   └───┬────┘    └────┬────┘
      │             │             │              │
      │             │             │              │
      ▼             ▼             ▼              ▼
   getText()   convertHTML   htmlDocx.      pdfMake
                 ToMD()      asBlob()      createPdf()
      │             │             │              │
      │             │             │              │
      └─────────────┴─────────────┴──────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  file-saver          │
              │  saveAs(blob, name)  │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Браузер             │
              │  Скачивание файла    │
              └──────────────────────┘
```

#### 4.4.3 Поток управления темой

```
┌─────────────┐
│   User      │
│  переключает│
│    тему     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Header Component                       │
│  - Вызывает toggleTheme()               │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  ThemeContext                           │
│  - Инвертирует isLightTheme             │
│  - Сохраняет в localStorage             │
│  - Уведомляет подписчиков               │
└──────┬──────────────────────────────────┘
       │
       ├──────────────────┬──────────────────┐
       │                  │                  │
       ▼                  ▼                  ▼
┌────────────┐    ┌────────────┐    ┌────────────┐
│ Component  │    │ Component  │    │ Component  │
│     A      │    │     B      │    │     C      │
└────────────┘    └────────────┘    └────────────┘
       │                  │                  │
       │                  │                  │
       ▼                  ▼                  ▼
   Применяют         Применяют         Применяют
   className         className         className
   "light-theme"     "light-theme"     "light-theme"
       │                  │                  │
       └──────────────────┴──────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  CSS переменные      │
              │  --text-primary      │
              │  --bg-primary        │
              │  и т.д.              │
              └──────────────────────┘
```

#### 4.4.4 Поток навигации

```
┌─────────────┐
│   User      │
│  кликает    │
│   на Link   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  React Router                           │
│  - Перехватывает клик                   │
│  - Предотвращает перезагрузку страницы  │
│  - Обновляет URL                        │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Routes Component                       │
│  - Сопоставляет URL с маршрутом         │
│  - Выбирает компонент для рендера       │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Target Page Component                  │
│  - Монтируется                          │
│  - Выполняет useEffect                  │
│  - Загружает данные (если нужно)        │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Browser                                │
│  - Обновляет history                    │
│  - Прокручивает к началу (опционально)  │
└─────────────────────────────────────────┘
```

### 4.5 Взаимодействие фронтенд-бэкенд

#### 4.5.1 Схема взаимодействия

```
Frontend (React)                    Backend (FastAPI)
─────────────────                   ─────────────────

┌──────────────┐                    ┌──────────────┐
│  Component   │                    │   Endpoint   │
│              │                    │              │
│  useState    │                    │  @router     │
│  useEffect   │                    │  .post()     │
└──────┬───────┘                    └──────▲───────┘
       │                                   │
       │  1. User action                   │
       ▼                                   │
┌──────────────┐                           │
│  Custom Hook │                           │
│              │                           │
│  useMLProc   │                           │
└──────┬───────┘                           │
       │                                   │
       │  2. fetch()                       │
       │  POST /api/ml/process             │
       │  Content-Type: application/json   │
       │  Body: { text, mode, topic }      │
       │                                   │
       └───────────────────────────────────┘
                                           │
                                           │  3. Pydantic
                                           │     validation
                                           ▼
                                    ┌──────────────┐
                                    │  Processor   │
                                    │              │
                                    │  Business    │
                                    │  Logic       │
                                    └──────┬───────┘
                                           │
       ┌───────────────────────────────────┘
       │  4. Response
       │  { success, processed_text, ... }
       ▼
┌──────────────┐
│  Custom Hook │
│              │
│  setState()  │
└──────┬───────┘
       │
       │  5. Update UI
       ▼
┌──────────────┐
│  Component   │
│              │
│  Re-render   │
└──────────────┘
```

#### 4.5.2 Обработка состояний запроса

**Idle (покой):**
```typescript
{
  isProcessing: false,
  result: null,
  error: null
}
```

**Loading (загрузка):**
```typescript
{
  isProcessing: true,
  result: null,
  error: null
}
```

**Success (успех):**
```typescript
{
  isProcessing: false,
  result: "processed text...",
  error: null
}
```

**Error (ошибка):**
```typescript
{
  isProcessing: false,
  result: null,
  error: "Error message"
}
```

---

## 5. Риски и рекомендации по развитию

### 5.1 Текущие риски

#### 5.1.1 Безопасность

**Риск:** Отсутствие аутентификации и авторизации

**Описание:** 
- API endpoints доступны без авторизации
- Нет ограничений на количество запросов
- Отсутствует защита от CSRF атак

**Рекомендации:**
1. Внедрить JWT аутентификацию
2. Добавить rate limiting (например, через slowapi)
3. Реализовать RBAC (Role-Based Access Control)
4. Добавить CSRF токены для форм

**Приоритет:** Высокий

---

**Риск:** Отсутствие валидации на стороне клиента

**Описание:**
- Валидация происходит только на сервере
- Пользователь может отправить невалидные данные

**Рекомендации:**
1. Добавить клиентскую валидацию форм
2. Использовать библиотеки типа react-hook-form + zod
3. Показывать ошибки валидации в реальном времени

**Приоритет:** Средний

---

**Риск:** Хранение API ключей в коде

**Описание:**
- API ключи могут быть случайно закоммичены в Git

**Рекомендации:**
1. Использовать .env файлы (уже реализовано)
2. Добавить .env в .gitignore
3. Использовать secrets management в production (AWS Secrets Manager, HashiCorp Vault)

**Приоритет:** Критический

#### 5.1.2 Производительность

**Риск:** Отсутствие кэширования

**Описание:**
- Каждый запрос обрабатывается заново
- Нет кэширования результатов обработки

**Рекомендации:**
1. Внедрить Redis для кэширования результатов
2. Кэшировать на основе hash текста и режима
3. Установить TTL для кэша (например, 24 часа)

**Приоритет:** Средний

---

**Риск:** Блокирующие операции в бэкенде

**Описание:**
- Обработка текста может быть длительной
- Блокирует обработку других запросов

**Рекомендации:**
1. Использовать фоновые задачи (Celery + Redis)
2. Внедрить WebSocket для real-time обновлений
3. Добавить очередь задач

**Приоритет:** Средний

---

**Риск:** Большой размер bundle фронтенда

**Описание:**
- Все библиотеки загружаются сразу
- Медленная начальная загрузка

**Рекомендации:**
1. Внедрить code splitting
2. Lazy loading для маршрутов
3. Оптимизация импортов (tree shaking)
4. Анализ bundle через webpack-bundle-analyzer

**Приоритет:** Низкий

#### 5.1.3 Надежность

**Риск:** Отсутствие базы данных

**Описание:**
- Нет персистентности данных
- История обработок не сохраняется

**Рекомендации:**
1. Внедрить PostgreSQL для хранения данных
2. Сохранять историю обработок пользователя
3. Реализовать миграции через Alembic

**Приоритет:** Высокий

---

**Риск:** Отсутствие логирования ошибок

**Описание:**
- Ошибки логируются только в консоль
- Нет централизованного сбора логов

**Рекомендации:**
1. Внедрить Sentry для отслеживания ошибок
2. Структурированное логирование (JSON logs)
3. Централизованный сбор логов (ELK stack, CloudWatch)

**Приоритет:** Средний

---

**Риск:** Отсутствие мониторинга

**Описание:**
- Нет метрик производительности
- Невозможно отследить проблемы в production

**Рекомендации:**
1. Внедрить Prometheus + Grafana
2. Мониторинг метрик: response time, error rate, throughput
3. Алерты при критических ошибках

**Приоритет:** Средний

#### 5.1.4 Масштабируемость

**Риск:** Монолитная архитектура

**Описание:**
- Все компоненты в одном приложении
- Сложно масштабировать отдельные части

**Рекомендации:**
1. Разделить на микросервисы (при необходимости)
2. Использовать контейнеризацию (Docker)
3. Оркестрация через Kubernetes

**Приоритет:** Низкий (для текущего масштаба)

---

**Риск:** Отсутствие CDN

**Описание:**
- Статические файлы отдаются с сервера приложения
- Медленная загрузка для удаленных пользователей

**Рекомендации:**
1. Использовать CDN (CloudFlare, AWS CloudFront)
2. Оптимизация изображений
3. Кэширование статики на CDN

**Приоритет:** Низкий

### 5.2 Рекомендации по развитию

#### 5.2.1 Краткосрочные (1-3 месяца)

1. **Аутентификация и авторизация**
   - JWT токены
   - Регистрация/вход пользователей
   - Защита API endpoints

2. **База данных**
   - PostgreSQL для хранения данных
   - Модели: User, ProcessingHistory, Settings
   - Миграции через Alembic

3. **Валидация на клиенте**
   - react-hook-form + zod
   - Реальное время валидации
   - Улучшенный UX

4. **Обработка ошибок**
   - Централизованная обработка ошибок
   - Sentry для мониторинга
   - User-friendly сообщения об ошибках

5. **Тестирование**
   - Unit тесты для хуков
   - Integration тесты для API
   - E2E тесты для критических путей

#### 5.2.2 Среднесрочные (3-6 месяцев)

1. **Кэширование**
   - Redis для кэширования результатов
   - Оптимизация повторных запросов
   - Session storage

2. **Фоновые задачи**
   - Celery + Redis
   - Асинхронная обработка длительных операций
   - WebSocket для уведомлений

3. **Аналитика**
   - Отслеживание использования
   - Метрики производительности
   - A/B тестирование

4. **Улучшение UI/UX**
   - Дизайн система
   - Компонентная библиотека
   - Accessibility аудит

5. **API документация**
   - Swagger UI (автоматически через FastAPI)
   - Примеры использования
   - Versioning API

#### 5.2.3 Долгосрочные (6-12 месяцев)

1. **Микросервисная архитектура**
   - Разделение на сервисы
   - API Gateway
   - Service mesh

2. **Мобильное приложение**
   - React Native
   - Общий API с веб-версией
   - Offline режим

3. **Интернационализация**
   - i18n поддержка
   - Множественные языки
   - Локализация контента

4. **Advanced features**
   - Collaborative editing (real-time)
   - Version control для документов
   - Интеграции с внешними сервисами

5. **Machine Learning оптимизации**
   - Персонализация рекомендаций
   - Предиктивный ввод
   - Автоматическая категоризация

### 5.3 Технический долг

#### 5.3.1 Текущий технический долг

1. **useFileUpload hook**
   - Содержит симуляцию вместо реальной загрузки
   - Необходимо реализовать реальный upload

2. **Отсутствие тестов**
   - Нет unit тестов
   - Нет integration тестов
   - Нет E2E тестов

3. **TypeScript типы**
   - Использование `any` в некоторых местах
   - Неполная типизация некоторых модулей

4. **Дублирование кода**
   - Повторяющиеся паттерны fetch запросов
   - Дублирование стилей

5. **Отсутствие документации**
   - Нет JSDoc комментариев
   - Неполная документация API

#### 5.3.2 План погашения технического долга

**Квартал 1:**
- Покрытие тестами критических путей (70%+)
- Рефакторинг useFileUpload
- Улучшение TypeScript типизации

**Квартал 2:**
- Создание переиспользуемых компонентов
- Централизация API запросов
- Документирование кода

**Квартал 3:**
- Рефакторинг стилей (CSS-in-JS или styled-components)
- Оптимизация производительности
- Code review и улучшение качества кода

### 5.4 Метрики качества

#### 5.4.1 Целевые метрики

**Производительность:**
- Time to First Byte (TTFB): < 200ms
- First Contentful Paint (FCP): < 1.5s
- Time to Interactive (TTI): < 3.5s
- API response time: < 500ms (p95)

**Надежность:**
- Uptime: 99.9%
- Error rate: < 0.1%
- Mean Time to Recovery (MTTR): < 15 минут

**Качество кода:**
- Test coverage: > 80%
- TypeScript strict mode: enabled
- Linter errors: 0
- Security vulnerabilities: 0 (critical/high)

**UX метрики:**
- Bounce rate: < 40%
- Session duration: > 5 минут
- User satisfaction: > 4.5/5

---

## Заключение

Данная техническая документация описывает архитектуру, компоненты и потоки данных веб-приложения Student AI Assistant. Система построена на современном технологическом стеке с использованием FastAPI для бэкенда и React с TypeScript для фронтенда.

**Ключевые преимущества архитектуры:**
- Четкое разделение фронтенда и бэкенда
- RESTful API для коммуникации
- Типобезопасность через TypeScript и Pydantic
- Модульная структура компонентов
- Расширяемость и масштабируемость

**Области для улучшения:**
- Внедрение аутентификации и авторизации
- Добавление базы данных для персистентности
- Улучшение производительности через кэширование
- Расширение тестового покрытия
- Внедрение мониторинга и логирования

Система готова к дальнейшему развитию и масштабированию согласно представленным рекомендациям.

---

**Версия документа:** 1.0  
**Последнее обновление:** 26 ноября 2025  
**Авторы:** Development Team  
**Статус:** Актуально

