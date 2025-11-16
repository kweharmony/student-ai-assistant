# Student AI Assistant

Веб-приложение для работы с конспектами лекций с интеграцией искусственного интеллекта.

## 🚀 Возможности

- **Транскрибация аудио в текст** (Whisper AI - локально, без интернета)
- WYSIWYG редактор текста
- AI обработка текста (6 режимов через Google Gemini API)
- Экспорт в PDF, DOCX, TXT
- Темная/светлая тема

## 🛠️ Технологии

**Frontend:** React 18, TypeScript, TipTap, Tailwind CSS  
**Backend:** FastAPI, Python 3.10+  
**AI/ML:** OpenAI Whisper (локально), Google Gemini API, Nexara API

## 📋 Требования

- Node.js 14+
- Python 3.10+
- FFmpeg (для транскрибации аудио)
- Google Gemini API ключ (бесплатно)
- Nexara API ключ (опционально)

## 🔧 Установка

### 1. Клонирование и настройка

```bash
git clone https://github.com/kweharmony/student-ai-assistant.git
cd student-ai-assistant
```

### 2. Backend (Python)

```bash
# Создать виртуальное окружение
python -m venv .venv

# Активировать (Windows PowerShell)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
.venv\Scripts\Activate.ps1

# Установить зависимости
pip install -r requirements.txt
```

### 3. Frontend (React)

```bash
Set-ExecutionPolicy Unrestricted -Scope Process

npm install
```

### 4. Переменные окружения

Создайте файл `.env` в корневой директории:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash-exp
NEXARA_API_KEY=your_key_here
REACT_APP_API_URL=http://localhost:8000
```

**Получить ключи:**

- Google Gemini: https://aistudio.google.com/apikey (бесплатно)
- Nexara: https://nexara.ai/

## ▶️ Запуск

Откройте **два терминала** в корневой директории:

### Терминал 1 - Backend (с моделью Whisper Medium)

**Windows:**

```bash
./start_api_medium.bat
```

**macOS/Linux:**

```bash
./start_api_medium.sh
```

Или вручную:

```bash
# Windows
set WHISPER_MODEL=medium
.venv\Scripts\uvicorn.exe api.app:app --reload --host 0.0.0.0 --port 8000

# Linux/Mac
export WHISPER_MODEL=medium
uvicorn api.app:app --reload --host 0.0.0.0 --port 8000
```

Backend: http://127.0.0.1:8000

### Терминал 2 - Frontend

```bash
npm start
```

Frontend: http://localhost:3000

## 📖 Использование

### Транскрибация аудио (новая функция!)

1. Откройте http://localhost:3000
2. Войти → Личный кабинет
3. Перейдите в раздел **"Транскрибатор аудио в текст"**
4. Загрузите аудиофайл (mp3, wav, m4a и др.)
5. Дождитесь завершения транскрибации
6. Текст автоматически появится в редакторе

### AI обработка текста

1. В разделе **"Обработка текста с помощью ИИ"**
2. Введите или вставьте текст в редактор
3. Выберите режим AI обработки (конспект, термины, вопросы и др.)
4. Нажмите "Обработать с помощью ИИ"
5. Вставьте результат в редактор
6. Экспортируйте в PDF, DOCX или TXT

💡 **Совет:** Можно сначала транскрибировать аудио лекции, а затем обработать текст с помощью AI!

## 📚 Дополнительная документация

- **🚀 Быстрый старт транскрибации** (5 минут): `QUICK_START_TRANSCRIPTION.md`
- **Установка Whisper для транскрибации**: `WHISPER_INSTALL.md` ⭐ **ВАЖНО**
- **Полная техническая документация**: `student-ai-docs.md`
- **ML модуль и Google Gemini**: `ML_documentation.md`
- **Настройка ML**: `ML_SETUP_GUIDE.md`

## � Troubleshooting

**Backend ошибки:**

```bash
pip install -r requirements.txt
```

**PowerShell политика:**

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Проверка API:** http://127.0.0.1:8000/docs
