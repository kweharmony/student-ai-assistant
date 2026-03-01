# 📚 MindeSync

Веб-платформа для автоматической обработки студенческих лекций с использованием искусственного интеллекта.

## 🎯 Основные возможности

1. **🎙️ Транскрибация аудио** - Конвертация аудиозаписей лекций в текст (Whisper AI, **локально, без интернета**)
2. **🧹 AI-фильтрация** - Очистка транскрибированного текста от ошибок распознавания
3. **📝 Создание конспектов** - Автоматическое структурирование материала (6 режимов AI)
4. **📚 Извлечение терминов** - Список ключевых понятий с определениями
5. **❓ Генерация вопросов** - Вопросы для самопроверки
6. **🧾 Создание шпаргалок** - Компактные памятки для быстрого повторения
7. **📄 Экспорт** - Сохранение в PDF, DOCX, TXT
8. **🎨 Темизация** - Темная/светлая тема

## 🛠️ Технологический стек

**Frontend:**
- React 18.2.0 + TypeScript 4.7.4
- TipTap 3.7.2 (WYSIWYG редактор)
- Tailwind CSS + Framer Motion
- React Router 6.3.0

**Backend:**
- FastAPI 0.104.1 + Uvicorn 0.24.0
- Python 3.10+
- Pydantic 2.9.0

**AI/ML:**
- DeepSeek v3.2 API через VseLLM (обработка конспектов + фильтрация)
- OpenAI Whisper (локальная транскрибация)
- FFmpeg (обработка аудио)

## 📋 Системные требования

### Обязательно:
- **Node.js** 16.0 или выше ([скачать](https://nodejs.org/))
- **Python** 3.10 или выше ([скачать](https://www.python.org/downloads/))
- **FFmpeg** ([инструкция ниже](#4-установка-ffmpeg))
- **DeepSeek API ключ** через VseLLM ([получить](https://vsellm.ru))

### Рекомендуется:
- **Git** ([скачать](https://git-scm.com/downloads))
- **8+ GB RAM** (для Whisper модели `medium`)
- **NVIDIA GPU с CUDA** (опционально, для ускорения транскрибации)

### Поддерживаемые ОС:
- ✅ Windows 10/11
- ✅ macOS 11+
- ✅ Linux (Ubuntu 20.04+, Fedora 35+)

## 🔧 Установка (пошаговая инструкция)

> **⚡ ВНИМАНИЕ для владельцев RTX GPU:**
> Если вы уже установили проект и транскрибация работает медленно - см. раздел [Быстрое исправление CUDA](#-быстрое-исправление-cuda-для-существующих-установок) ниже.

### Шаг 1: Клонирование репозитория

**Вариант А: С помощью Git (рекомендуется)**

```bash
# 1. Откройте терминал (PowerShell на Windows)
# 2. Перейдите в нужную папку, например:
cd C:\Users\ВашеИмя\Desktop

# 3. Клонируйте репозиторий
git clone https://github.com/kweharmony/student-ai-assistant.git

# 4. Перейдите в папку проекта
cd student-ai-assistant
```

**Вариант Б: Без Git**

1. Скачайте ZIP: [https://github.com/kweharmony/student-ai-assistant/archive/refs/heads/Notes_realisation.zip](https://github.com/kweharmony/student-ai-assistant/archive/refs/heads/Notes_realisation.zip)
2. Распакуйте архив
3. Откройте терминал в папке проекта

---

### Шаг 2: Установка Backend (Python)

#### 2.1. Создание виртуального окружения

**Windows (PowerShell):**

```powershell
# 1. Создать виртуальное окружение (ВАЖНО: используйте .venv, НЕ venv!)
python -m venv .venv

# 2. Разрешить выполнение скриптов (если появляется ошибка)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

# 3. Активировать окружение
.venv\Scripts\Activate.ps1

# Должно появиться: (.venv) в начале строки
```

**macOS/Linux:**

```bash
# 1. Создать виртуальное окружение
python3 -m venv .venv

# 2. Активировать окружение
source .venv/bin/activate

# Должно появиться: (.venv) в начале строки
```

#### 2.2. Установка Python зависимостей

```bash
# Убедитесь, что виртуальное окружение активировано (есть (.venv) в начале строки)

# Установить все зависимости
pip install -r requirements.txt

# Это установит:
# - FastAPI, Uvicorn (веб-сервер)
# - DeepSeek API клиент через OpenAI-compatible интерфейс (AI обработка)
# - OpenAI Whisper (транскрибация)
# - PyTorch, torchaudio (ML фреймворк)
# - ffmpeg-python (обработка аудио)
# - и другие зависимости
```

**⏱️ Время установки:** 5-10 минут (зависит от скорости интернета)

#### 2.3. Установка PyTorch с GPU (опционально, для ускорения)

**⚠️ ВАЖНО для RTX GPU:** Если у вас **NVIDIA GPU (RTX 2060, 3060, 4060 и выше)**, установка CUDA версии PyTorch **обязательна** для быстрой транскрибации! Без этого транскрибация будет в **10-15 раз медленнее**.

```bash
# Удалить CPU версию PyTorch
pip uninstall torch torchaudio

# Установить GPU версию (CUDA 11.8)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
```

**Проверка GPU:**
```bash
python -c "import torch; print('CUDA доступна:', torch.cuda.is_available())"
# Должно вывести: CUDA доступна: True

python -c "import torch; print('GPU:', torch.cuda.get_device_name(0))"
# Должно вывести: GPU: NVIDIA GeForce RTX 3060 (или ваша модель)
```

**⏱️ Сравнение скорости транскрибации:**
- **CPU only:** 30 минут аудио → ~15-20 минут обработки
- **CUDA GPU (RTX):** 30 минут аудио → ~1-2 минуты обработки ⚡

**Примечание:** Скрипт `setup_project.bat` автоматически предложит установить CUDA версию при обнаружении GPU.

---

### Шаг 3: Установка Frontend (Node.js)

```bash
# 1. Убедитесь, что вы в корневой папке проекта
# 2. Разрешить выполнение скриптов (Windows, если нужно)
Set-ExecutionPolicy Unrestricted -Scope Process

# 3. Установить зависимости
npm install

# Это установит:
# - React, TypeScript
# - TipTap (редактор)
# - Tailwind CSS
# - Framer Motion (анимации)
# - и другие зависимости
```

**⏱️ Время установки:** 2-5 минут

**Возможные ошибки:**

Если появляется ошибка `npm ERR! code ENOENT`:
```bash
# Убедитесь, что Node.js установлен
node --version  # Должно показать v16.0.0 или выше
npm --version   # Должно показать версию npm
```

---

### Шаг 4: Установка FFmpeg

FFmpeg требуется для транскрибации аудио.

#### Windows:

**Способ 1: WinGet (рекомендуется)**

```powershell
# Открыть PowerShell от имени администратора
# Установить FFmpeg
winget install ffmpeg

# Проверка установки
ffmpeg -version
```

**Способ 2: Chocolatey**

```powershell
# Если у вас установлен Chocolatey
choco install ffmpeg

# Проверка
ffmpeg -version
```

**Способ 3: Вручную**

1. Скачать: [https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip](https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip)
2. Распаковать в `C:\ffmpeg`
3. Добавить `C:\ffmpeg\bin` в PATH:
   - Поиск Windows → "переменные среды"
   - Системные переменные → PATH → Изменить
   - Добавить `C:\ffmpeg\bin`
   - Перезапустить терминал

#### macOS:

```bash
# Установить через Homebrew
brew install ffmpeg

# Проверка
ffmpeg -version
```

#### Linux (Ubuntu/Debian):

```bash
# Установить через apt
sudo apt update
sudo apt install ffmpeg

# Проверка
ffmpeg -version
```

---

### Шаг 5: Настройка переменных окружения (.env)

#### 5.1. Создание файла .env

```bash
# Создайте файл .env в корневой директории проекта
# Windows PowerShell:
New-Item -Path .env -ItemType File

# macOS/Linux:
touch .env
```

#### 5.2. Заполнение .env

Откройте файл `.env` в текстовом редакторе и добавьте:

```env
# ============================================
# DEEPSEEK API (ОБЯЗАТЕЛЬНО)
# ============================================
# Получить ключ: https://vsellm.ru
DEEPSEEK_API_KEY=vsellm_ваш_ключ_сюда

# Base URL провайдера VseLLM
DEEPSEEK_BASE_URL=https://api.vsellm.ru/v1

# Модель DeepSeek (рекомендуется v3.2)
DEEPSEEK_MODEL=deepseek/deepseek-v3.2

# ============================================
# WHISPER TRANSCRIPTION
# ============================================
# Модель Whisper (tiny/base/small/medium/large)
WHISPER_MODEL=medium

# ============================================
# ML PROCESSING SETTINGS
# ============================================
MAX_TOKENS=10000
TEMPERATURE=0.3
TOP_P=0.95

# ============================================
# APPLICATION SETTINGS
# ============================================
DEBUG=True
LOG_LEVEL=INFO

# ============================================
# FRONTEND API URL
# ============================================
REACT_APP_API_URL=http://localhost:8000
```

#### 5.3. Получение DeepSeek API ключа через VseLLM

1. Перейдите: [https://vsellm.ru](https://vsellm.ru)
2. Зарегистрируйтесь или войдите в аккаунт
3. Перейдите в раздел **"API ключи"**
4. Нажмите **"Создать новый ключ"**
5. Скопируйте ключ (начинается с `vsellm_`)
6. Вставьте в `.env` вместо `vsellm_ваш_ключ_сюда`

**Важно:** 
- DeepSeek v3.2 обеспечивает высокое качество обработки текста
- Поддержка Multi-Step Generation для длинных документов
- Проверьте баланс на платформе VseLLM

---

### Шаг 6: Загрузка модели Whisper (опционально)

Модель загрузится автоматически при первом запуске, но можно загрузить заранее:

```bash
# Активировать виртуальное окружение (если не активировано)
.venv\Scripts\Activate.ps1  # Windows
source .venv/bin/activate    # macOS/Linux

# Запустить скрипт загрузки
python .\scripts\download_model.py

# Выберите модель (рекомендуется: medium)
# Модели:
# - tiny (75 MB) - быстрая, низкое качество
# - base (150 MB) - средняя скорость, среднее качество
# - small (500 MB) - хорошее качество, медленнее
# - medium (1.5 GB) - очень хорошее качество ⭐ РЕКОМЕНДУЕТСЯ
# - large (3 GB) - максимальное качество, очень медленно
```

**⏱️ Время загрузки модели medium:** 5-10 минут (зависит от интернета)

---

### Шаг 7: Проверка установки

```bash
# 1. Проверка Python
python --version
# Должно быть: Python 3.10.0 или выше

# 2. Проверка Node.js
node --version
# Должно быть: v16.0.0 или выше

# 3. Проверка FFmpeg
ffmpeg -version
# Должна показаться версия FFmpeg

# 4. Проверка виртуального окружения
# Должно быть (.venv) в начале строки терминала

# 5. Проверка .env файла
# Откройте .env и убедитесь, что DEEPSEEK_API_KEY заполнен

# 6. Проверка CUDA (для RTX GPU)
# Windows: запустите check_cuda.bat
# Или вручную:
.venv\Scripts\Activate.ps1  # Windows
python -c "import torch; print('CUDA:', torch.cuda.is_available())"
# Должно вывести: CUDA: True (если у вас RTX GPU)
```

---

## ⚡ Быстрое исправление CUDA (для существующих установок)

**Проблема:** Транскрибация работает медленно при запуске через `run_project.bat`, хотя у вас RTX GPU.

**Причина:** Используется CPU версия PyTorch вместо GPU версии.

**Быстрое решение (2 минуты):**

```powershell
# 1. Откройте PowerShell в папке проекта
cd C:\Users\ВашеИмя\Desktop\student-ai-assistant

# 2. Активируйте виртуальное окружение
.venv\Scripts\Activate.ps1
# Если ошибка "venv not found" - используйте: venv\Scripts\Activate.ps1

# 3. Переустановите PyTorch с CUDA
pip uninstall -y torch torchaudio
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# 4. Проверьте CUDA (должно вывести True)
python -c "import torch; print('CUDA:', torch.cuda.is_available())"

# 5. Проверьте GPU (должна показаться ваша видеокарта)
python -c "import torch; print('GPU:', torch.cuda.get_device_name(0))"

# 6. Перезапустите backend
.\start_api_medium.bat
# В логах должно быть: "CUDA available: True"
```

**Результат:** Транскрибация ускорится в **10-15 раз** ⚡

Подробнее: `CUDA_SETUP.md`

---

## ▶️ Запуск проекта

### Способ 1: Быстрый запуск через скрипты (рекомендуется)

**⚠️ ВАЖНО:** Скрипты автоматически используют виртуальное окружение `.venv` и проверяют доступность CUDA перед запуском.

**Windows:**

1. **Откройте ПЕРВЫЙ терминал PowerShell** в корневой папке проекта
2. **Запустите backend:**
   ```powershell
   .\start_api_medium.bat
   ```
   - Скрипт выведет информацию о CUDA: `CUDA available: True` или `False`
   - Если CUDA недоступна, но у вас RTX GPU - см. [Шаг 2.3](#23-установка-pytorch-с-gpu-опционально-для-ускорения)
   - Должно появиться: `INFO: Uvicorn running on http://0.0.0.0:8000`
   - Backend доступен: [http://localhost:8000](http://localhost:8000)
   - **НЕ ЗАКРЫВАЙТЕ** этот терминал!

3. **Откройте ВТОРОЙ терминал PowerShell** в той же папке
4. **Запустите frontend:**
   ```powershell
   npm start
   ```
   - Откроется браузер на [http://localhost:3000](http://localhost:3000)
   - Если не открылся - откройте вручную

**macOS/Linux:**

1. **Откройте ПЕРВЫЙ терминал** в корневой папке проекта
2. **Запустите backend:**
   ```bash
   chmod +x start_api_medium.sh  # Только первый раз
   ./start_api_medium.sh
   ```

3. **Откройте ВТОРОЙ терминал**
4. **Запустите frontend:**
   ```bash
   npm start
   ```

---

### Способ 2: Ручной запуск (если скрипты не работают)

#### Терминал 1 - Backend

**Windows PowerShell:**

```powershell
# 1. Перейдите в папку проекта
cd C:\Users\ВашеИмя\Desktop\student-ai-assistant

# 2. Активируйте виртуальное окружение
.venv\Scripts\Activate.ps1

# 3. Установите модель Whisper
$env:WHISPER_MODEL="medium"

# 4. Запустите сервер
.venv\Scripts\uvicorn.exe api.app:app --reload --host 0.0.0.0 --port 8000
```

**macOS/Linux:**

```bash
# 1. Перейдите в папку проекта
cd ~/Desktop/student-ai-assistant

# 2. Активируйте виртуальное окружение
source .venv/bin/activate

# 3. Установите модель Whisper
export WHISPER_MODEL=medium

# 4. Запустите сервер
uvicorn api.app:app --reload --host 0.0.0.0 --port 8000
```

**✅ Backend запущен успешно, если видите:**

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [xxxxx] using WatchFiles
INFO:     Started server process [xxxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

#### Терминал 2 - Frontend

```bash
# В НОВОМ терминале в той же папке
npm start
```

**✅ Frontend запущен успешно, если видите:**

```
Compiled successfully!

You can now view student-ai-assistant in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```

---

### Проверка запуска

После запуска откройте в браузере:

1. **Frontend:** [http://localhost:3000](http://localhost:3000)
   - Должна загрузиться главная страница
   
2. **Backend API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
   - Должна открыться интерактивная документация Swagger

3. **Backend Health Check:** [http://localhost:8000/api/ml/health](http://localhost:8000/api/ml/health)
   - Должен вернуться JSON с `status: "healthy"`

**Если что-то не работает** - см. раздел [Troubleshooting](#-troubleshooting) ниже.

---

### Остановка проекта

**Backend (терминал 1):**
- Нажмите `Ctrl + C`

**Frontend (терминал 2):**
- Нажмите `Ctrl + C`
- Подтвердите: `Y` (yes)

---

## 📖 Использование

### 1️⃣ Транскрибация аудио → текст

**Шаг 1:** Откройте [http://localhost:3000](http://localhost:3000)

**Шаг 2:** Нажмите **"Войти"** → **"Личный кабинет"**

**Шаг 3:** В левом меню выберите **"Транскрибатор аудио в текст"** 🎙️

**Шаг 4:** Загрузите аудиофайл:
- Нажмите **"Выбрать аудиофайл"**
- Поддерживаемые форматы:
  - **Аудио:** MP3, WAV, M4A, FLAC, OGG, OPUS
  - **Видео:** MP4, MOV, AVI, MKV, WEBM
- Максимальный размер: без ограничений
- Рекомендуемая длительность: до 90 минут

**Шаг 5:** Дождитесь завершения транскрибации
- **5 минут аудио:** ~30 сек - 1 мин
- **30 минут аудио:** ~3-5 мин
- **60 минут аудио:** ~6-10 мин
- Время зависит от вашего CPU (с GPU быстрее в 10-15 раз)

**Шаг 6:** Выберите действие в модальном окне:
- **"Обработать с ИИ"** - применить AI-фильтр (исправит ошибки распознавания)
- **"Пропустить"** - использовать текст как есть

**Шаг 7:** Текст появится в редакторе
- Можете редактировать вручную
- Форматировать (жирный, курсив, списки, заголовки)
- Переходите к обработке AI или экспорту

---

### 2️⃣ AI-обработка текста

**Шаг 1:** В левом меню выберите **"Обработка текста с помощью ИИ"** ✍️

**Шаг 2:** Убедитесь, что в редакторе есть текст:
- Введите текст вручную
- Вставьте скопированный текст
- Или используйте текст после транскрибации

**Шаг 3:** Выберите режим обработки:

| Режим | Описание | Время обработки |
|-------|----------|-----------------|
| 📝 **Краткий конспект** | Структурированный конспект (~30% текста) | ~30-40с |
| 📚 **Извлечение терминов** | Список терминов с определениями | ~30-40с |
| 🔍 **Расширенный конспект** | Детальный разбор всех терминов | ~60-90с |
| ❓ **Генерация вопросов** | Вопросы для самопроверки | ~20-30с |
| 🧾 **Шпаргалка** | Компактная памятка | ~20-30с |
| 📖 **Расширение темы** | Подробное объяснение конкретной темы | ~40-50с |

**Шаг 4:** Нажмите **"Обработать с помощью ИИ"**
- Дождитесь завершения (см. время в таблице выше)
- Появится спиннер загрузки

**Шаг 5:** Результат появится справа (в режиме "Split"):
- **Слева** - исходный текст
- **Справа** - обработанный AI текст

**Шаг 6:** Вставьте результат в редактор:
- Нажмите **"Вставить в редактор"**
- Или скопируйте текст вручную

---

### 3️⃣ Экспорт документа

**Шаг 1:** Убедитесь, что в редакторе есть текст

**Шаг 2:** Нажмите кнопку экспорта:
- **📄 PDF** - для печати, отправки
- **📘 DOCX** - для редактирования в Word
- **📝 TXT** - простой текст
- **📋 Markdown** - для GitHub, Obsidian

**Шаг 3:** Файл автоматически скачается в папку "Загрузки"

**Имя файла по умолчанию:**
- PDF: `конспект_ГГГГ-ММ-ДД_ЧЧ-ММ.pdf`
- DOCX: `конспект_ГГГГ-ММ-ДД_ЧЧ-ММ.docx`
- TXT: `конспект_ГГГГ-ММ-ДД_ЧЧ-ММ.txt`
- Markdown: `конспект_ГГГГ-ММ-ДД_ЧЧ-ММ.md`

---

### 4️⃣ Полный workflow (от аудио до готового конспекта)

```
1. Загрузить аудио лекции
        ↓
2. Транскрибация (Whisper AI)
        ↓
3. [Опционально] AI-фильтрация текста
        ↓
4. Текст в редакторе
        ↓
5. Выбрать режим: "Краткий конспект"
        ↓
6. Обработка AI (DeepSeek v3.2)
        ↓
7. Вставить результат в редактор
        ↓
8. [Опционально] Ручное редактирование
        ↓
9. Экспорт в PDF/DOCX
        ↓
10. ✅ Готовый конспект!
```

**⏱️ Общее время:**
- 30 минут аудио → готовый конспект: **~6-8 минут**
- 60 минут аудио → готовый конспект: **~12-15 минут**

---

### 5️⃣ Смена темы (светлая/темная)

**Способ 1:** Кнопка в шапке сайта
- Нажмите иконку 🌙/☀️ в правом верхнем углу

**Способ 2:** Настройки браузера
- Тема сохраняется в localStorage
- Автоматически применяется при следующем открытии

---

## 🐛 Troubleshooting

### Backend не запускается

**Ошибка: `ModuleNotFoundError: No module named 'fastapi'`**

```bash
# Решение: переустановите зависимости
pip install -r requirements.txt
```

**Ошибка: `DEEPSEEK_API_KEY не найден в .env`**

```bash
# Решение: проверьте файл .env
# 1. Убедитесь, что файл существует
# 2. Убедитесь, что DEEPSEEK_API_KEY заполнен
# 3. Нет лишних пробелов: DEEPSEEK_API_KEY=vsellm_ваш_ключ (БЕЗ пробелов вокруг =)
# 4. Ключ должен начинаться с vsellm_
```

**Ошибка: `FFmpeg not found`**

```bash
# Решение: установите FFmpeg
# Windows:
winget install ffmpeg

# macOS:
brew install ffmpeg

# Linux:
sudo apt install ffmpeg

# Перезапустите терминал после установки
```

**Ошибка: `uvicorn: command not found`**

```bash
# Решение: активируйте виртуальное окружение
# Windows:
.venv\Scripts\Activate.ps1

# macOS/Linux:
source .venv/bin/activate

# Проверка: должно появиться (.venv) в начале строки
```

**Ошибка: `Port 8000 already in use`**

```bash
# Решение: убейте процесс на порту 8000
# Windows PowerShell:
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process

# Или используйте другой порт:
uvicorn api.app:app --reload --port 8001
```

---

### Frontend не запускается

**Ошибка: `npm ERR! code ENOENT`**

```bash
# Решение: переустановите зависимости
rm -rf node_modules package-lock.json  # macOS/Linux
Remove-Item -Recurse -Force node_modules, package-lock.json  # Windows

npm install
```

**Ошибка: `Port 3000 already in use`**

```bash
# Решение 1: убейте процесс
# Windows PowerShell:
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process

# Решение 2: используйте другой порт
# В package.json добавьте:
"scripts": {
  "start": "PORT=3001 react-scripts start"
}
```

**Ошибка: `Module not found: Can't resolve 'framer-motion'`**

```bash
# Решение: установите недостающий пакет
npm install framer-motion
```

---

### PowerShell ошибки выполнения скриптов

**Ошибка: `cannot be loaded because running scripts is disabled on this system`**

```powershell
# Решение: разрешите выполнение скриптов
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

# Или только для текущей сессии:
Set-ExecutionPolicy RemoteSigned -Scope Process
```

---

### Проблемы с транскрибацией

**Транскрибация очень медленная (САМАЯ ЧАСТАЯ ПРОБЛЕМА)**

```
Причина: Используется CPU вместо GPU
Симптомы: 
  - 5 минут аудио обрабатывается 5-10 минут (вместо 30 секунд)
  - В start_api_medium.bat показывает "CUDA available: False"
  - У вас есть RTX GPU, но она не используется

Решение:
1. Проверьте CUDA в вашем виртуальном окружении:
   .venv\Scripts\Activate.ps1  # Windows
   python -c "import torch; print('CUDA:', torch.cuda.is_available())"

2. Если вывод "False", переустановите PyTorch с CUDA:
   pip uninstall torch torchaudio
   pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

3. Проверьте снова:
   python -c "import torch; print('CUDA:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0))"
   # Должно вывести: CUDA: True, GPU: NVIDIA GeForce RTX xxxx

4. Перезапустите backend (Ctrl+C → .\start_api_medium.bat)

КРИТИЧНО: Убедитесь, что вы устанавливаете PyTorch в ТО ЖЕ виртуальное окружение (.venv),
которое используют скрипты! Если у вас несколько venv/venv/.venv - удалите лишние.
```

**Ошибка: `moov atom not found`**

```
Причина: Файл загрузился не полностью или поврежден
Решение: 
1. Попробуйте загрузить файл заново
2. Конвертируйте файл в MP3 через online-convert.com
3. Используйте другой аудиофайл для теста
```

**Транскрибация всё ещё медленная (с CUDA)**

```
Причина: Используется слишком большая модель или слабая GPU
Решение:
1. Используйте меньшую модель: WHISPER_MODEL=small в .env
2. Разбейте длинное аудио на части (до 30 минут)
3. Закройте другие программы, использующие GPU
```

**Текст распознался с ошибками**

```
Решение:
1. Используйте AI-фильтрацию (кнопка "Обработать с ИИ" после транскрибации)
2. Используйте большую модель: WHISPER_MODEL=large в .env
3. Улучшите качество аудио:
   - Используйте микрофон вместо встроенного
   - Записывайте в тихом месте
   - Конвертируйте в WAV формат
```

---

### Проблемы с AI обработкой

**Ошибка: `Resource exhausted` или `Rate limit exceeded`**

```
Причина: Превышен лимит запросов или токенов
Решение: 
1. Проверьте баланс на платформе VseLLM
2. Подождите несколько минут и повторите запрос
3. Система автоматически повторит запрос (до 3 попыток)
```

**Ошибка: `503 Service Unavailable`**

```
Причина: Сервер VseLLM временно недоступен
Решение:
1. Система автоматически повторит запрос (3 попытки с задержкой)
2. Если не помогло - попробуйте через 5-10 минут
3. Проверьте статус сервиса на https://vsellm.ru
```

**Ошибка: `Invalid API key`**

```
Причина: Неверный или истекший API ключ
Решение:
1. Проверьте, что ключ в .env начинается с vsellm_
2. Создайте новый ключ на https://vsellm.ru
3. Убедитесь, что нет лишних пробелов или символов
4. Перезапустите backend после изменения .env
```

**Обработка обрывается на середине**

```
Причина: Превышен лимит max_output_tokens
Решение: Уже исправлено в последней версии (max_tokens=8192)
Если проблема повторяется:
1. Уменьшите размер входного текста
2. Используйте режим "Шпаргалка" вместо "Расширенный конспект"
```

---

### Общие проблемы

**Страница не загружается / белый экран**

```bash
# Решение:
# 1. Проверьте, что backend запущен (http://localhost:8000/docs)
# 2. Проверьте консоль браузера (F12 → Console)
# 3. Очистите кэш браузера (Ctrl+Shift+Delete)
# 4. Проверьте CORS настройки в api/app.py
```

**API запросы возвращают 404**

```bash
# Решение: проверьте URL в .env
REACT_APP_API_URL=http://localhost:8000  # БЕЗ слэша в конце!
```

**Изменения в .env не применяются**

```bash
# Решение: перезапустите backend
# 1. В терминале backend: Ctrl+C
# 2. Запустите заново: start_api_medium.bat (или вручную)
# 3. Подождите ~5 секунд
```

---

### Проверка логов

**Backend логи:**

```bash
# В терминале с uvicorn видны все запросы
# Формат: [время] [уровень] [модуль]: сообщение

# Пример успешного запроса:
INFO: ML API запрос: POST http://localhost:8000/api/ml/process
INFO: ML API ответ: 200, время: 34.49с

# Пример ошибки:
ERROR: Ошибка обработки текста: Контент заблокирован (finish_reason=2)
```

**Frontend логи:**

```bash
# Откройте консоль браузера (F12)
# Вкладка Console покажет ошибки JavaScript
# Вкладка Network покажет HTTP запросы
```

---

### Нужна дополнительная помощь?

- 📚 **Полная документация:** `PROJECT_DOCUMENTATION.md`
- 🎙️ **Транскрибация:** `WHISPER_INSTALL.md`
- 🤖 **ML модуль:** `ML_documentation.md`
- 🚀 **Быстрый старт:** `QUICK_START_TRANSCRIPTION.md`
- ⚙️ **Настройка ML:** `ML_SETUP_GUIDE.md`
- ⚡ **Настройка CUDA/GPU:** `CUDA_SETUP.md` ⭐ **ВАЖНО для RTX GPU**

---
