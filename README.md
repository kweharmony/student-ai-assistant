# MindeSync

Веб-платформа для автоматической обработки студенческих лекций с помощью искусственного интеллекта.

## Возможности

- **Транскрибация аудио** — конвертация аудиозаписей лекций в текст (Whisper AI, локально, без интернета)
- **AI-фильтрация** — очистка транскрибированного текста от ошибок распознавания
- **Создание конспектов** — автоматическое структурирование материала (6 режимов AI)
- **Извлечение терминов** — список ключевых понятий с определениями
- **Генерация вопросов** — вопросы для самопроверки
- **Шпаргалки** — компактные памятки для быстрого повторения
- **Экспорт** — сохранение в PDF, DOCX, TXT, Markdown
- **Темизация** — тёмная/светлая тема

## Технологический стек

**Frontend:** React 18 + TypeScript, TipTap (WYSIWYG-редактор), Tailwind CSS, Framer Motion

**Backend:** FastAPI + Uvicorn, Python 3.12, Pydantic

**AI/ML:** DeepSeek v3.2 API через VseLLM, OpenAI Whisper (локальная транскрибация), FFmpeg

## Системные требования

- **Python 3.12** ([скачать](https://www.python.org/downloads/))
- **DeepSeek API ключ** через VseLLM ([получить](https://vsellm.ru))
- **8+ ГБ RAM** (для модели Whisper `small`/`medium`)
- **NVIDIA GPU с CUDA** (опционально, ускоряет транскрибацию в 10-15 раз)

Node.js, FFmpeg и модели Whisper скачиваются автоматически скриптом установки.

### Поддерживаемые ОС

- Windows 10/11
- macOS 11+
- Linux (Ubuntu 20.04+, Fedora 35+)

---

## Быстрый старт (автоматическая установка)

### 1. Клонирование репозитория

```bash
git clone https://github.com/kweharmony/student-ai-assistant.git
cd student-ai-assistant
```

Или скачайте ZIP и распакуйте.

### 2. Настройка .env

Скопируйте пример и впишите свой API ключ:

```bash
cp .env.example .env
```

Откройте `.env` и заполните:

```env
DEEPSEEK_API_KEY=vsellm_ваш_ключ_сюда
DEEPSEEK_BASE_URL=https://api.vsellm.ru/v1
DEEPSEEK_MODEL=deepseek/deepseek-v3.2
WHISPER_MODEL=medium
REACT_APP_API_URL=http://localhost:8000
```

Получить API ключ: [vsellm.ru](https://vsellm.ru)

### 3. Запуск установки

> **Для скачивания некоторых библиотек (PyTorch, Whisper) может потребоваться VPN.**

**Windows** — двойной клик по `setup.bat`

**Linux / macOS:**

```bash
chmod +x setup.sh
./setup.sh
```

Скрипт установки:
- Создаст виртуальное окружение Python 3.12 (`.venv/`)
- Установит все Python-зависимости в `.venv/`
- Предложит установить PyTorch с CUDA (для NVIDIA GPU)
- Скачает FFmpeg в `tools/ffmpeg/`
- Скачает Node.js в `tools/node/`
- Установит npm-зависимости в `node_modules/`
- Предложит выбрать модель Whisper:

| # | Модель | Размер   | 30 мин аудио | Качество                  |
|---|--------|----------|--------------|---------------------------|
| 1 | tiny   | ~75 МБ   | ~10 мин      | Низкое                    |
| 2 | base   | ~150 МБ  | ~7 мин       | Нормальное                |
| 3 | small  | ~500 МБ  | ~5 мин       | Хорошее                   |
| 4 | medium | ~1.5 ГБ  | ~3 мин       | Отличное (по умолчанию)   |
| 5 | large  | ~3 ГБ    | ~2 мин       | Лучшее                    |

Время указано для CPU. С CUDA GPU в 10-15 раз быстрее.

**Всё устанавливается локально** — ничего не ставится в систему, только в папку проекта.

### 4. Запуск проекта

**Windows** — двойной клик по `run.bat`

**Linux / macOS:**

```bash
chmod +x run.sh
./run.sh
```

Запустятся два сервера:

| Сервис      | URL                          |
|-------------|------------------------------|
| API         | http://localhost:8000        |
| Frontend    | http://localhost:3000        |
| Документация API | http://localhost:8000/docs   |

---

## Ручная установка (если скрипты не подходят)

Если `setup.bat` / `setup.sh` не работает или вы хотите контролировать каждый шаг.

### 1. Создание виртуального окружения

```bash
# Windows (PowerShell):
python -m venv .venv
.venv\Scripts\Activate.ps1

# Linux / macOS:
python3.12 -m venv .venv
source .venv/bin/activate
```

Должно появиться `(.venv)` в начале строки терминала.

### 2. Установка Python-зависимостей

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Установка PyTorch с CUDA (опционально, для NVIDIA GPU)

```bash
pip uninstall -y torch torchaudio
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
```

Проверка:

```bash
python -c "import torch; print('CUDA:', torch.cuda.is_available())"
# Должно вывести: CUDA: True
```

### 4. Установка FFmpeg

**Windows:**

```powershell
winget install ffmpeg
```

**macOS:**

```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**

```bash
sudo apt update && sudo apt install ffmpeg
```

Проверка: `ffmpeg -version`

### 5. Установка Node.js

Скачайте с [nodejs.org](https://nodejs.org/) (версия 18+) или:

**Windows:**

```powershell
winget install OpenJS.NodeJS.LTS
```

**macOS:**

```bash
brew install node
```

**Linux:**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Проверка: `node --version` (должно быть 18+)

### 6. Установка npm-зависимостей

```bash
npm install --legacy-peer-deps
```

### 7. Скачивание модели Whisper

```bash
# Активируйте venv если не активировано
python scripts/download_model.py medium
```

Модели: `tiny`, `base`, `small`, `medium` (рекомендуется), `large`

### 8. Настройка .env

```bash
cp .env.example .env
```

Заполните `DEEPSEEK_API_KEY` вашим ключом от [vsellm.ru](https://vsellm.ru).

### 9. Ручной запуск

Откройте **два терминала** в папке проекта.

**Терминал 1 — Backend:**

```bash
# Windows:
.venv\Scripts\Activate.ps1
uvicorn api.app:app --host 0.0.0.0 --port 8000

# Linux / macOS:
source .venv/bin/activate
uvicorn api.app:app --host 0.0.0.0 --port 8000
```

**Терминал 2 — Frontend:**

```bash
npm start
```

---

## Использование

### Транскрибация аудио в текст

1. Откройте http://localhost:3000
2. Перейдите в **"Транскрибатор аудио в текст"**
3. Загрузите аудиофайл (MP3, WAV, M4A, FLAC, OGG, MP4, MKV...)
4. Дождитесь завершения транскрибации
5. По желанию примените AI-фильтр для очистки текста

### AI-обработка текста

Выберите режим обработки:

| Режим                 | Описание                             | Время   |
|-----------------------|--------------------------------------|---------|
| Краткий конспект      | Структурированное резюме (~30%)      | ~30-40с |
| Извлечение терминов   | Ключевые термины с определениями     | ~30-40с |
| Расширенный конспект  | Подробный разбор всех терминов       | ~60-90с |
| Генерация вопросов    | Вопросы для самопроверки             | ~20-30с |
| Шпаргалка             | Компактная памятка                   | ~20-30с |
| Расширение темы       | Подробное объяснение конкретной темы | ~40-50с |

### Экспорт

Сохранение в PDF, DOCX, TXT или Markdown.

---

## Настройка CUDA / GPU

Если у вас **NVIDIA GPU** и транскрибация медленная:

```bash
# Активируйте venv
# Windows:
.venv\Scripts\Activate.ps1
# Linux/macOS:
source .venv/bin/activate

# Переустановите PyTorch с CUDA
pip uninstall -y torch torchaudio
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# Проверка
python -c "import torch; print('CUDA:', torch.cuda.is_available())"
```

Скрипт установки предлагает это автоматически. Если пропустили — выполните команды выше.

---

## Решение проблем

### Backend не запускается

| Ошибка | Решение |
|---|---|
| `ModuleNotFoundError` | Запустите `setup.bat` / `setup.sh` заново |
| `DEEPSEEK_API_KEY не найден` | Проверьте файл `.env`, без пробелов вокруг `=` |
| `FFmpeg not found` | Запустите setup заново или установите вручную |
| `Port 8000 already in use` | Завершите процесс на порту 8000 |

### Frontend не запускается

| Ошибка | Решение |
|---|---|
| `npm ERR! code ENOENT` | Удалите `node_modules`, запустите setup заново |
| `Port 3000 already in use` | Завершите процесс на порту 3000 |

### Проблемы с транскрибацией

| Проблема | Решение |
|---|---|
| Очень медленно (есть NVIDIA GPU) | Установите CUDA PyTorch (см. выше) |
| Плохое качество распознавания | Используйте модель побольше или AI-фильтр |
| `moov atom not found` | Перезагрузите файл или конвертируйте в MP3 |

### Ошибки PowerShell

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Структура проекта

```
student-ai-assistant/
├── api/                 # FastAPI backend
├── src/                 # React frontend
├── ml/                  # ML модуль (Whisper, обработка)
├── scripts/             # Вспомогательные скрипты
├── setup.bat / setup.sh # Установка (ставит всё автоматически)
├── run.bat / run.sh     # Запуск (поднимает оба сервера)
├── .venv/               # Виртуальное окружение Python (создаётся setup)
├── tools/               # FFmpeg, Node.js (скачивается setup)
├── whisper_models/      # Модели Whisper (скачивается setup)
├── requirements.txt     # Python-зависимости
├── package.json         # npm-зависимости
└── .env                 # Конфигурация (создать из .env.example)
```
