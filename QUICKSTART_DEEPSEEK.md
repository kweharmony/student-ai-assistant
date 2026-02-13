# ⚡ Быстрый старт с DeepSeek

## 1️⃣ Установка зависимостей

```bash
pip install -r requirements.txt
```

## 2️⃣ Настройка .env

Скопируйте `.env.example` → `.env` и добавьте ваш API ключ:

```env
DEEPSEEK_API_KEY=vsellm_ваш_ключ_здесь
DEEPSEEK_BASE_URL=https://api.vsellm.ru/v1
DEEPSEEK_MODEL=deepseek/deepseek-v3.2
```

## 3️⃣ Запуск сервера

```bash
# Windows
.\start_api_medium.bat

# Linux/Mac
./start_api_medium.sh
```

## 4️⃣ Проверка

```bash
curl http://localhost:8000/api/ml/health
```

## 5️⃣ Готово! ✅

Сервер работает на `http://localhost:8000`

---

**Получить API ключ:** https://vsellm.ru
