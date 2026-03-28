# Транскрибация: Система распределённой обработки

## Общая идея

Транскрибация аудио в текст выполняется **не на сервере**, а на **компьютерах разработчиков** (воркерах). Сервер не имеет GPU и выступает только хранилищем аудио и результатов.

### Схема работы

```
Пользователь загружает аудио
        │
        ▼
┌─────────────────────┐
│   Сервер (FastAPI)   │
│                     │
│  /api/transcribe/   │
│     upload          │──► Сохраняет файл в /data/audio_queue/YYYY/MM/
│                     │
│  База данных (PG)   │◄── Воркер записывает результат
│                     │
│  /api/admin/queue   │──► Список файлов в очереди (для мониторинга)
└─────────────────────┘
        ▲
        │ API (через VPN / интернет)
        ▼
┌─────────────────────┐
│  Воркер (ПК разраб) │
│                     │
│  GPU / CPU          │
│  OpenAI Whisper     │
│                     │
│  1. Забирает файл   │
│  2. Транскрибирует  │
│  3. Отправляет текст│
└─────────────────────┘
```

---

## Текущее состояние

### Что уже реализовано

1. **Загрузка аудио** — `POST /api/transcribe/upload`
   - Принимает файлы: mp3, wav, m4a, flac, ogg, opus, mp4, mov, avi, mkv, webm
   - Максимум: 100 МБ
   - Сохраняет в `/data/audio_queue/YYYY/MM/{uuid}-{filename}`
   - Возвращает `file_id` и `filename`

2. **Просмотр очереди** — `GET /api/admin/queue` (только админы)
   - Список всех файлов в очереди
   - Размер, дата загрузки, путь

3. **Статистика** — `GET /api/admin/stats`
   - Количество файлов в очереди и их общий размер

4. **Модели БД** готовы:
   - `AudioFile` — запись о аудиофайле (привязан к лекции)
   - `Transcription` — результат транскрибации (raw_text, processed_text, whisper_model, language, confidence, processing_time)

5. **Whisper установлен** в Docker-образе бэкенда (openai-whisper в requirements.txt), но пока не используется

### Что нужно реализовать

Систему "воркер ↔ сервер" для обработки очереди.

---

## Что нужно сделать

### 1. Новые API-эндпоинты на сервере

Добавить в `api/routers/` новый роутер (например `worker.py`) с эндпоинтами:

```
POST   /api/worker/auth          — Авторизация воркера (API-ключ или JWT)
GET    /api/worker/next           — Получить следующий файл из очереди
GET    /api/worker/download/{id}  — Скачать аудиофайл
POST   /api/worker/result/{id}    — Отправить результат транскрибации
POST   /api/worker/error/{id}     — Сообщить об ошибке обработки
GET    /api/worker/status          — Статус очереди
```

#### Логика `GET /api/worker/next`

```python
# Псевдокод
1. Найти в очереди файл со статусом "pending"
2. Поменять статус на "processing" + записать worker_id и timestamp
3. Вернуть метаданные файла (id, filename, size, download_url)
4. Если очередь пуста — вернуть 204 No Content
```

#### Логика `POST /api/worker/result/{id}`

```python
# Принимает JSON:
{
    "raw_text": "Распознанный текст...",
    "language": "ru",
    "whisper_model": "large-v3",
    "confidence": 0.95,
    "processing_time": 123.4   # секунд
}

# Действия:
1. Создать запись в таблице Transcription
2. Обновить статус AudioFile
3. Удалить файл из audio_queue (или переместить в processed/)
4. Обновить статус лекции на "ready"
```

### 2. Новые поля в БД (миграция)

Добавить в таблицу `audio_files` или создать новую таблицу `transcription_queue`:

```python
class TranscriptionTask(Base):
    __tablename__ = "transcription_tasks"

    id = Column(UUID, primary_key=True, default=uuid4)
    audio_file_id = Column(UUID, ForeignKey("audio_files.id"))

    # Статус обработки
    status = Column(String(20), default="pending")
    # pending → processing → completed → error

    # Какой воркер взял задачу
    worker_id = Column(String(100), nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # В случае ошибки
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)

    created_at = Column(DateTime, default=utcnow)
```

Возможные статусы:
| Статус | Описание |
|---|---|
| `pending` | Ожидает обработки |
| `processing` | Воркер забрал и обрабатывает |
| `completed` | Транскрибация завершена |
| `error` | Ошибка (будет повторная попытка) |
| `failed` | Все попытки исчерпаны |

### 3. Скрипт воркера (отдельный проект или скрипт)

Создать `worker/` директорию или отдельный репозиторий:

```
worker/
├── worker.py          # Основной скрипт
├── config.py          # Настройки (URL сервера, API ключ, модель Whisper)
├── transcriber.py     # Обёртка над Whisper
├── requirements.txt   # whisper, requests
└── README.md
```

#### Пример `worker.py`:

```python
import time
import whisper
import requests

SERVER_URL = "https://mindesync.ru/api/worker"
API_KEY = "worker-secret-key"
MODEL = "large-v3"  # или "medium", "small" — зависит от GPU

headers = {"Authorization": f"Bearer {API_KEY}"}
model = whisper.load_model(MODEL)

while True:
    # 1. Запросить задачу
    resp = requests.get(f"{SERVER_URL}/next", headers=headers)

    if resp.status_code == 204:
        print("Очередь пуста, ждём 30 сек...")
        time.sleep(30)
        continue

    task = resp.json()
    task_id = task["id"]
    print(f"Получена задача: {task['filename']}")

    # 2. Скачать аудио
    audio = requests.get(f"{SERVER_URL}/download/{task_id}", headers=headers)
    audio_path = f"/tmp/{task['filename']}"
    with open(audio_path, "wb") as f:
        f.write(audio.content)

    # 3. Транскрибировать
    try:
        start = time.time()
        result = model.transcribe(audio_path, language="ru")
        elapsed = time.time() - start

        # 4. Отправить результат
        requests.post(f"{SERVER_URL}/result/{task_id}",
            headers=headers,
            json={
                "raw_text": result["text"],
                "language": result.get("language", "ru"),
                "whisper_model": MODEL,
                "confidence": 0.0,  # Whisper не даёт общий confidence
                "processing_time": round(elapsed, 1)
            }
        )
        print(f"Готово за {elapsed:.1f}с")

    except Exception as e:
        requests.post(f"{SERVER_URL}/error/{task_id}",
            headers=headers,
            json={"error": str(e)}
        )
        print(f"Ошибка: {e}")

    # Удалить временный файл
    os.remove(audio_path)
```

### 4. Аутентификация воркеров

Варианты:

**Вариант A — API-ключ (проще):**
- В `.env` сервера добавить `WORKER_API_KEYS=key1,key2,key3`
- Воркер передаёт ключ в заголовке `Authorization: Bearer <key>`
- На сервере middleware проверяет ключ

**Вариант B — JWT (как у пользователей):**
- Создать специальную роль `worker` в UserRole
- Воркер логинится и получает JWT
- Плюс: можно отслеживать кто какие задачи выполнил

Рекомендация: **Вариант A** для начала — проще реализовать.

### 5. Обновить загрузку аудио

Сейчас `POST /api/transcribe/upload` просто сохраняет файл на диск. Нужно:

1. Привязать файл к лекции (создать Lecture + AudioFile записи в БД)
2. Создать TranscriptionTask со статусом "pending"
3. Сохранить файл на диск

```python
@router.post("/upload")
async def upload_audio(
    audio: UploadFile,
    lecture_title: str = Form(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Создать лекцию
    lecture = Lecture(title=lecture_title, uploaded_by=user.id)
    db.add(lecture)
    await db.flush()

    # Сохранить файл
    file_path = save_audio_file(audio)

    # Создать запись AudioFile
    audio_record = AudioFile(
        lecture_id=lecture.id,
        file_path=str(file_path),
        file_name=audio.filename,
        file_size=file_size,
    )
    db.add(audio_record)
    await db.flush()

    # Создать задачу на транскрибацию
    task = TranscriptionTask(audio_file_id=audio_record.id)
    db.add(task)

    await db.commit()
```

### 6. Обновить фронтенд

- Показывать статус транскрибации в реальном времени (polling или WebSocket)
- Статусы: "В очереди" → "Обрабатывается" → "Готово" / "Ошибка"
- После завершения — показать текст

---

## Дополнительно

### Таймауты и зависшие задачи

Воркер может упасть во время обработки. Нужен механизм:

```python
# Cron-задача на сервере (или отдельный скрипт), каждые 5 мин:
# Если задача в статусе "processing" более 30 мин — вернуть в "pending"

UPDATE transcription_tasks
SET status = 'pending', worker_id = NULL, started_at = NULL, retry_count = retry_count + 1
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '30 minutes'
  AND retry_count < max_retries;
```

### Приоритеты

Можно добавить поле `priority` в TranscriptionTask:
- 1 = высокий (преподаватель)
- 2 = нормальный (студент)

### Масштабирование

- Несколько воркеров могут работать параллельно
- `GET /api/worker/next` должен использовать `SELECT ... FOR UPDATE SKIP LOCKED` чтобы два воркера не взяли одну задачу
- Каждый воркер идентифицируется по `worker_id` (hostname или UUID)

### Мониторинг

Добавить в админ-панель:
- Список активных воркеров (последний heartbeat)
- Статистика: сколько задач обработано, среднее время, ошибки
- График очереди (растёт / убывает)

---

## Требования к ПК воркера

| Параметр | Минимум | Рекомендация |
|---|---|---|
| GPU | Нет (CPU работает, но медленно) | NVIDIA с 6+ GB VRAM |
| RAM | 8 GB | 16 GB |
| Модель Whisper (CPU) | `small` (~2 GB RAM) | `medium` (~5 GB RAM) |
| Модель Whisper (GPU) | `medium` (~5 GB VRAM) | `large-v3` (~10 GB VRAM) |
| Python | 3.10+ | 3.12 |
| Интернет | Стабильный | Для скачивания/загрузки аудио |

### Скорость транскрибации (приблизительно)

| Модель | GPU (RTX 3060) | CPU (i7-12700) |
|---|---|---|
| `small` | ~10x realtime | ~1x realtime |
| `medium` | ~5x realtime | ~0.3x realtime |
| `large-v3` | ~2x realtime | ~0.1x realtime |

*"10x realtime" = 10 минут аудио за 1 минуту обработки*

---

## Порядок реализации

1. Создать миграцию с таблицей `transcription_tasks`
2. Обновить `POST /api/transcribe/upload` — создавать задачу в БД
3. Создать роутер `api/routers/worker.py` с эндпоинтами для воркеров
4. Добавить аутентификацию воркеров (API-ключи)
5. Написать скрипт воркера (`worker/worker.py`)
6. Добавить обработку таймаутов (зависшие задачи)
7. Обновить фронтенд — показ статуса транскрибации
8. Обновить админ-панель — мониторинг воркеров
9. Тестирование с реальным аудио

---

## Полезные ссылки

- [OpenAI Whisper](https://github.com/openai/whisper) — модель транскрибации
- [Faster Whisper](https://github.com/SYSTRAN/faster-whisper) — оптимизированная версия (в 4x быстрее, меньше VRAM)
- FastAPI Background Tasks — для лёгких задач
- Celery + Redis — если нужна полноценная очередь задач (но для нашего случая простой polling достаточно)
