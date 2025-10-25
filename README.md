# Student AI Assistant

Веб-приложение для работы с конспектами лекций с интеграцией искусственного интеллекта.

## 🚀 Возможности

- Транскрибация аудио в текст
- WYSIWYG редактор текста
- AI обработка текста (6 режимов через DeepSeek API)
- Экспорт в PDF, DOCX, TXT
- Темная/светлая тема

## �️ Технологии

**Frontend:** React 18, TypeScript, TipTap, Tailwind CSS  
**Backend:** FastAPI, Python 3.10+  
**AI/ML:** DeepSeek API, Nexara API

## 📋 Требования

- Node.js 14+
- Python 3.10+
- DeepSeek API ключ
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
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_MODEL=deepseek-chat
NEXARA_API_KEY=your_key_here
REACT_APP_API_URL=http://localhost:8000
```

**Получить ключи:**

- DeepSeek: https://platform.deepseek.com/
- Nexara: https://nexara.ai/

## ▶️ Запуск

Откройте **два терминала** в корневой директории:

### Терминал 1 - Backend

```bash
.venv\Scripts\uvicorn.exe api.app:app --reload --host 127.0.0.1 --port 8000
```

Backend: http://127.0.0.1:8000

### Терминал 2 - Frontend

```bash
npm start
```

Frontend: http://localhost:3000

## Использование

1. Откройте http://localhost:3000
2. Войти → Личный кабинет
3. Введите текст или загрузите аудио
4. Выберите режим AI обработки
5. Нажмите "Обработать с помощью ИИ"
6. Вставьте результат в редактор
7. Экспортируйте в нужный формат

## � Дополнительная документация

- **Полная техническая документация**: `student-ai-docs.md`
- **ML модуль и DeepSeek**: `ML_documentation.md`
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
