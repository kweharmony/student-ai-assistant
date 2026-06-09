# MindeSync

Платформа для автоматической обработки студенческих лекций: загрузка аудио, локальная транскрибация через Whisper, AI-обработка текста через DeepSeek и экспорт в удобные форматы.

## Что умеет проект

- транскрибация аудио в текст локально, без отправки аудио во внешние сервисы
- AI-фильтрация транскрипта от ошибок распознавания и мусора
- генерация конспектов, терминов, вопросов, шпаргалок и расширенных объяснений
- объяснение отдельных фрагментов текста и построение диаграмм через LLM
- экспорт в PDF, DOCX, TXT и Markdown
- каталог дисциплин с иерархией факультет → направление → поток → семестр и модерацией публикаций старостами и администраторами
- совместные доски (Excalidraw) с режимами просмотра и редактирования
- тарифы free/pro и лимиты генераций со скользящим окном (квоты)
- личные кабинеты студентов, преподавателей и администраторов
- отдельный воркер транскрибации с системным треем и heartbeat

## Технологический стек

- Frontend: React 18, TypeScript, TipTap, Tailwind CSS, Framer Motion
- Backend: FastAPI, Uvicorn, SQLAlchemy, Alembic, Pydantic
- ML: Whisper, Qwen через VseLLM (генерация материалов) и отдельный LLM-провайдер PolzaAI для объяснений и диаграмм, локальные фильтры текста
- Infra: PostgreSQL, Redis, Nginx, PDF service на Node.js + Playwright

## Структура проекта

```text
student-ai-assistant/
├── api/                FastAPI backend, роутеры, модели, схемы
├── src/                React frontend
├── ml/                 Промпты и обработка текста
├── worker/             Отдельный воркер транскрибации
├── pdf-service/        Сервис рендера PDF
├── scripts/            Утилиты установки и администрирования
├── docs/               Подробная документация по подсистемам
├── setup.bat/.sh       Автоматическая установка
├── run.bat/.sh         Запуск backend + frontend
├── requirements.txt    Python-зависимости backend
├── package.json        npm-зависимости frontend
└── docker-compose.yml  Полный стек через Docker
```

## Требования

- Python 3.12
- Node.js 20+
- npm
- PostgreSQL 16+ для работы backend
- Redis 7+ для инвалидации токенов и синхронизации WebSocket
- FFmpeg
- DeepSeek API ключ через VseLLM
- NVIDIA GPU с CUDA — опционально, для ускорения воркера

На Windows, macOS и Linux проект можно запускать локально. Для полного стека также доступен Docker Compose.

## Быстрый старт

### Вариант 1. Docker Compose

Подходит, если хотите поднять backend, frontend, PostgreSQL, Redis и PDF service одной командой.

1. Скопируйте `.env.example` в `.env` и заполните значения.
2. Запустите:

```bash
docker compose up --build -d
```

После старта будут доступны:

- сайт: `http://localhost`
- API: `http://localhost:8000`
- документация API: `http://localhost:8000/docs`

Важно: воркер транскрибации в Docker Compose не запускается, его нужно поднимать отдельно на рабочей машине.

### Вариант 2. Локальный запуск без Docker

Этот вариант удобнее, если вы хотите запускать проект напрямую на машине и видеть отдельные процессы backend, frontend и worker.

1. Скопируйте `.env.example` в `.env` и заполните ключи.

2. Установите зависимости через скрипт.

**Что делает `setup`:**
- создаёт `.venv` для Python
- устанавливает backend-зависимости из `requirements.txt`
- скачивает FFmpeg и Node.js в папку проекта
- ставит npm-зависимости для frontend
- предлагает выбрать модель Whisper

**Windows**

```powershell
setup.bat
```

**Linux / macOS**

```bash
chmod +x setup.sh
./setup.sh
```

3. Запустите проект.

**Windows**

```powershell
run.bat
```

**Linux / macOS**

```bash
chmod +x run.sh
./run.sh
```

После этого поднимутся два окна/процесса:

- backend на `http://localhost:8000`
- frontend на `http://localhost:3000`

4. Откройте сайт и проверьте, что API отвечает по `http://localhost:8000/docs`.

### Если нужен ручной старт вместо `run.bat` / `run.sh`

В двух отдельных терминалах запустите backend и frontend вручную:

**Терминал 1 — backend**

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn api.app:app --host 0.0.0.0 --port 8000
```

**Терминал 2 — frontend**

```powershell
npm start
```

Если PowerShell не даёт активировать venv, можно обойтись без `Activate.ps1` и запускать команды через `.venv\Scripts\python`.

### Дополнительно: PDF service и worker

Если вам нужен полный локальный стек, поднимите ещё два компонента отдельно:

**PDF service**

```bash
cd pdf-service
npm install
npm start
```

Он слушает порт `3001` и используется backend для генерации PDF.

**Worker транскрибации**

```powershell
cd worker
python -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip setuptools wheel
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python tray_app.py
```

Для NVIDIA GPU можно поставить PyTorch с CUDA отдельно в `worker/.venv`:

```powershell
.\.venv\Scripts\python -m pip install --index-url https://download.pytorch.org/whl/cu118 torch torchvision torchaudio
```

Worker запускается отдельно и живёт в своей папке, поэтому не зависит от `run.bat`.

## Ручная установка

Если хочется контролировать каждый шаг.

### 1. Создать виртуальное окружение

```powershell
python -m venv .venv
```

### 2. Установить Python-зависимости backend

```powershell
.\.venv\Scripts\python -m pip install --upgrade pip setuptools wheel
.\.venv\Scripts\python -m pip install -r requirements.txt
```

### 3. Установить зависимости frontend

```powershell
npm install
```

### 4. Скачать модель Whisper

```powershell
.\.venv\Scripts\python scripts\download_model.py medium
```

## Настройка окружения

Скопируйте пример и заполните секреты:

```bash
cp .env.example .env
```

Основные переменные:

- `DEEPSEEK_API_KEY` — ключ VseLLM/DeepSeek
- `DEEPSEEK_BASE_URL` — базовый URL провайдера
- `DEEPSEEK_MODEL` — модель DeepSeek
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `DATABASE_URL` — строка подключения к PostgreSQL
- `SECRET_KEY` — секрет для JWT
- `REDIS_URL` — Redis для токенов и WebSocket sync
- `CORS_ORIGINS` — разрешённые origin для frontend
- `REACT_APP_API_URL` — URL backend, который встраивается в frontend на этапе сборки

## Запуск backend и frontend вручную

Откройте два терминала в корне проекта.

**Терминал 1 — backend**

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn api.app:app --host 0.0.0.0 --port 8000
```

**Терминал 2 — frontend**

```powershell
npm start
```

Если скрипты активации PowerShell заблокированы политикой, можно запускать через `.venv\Scripts\python` напрямую.

## PDF service

Отдельный сервис для рендера PDF находится в `pdf-service/` и использует Node.js 20+ и Playwright.

Локальный запуск:

```bash
cd pdf-service
npm install
npm start
```

Сервис поднимается на порту `3001` и используется backend для генерации PDF.

## Воркер транскрибации

Воркер запускается отдельно от backend/frontend и использует собственное виртуальное окружение в `worker/.venv`.

Краткая инструкция:

```powershell
cd worker
python -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip setuptools wheel
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python tray_app.py
```

Если у вас NVIDIA GPU, можно установить PyTorch с CUDA-индексом `cu118`:

```powershell
.\.venv\Scripts\python -m pip install --index-url https://download.pytorch.org/whl/cu118 torch torchvision torchaudio
```

Полная инструкция: [docs/WORKER_RUN.md](docs/WORKER_RUN.md).

## Worker config

Файл `worker/config.json` задаёт параметры воркера:

```json
{
	"SERVER_URL": "https://mindesync.ru",
	"API_KEY": "ваш_ключ",
	"WORKER_NAME": "имя_компьютера",
	"WHISPER_MODEL": "medium",
	"DEVICE": "auto"
}
```

Что важно:

- `SERVER_URL` должен указывать на доступный API
- `API_KEY` должен совпадать с `WORKER_API_KEYS` на сервере
- `DEVICE` обычно оставляют `auto`
- на Windows при проблемах с Tkinter нужно задать `TCL_LIBRARY` и `TK_LIBRARY`

## Администрирование

Для создания первого администратора и тестовых данных есть скрипты:

```powershell
.\.venv\Scripts\python -m scripts.create_admin
.\.venv\Scripts\python -m scripts.seed_admin
```

Скрипт `create_admin` спрашивает логин, email и пароль. `seed_admin` создаёт стандартного локального администратора для первого запуска.

## Как пользоваться

1. Откройте сайт.
2. Загрузите аудиофайл в разделе транскрибации.
3. Дождитесь обработки Whisper и при необходимости примените AI-фильтр.
4. Сгенерируйте конспект, термины, вопросы или шпаргалку.
5. Сохраните результат в PDF, DOCX, TXT или Markdown.

## Архитектура сервисов

- `api/` — основное FastAPI-приложение и все роутеры
- `src/` — frontend на React
- `ml/` — локальная обработка текста и промпты
- `worker/` — отдельный воркер, который забирает задачи и шлёт heartbeat
- `pdf-service/` — серверная генерация PDF через Playwright
- `nginx/` — конфигурация reverse proxy для Docker

## Troubleshooting

### Backend не стартует

- проверьте `.env`
- убедитесь, что PostgreSQL доступен
- проверьте `DATABASE_URL`
- посмотрите вывод `uvicorn`

### Frontend не стартует

- удалите `node_modules` и переустановите зависимости
- проверьте `REACT_APP_API_URL`
- освободите порт `3000`

### Воркер не отображается как активный

- проверьте `worker/config.json`
- убедитесь, что сервер принимает ключ через `/api/worker/register`
- если задач нет, `active_workers` будет пустым
- проверьте логи воркера и доступность `SERVER_URL`

### Медленная транскрибация

- используйте модель `small` или `medium`
- поставьте PyTorch с CUDA, если есть NVIDIA GPU
- проверьте, что `torch.cuda.is_available()` возвращает `True`

### Ошибки PowerShell при активации venv

Если PowerShell блокирует `Activate.ps1`, запускайте через прямой путь к Python:

```powershell
.\.venv\Scripts\python tray_app.py
```

## Документация

- [docs/GUIDE.md](docs/GUIDE.md) — обзор продукта: что умеет, как пользоваться, как устроено в общих чертах
- [docs/DEVELOPING.md](docs/DEVELOPING.md) — гайд разработчика: как читать код, сквозные потоки, куда вносить изменения
- [docs/AI_CONTEXT.md](docs/AI_CONTEXT.md) — полная техническая карта проекта (структура кода, API, модели данных)
- [docs/BUSINESS_LOGIC.md](docs/BUSINESS_LOGIC.md) — бизнес-логика: роли, права, жизненные циклы, модерация, квоты
- [docs/WORKER_GUIDE.md](docs/WORKER_GUIDE.md) — как устроен и как подключается воркер транскрибации
- [docs/WORKER_RUN.md](docs/WORKER_RUN.md) — запуск воркера на Windows

## Кратко по запуску

Если нужен самый короткий путь:

```bash
# 1. заполнить .env
# 2. запустить полный стек
docker compose up --build -d

# или локально на Windows
setup.bat
run.bat
```

Воркер при этом запускается отдельно через `worker/tray_app.py`.
