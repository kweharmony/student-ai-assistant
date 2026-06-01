# AI Context — Полная техническая карта проекта MindeSync

> **Назначение этого файла.** Это единый технический справочник по всему проекту,
> оптимизированный для передачи в ИИ-ассистента в качестве контекста. Цель — чтобы
> модель за один проход поняла структуру, функционал и связи между частями системы
> и могла **сразу вносить правки в нужные файлы**, не перечитывая весь репозиторий.
>
> Документ описывает *где что лежит и как связано* (карта кода). Парный документ
> [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md) описывает *как система себя ведёт* —
> бизнес-правила, жизненные циклы, переходы статусов, модель прав и процессы
> модерации. Вместе они — техдокументация проекта; все факты сверены с актуальным
> кодом. Операционные детали воркера (запуск, GPU) — в [WORKER_GUIDE.md](WORKER_GUIDE.md)
> и [WORKER_RUN.md](WORKER_RUN.md). Прочие старые доки удалены как устаревшие.
>
> **Как поддерживать актуальность:** при изменении эндпоинтов, моделей БД, секций
> фронтенда или env-переменных — обновляйте соответствующий раздел здесь.

---

## 1. Что это за проект

**MindeSync (Student AI Assistant)** — платформа обработки студенческих лекций:

1. Пользователь загружает аудио/видео лекции.
2. Файл транскрибируется в текст локально через **Whisper** (на отдельных
   воркер-машинах, не на сервере — у сервера нет GPU).
3. Транскрипт чистится AI-фильтром и обрабатывается **LLM (DeepSeek)** в учебные
   материалы: конспекты, термины, вопросы, шпаргалки, расширенные объяснения.
4. Результат экспортируется в PDF/DOCX/TXT/Markdown.
5. Лекции публикуются в общий **каталог дисциплин** (с модерацией старост/админов),
   плюс есть совместные **доски** (Excalidraw).

Роли: **student**, **teacher**, **admin**. Дополнительный флаг **is_group_head**
(староста) даёт права модерации каталога своего потока.

---

## 2. Архитектура (runtime-компоненты)

```
                         ┌──────────────────────────┐
   Браузер (React SPA)   │  src/  — порт 3000 (dev)  │
                         └───────────┬──────────────┘
                                     │ HTTPS / fetch, JWT (Bearer + httpOnly cookie)
                                     ▼
                   ┌─────────────────────────────────────┐
                   │  FastAPI backend  api/  — порт 8000  │
                   │  роутеры: auth/users/lectures/...    │
                   └──┬─────────┬──────────┬─────────┬────┘
                      │         │          │         │
          asyncpg ┌───▼───┐ ┌───▼───┐  ┌───▼────┐ ┌──▼──────────────┐
                  │Postgres│ │ Redis │  │  ml/   │ │ pdf-service/    │
                  │  :5432 │ │ :6379 │  │DeepSeek│ │ Node :3001      │
                  └────────┘ └───────┘  │ (LLM)  │ │ Playwright→PDF  │
                                        └────────┘ └─────────────────┘
                      ▲
                      │  X-Worker-Key, polling
          ┌───────────┴────────────┐
          │  worker/  (десктоп)    │  Whisper на CPU/GPU воркер-машины,
          │  tray + heartbeat      │  НЕ входит в docker-compose
          └────────────────────────┘
```

Источник схемы wiring: [api/app.py](../api/app.py), [docker-compose.yml](../docker-compose.yml).

| Компонент | Каталог | Назначение | Запуск |
|-----------|---------|-----------|--------|
| Frontend SPA | [src/](../src/) | React 18 + TS интерфейс | порт 3000 (CRA dev) / nginx |
| Backend API | [api/](../api/) | FastAPI, вся бизнес-логика | `uvicorn api.app:app` :8000 |
| ML-слой | [ml/](../ml/) | Промпты и вызовы LLM | библиотека, импортируется backend'ом |
| Воркер | [worker/](../worker/) | Локальная транскрибация Whisper | отдельный процесс на машине с GPU |
| PDF/DOCX-сервис | [pdf-service/](../pdf-service/) | Markdown → PDF (Playwright/Chromium + KaTeX) и → DOCX (Pandoc, OMML) | Node :3001 |
| Nginx | [nginx/](../nginx/) | Reverse proxy для Docker | контейнер :80 |
| Миграции | [alembic/](../alembic/) | Схема БД (20 ревизий) | `alembic upgrade head` |

---

## 3. Технологический стек

**Frontend:** React 18, TypeScript, React Router, TipTap (rich-text редактор),
Excalidraw (доски), Tailwind CSS, Framer Motion, `marked` (Markdown→HTML),
KaTeX (формулы). Конфиги: [package.json](../package.json), [tsconfig.json](../tsconfig.json),
[tailwind.config.js](../tailwind.config.js).

**Backend:** FastAPI, Uvicorn, SQLAlchemy 2.0 (async), asyncpg, Alembic, Pydantic,
python-jose (JWT), bcrypt, redis.asyncio, OpenAI SDK (для LLM-вызовов через
совместимый провайдер). Зависимости: [requirements.txt](../requirements.txt).

**Хранилища:** PostgreSQL 16 (данные), Redis 7 (блэклист JWT + pub/sub для досок).

**ML/обработка:** OpenAI Whisper (пакет `openai-whisper`) для транскрибации на
воркерах; DeepSeek через VseLLM/Polza-совместимый OpenAI API для генерации материалов.

**PDF:** Node.js + Express + Playwright + Chromium. [pdf-service/server.js](../pdf-service/server.js).

---

## 4. Карта репозитория

```
student-ai-assistant/
├── api/                       # FastAPI backend
│   ├── app.py                 # точка входа: сборка app, CORS, lifespan-фоновые циклы
│   ├── database.py            # async engine + session factory + Base
│   ├── models.py              # ВСЕ ORM-модели (таблицы БД) — 1 файл
│   ├── schemas.py             # Pydantic-схемы запросов/ответов
│   ├── auth.py                # JWT, bcrypt, revoke через Redis
│   ├── dependencies.py        # get_db, get_current_user, require_admin, модераторы
│   ├── worker_auth.py         # проверка X-Worker-Key
│   ├── ml_endpoints.py        # /api/ml/* — обработка текста LLM
│   ├── transcribe.py          # /api/transcribe/* — legacy upload/filter (без auth)
│   └── routers/
│       ├── auth.py            # /api/auth      — register/login/logout/refresh/me
│       ├── users.py           # /api/users     — профиль, аватар, роль, поток, пароль
│       ├── lectures.py        # /api/lectures  — лекции, аудио, задачи, заметки, AI-фильтр
│       ├── catalog.py         # /api/catalog   — каталог дисциплин, публикации, модерация (самый большой)
│       ├── boards.py          # /api/boards    — доски Excalidraw + шаринг
│       ├── admin.py           # /api/admin     — админ-панель
│       ├── worker.py          # /api/worker    — очередь задач для воркеров
│       └── export.py          # /api/export    — docx/pdf
├── ml/
│   ├── deepseek_processor.py  # класс DeepSeekProcessor — генерация материалов
│   ├── transcription_filter.py# AI-чистка транскрипта
│   ├── prompts.py             # PROMPTS, PROCESSING_CONFIGS, CHUNKING_PROMPTS
│   ├── filter_prompts.py      # промпты для фильтрации
│   └── profanity_filter.py    # фильтр мата
├── worker/
│   ├── worker.py              # главный цикл: poll → download → transcribe → submit
│   ├── transcriber.py         # обёртка над Whisper
│   ├── tray_app.py            # системный трей (вкл/выкл, статистика)
│   ├── config.py / config.json# конфиг воркера
│   └── requirements.txt
├── pdf-service/
│   ├── server.js             # Express :3001; /render-pdf (Playwright+KaTeX), /render-docx (Pandoc), /health
│   └── package.json
├── src/                       # React SPA (см. раздел 9)
│   ├── App.tsx                # роутинг
│   ├── index.tsx              # bootstrap
│   ├── contexts/              # AuthContext, ThemeContext
│   ├── hooks/                 # useMLProcessor, useFileUpload, useExport
│   ├── components/
│   │   ├── account/           # личный кабинет (основной функционал)
│   │   └── ...                # лендинг (Hero, Features, Header, Footer...)
│   ├── types/                 # ml.ts, modules.d.ts
│   └── utils/                 # markdownUtils, exportUtils
├── alembic/versions/          # 20 миграций (001..020)
├── nginx/                     # default.conf, frontend.conf
├── scripts/                   # create_admin, seed_admin, download_model, start.*
├── docs/                      # вся документация (этот файл — здесь)
├── docker-compose.yml         # db, redis, backend, pdf-service, frontend, nginx
├── Dockerfile.{backend,frontend,pdf}
├── requirements.txt           # backend deps
├── package.json               # frontend deps
├── .env.example               # шаблон конфигурации
└── run.* / setup.*            # локальный запуск (Windows/Unix)
```

---

## 5. Бэкенд: сборка приложения

[api/app.py](../api/app.py) — точка входа (`uvicorn api.app:app`):

- Создаёт `FastAPI(title="MindeSync — Student AI Assistant API")`.
- CORS из `CORS_ORIGINS`.
- Подключает роутеры (порядок и префиксы):
  - `ml_router` → `/api/ml`, `transcribe_router` → `/api/transcribe` (без auth, legacy)
  - `auth_router` → `/api/auth`, `users_router` → `/api/users`,
    `lectures_router` → `/api/lectures`, `admin_router` → `/api/admin`,
    `worker_router` → `/api/worker`, `boards_router` → `/api/boards`,
    `catalog_router` → `/api/catalog`
  - `export_router` подключается с **доп. префиксом `/api`** → итог `/api/export/*`
    (в самом роутере объявлен `prefix="/export"`).
- **`lifespan`** запускает две фоновые корутины (`asyncio.create_task`):
  - `_timeout_recovery_loop()` — каждые 5 мин возвращает «зависшие» задачи
    транскрибации (`processing` без heartbeat > 30 мин) обратно в `pending`,
    а при `retry_count >= 3` → `failed`.
  - `_audio_cleanup_loop()` — каждый час удаляет с диска просроченные аудиофайлы
    (`audio_expires_at < now`) и ставит `is_deleted=True`.

---

## 6. Бэкенд: аутентификация и авторизация

Файлы: [api/auth.py](../api/auth.py), [api/dependencies.py](../api/dependencies.py),
[api/worker_auth.py](../api/worker_auth.py).

**Токены (JWT, HS256):**
- `create_access_token(user_id, role)` кладёт `sub`, `role`, `exp`, уникальный `jti`.
- Срок жизни: `ACCESS_TOKEN_EXPIRE_MINUTES` (по умолчанию 1440 = 24 ч).
- **Logout / revoke:** `jti` помещается в Redis-блэклист (`revoked:{jti}`) с TTL до
  истечения токена. Без Redis инвалидация просто не работает (не падает).

**Передача токена (две схемы одновременно):**
- `Authorization: Bearer <token>` — приоритет.
- httpOnly cookie `mindesync_token` — fallback. После перезагрузки страницы фронт
  восстанавливает сессию через `GET /api/auth/refresh` (cookie → новый access_token).
- `_extract_token()` в dependencies реализует этот приоритет.

**Зависимости (используются в роутерах через `Depends`):**
- `get_db()` — async-сессия SQLAlchemy.
- `get_current_user()` — обязательная авторизация; подгружает `student_profile`,
  `teacher_profile`, `stream`; проверяет блокировку (с авто-разблокировкой по
  `blocked_until`); 401/403 при проблемах.
- `get_current_user_optional()` — то же, но возвращает `None` без токена (для
  публичных эндпоинтов, напр. публичная доска).
- `require_admin()` — только `role == "admin"`.
- `require_catalog_moderator()` — admin **или** староста (`is_group_head` с
  назначенным `stream_id`).
- `can_moderate_stream(user, stream_id)` — хелпер: admin всегда; староста — только
  для своего потока.

**Воркеры** аутентифицируются отдельно: заголовок `X-Worker-Key`, проверяется в
`require_worker_key()` против `WORKER_API_KEYS` (формат `Имя:ключ,Имя2:ключ2`).

---

## 7. Бэкенд: модель данных (PostgreSQL)

Все ORM-модели — в одном файле [api/models.py](../api/models.py). PK везде `UUID`,
повсеместно «мягкое удаление» (`is_deleted`), таймстампы `created_at/updated_at`.

### Перечисления (enum)
- `UserRole`: student / teacher / admin
- `LectureStatus`: processing / ready / error
- `TranscriptionTaskStatus`: pending / processing / completed / error / failed
- `LectureAiFilterRequestStatus`: pending / approved / rejected / failed
- `PublicationRequestStatus`, `MaterialGenerationRequestStatus`: pending / approved / rejected
- `SubscriptionTier`: free / pro
- `GenerationUsageKind`: generation / explain (учёт квоты, см. BUSINESS_LOGIC §7А)

### Таблицы (модель → таблица → ключевое)

| Модель | Таблица | Назначение / ключевые поля |
|--------|---------|----------------------------|
| `User` | `users` | login, email, password_hash, `role`, `is_group_head`, `stream_id`, `can_choose_role`, `subscription_tier`/`subscription_expires_at` (тариф), поля блокировки (`blocked_reason/by/at/until`), `avatar_url/emoji` |
| `StudentProfile` | `student_profiles` | 1:1 с user; group_name, course, faculty |
| `TeacherProfile` | `teacher_profiles` | 1:1 с user; department, position, academic_degree |
| `Lecture` | `lectures` | title, subject, `uploaded_by`, `status`, `is_public`, мягкое удаление |
| `AudioFile` | `audio_files` | file_path, file_name, размер, `audio_expires_at` (TTL 7 дней) |
| `Transcription` | `transcriptions` | `raw_text`, `processed_text`, `is_ai_filtered`, whisper_model, confidence |
| `TranscriptionTask` | `transcription_tasks` | очередь для воркеров: `status`, `worker_id/name`, `retry_count`, `last_heartbeat_at` |
| `LectureNote` | `lecture_notes` | сгенерированный материал; `mode` + `content`; уникально (lecture_id, mode) |
| `LectureAiFilterRequest` | `lecture_ai_filter_requests` | запрос на AI-фильтрацию с модерацией + `generation_status` |
| `Board` | `boards` | Excalidraw JSON в `data`; `share_token`, `is_public`, `share_mode` (view/edit) |
| `BoardVisit` | `board_visits` | «недавние» доски: (board_id, user_id) уникально, `last_access_mode` |
| `AdminAction` | `admin_actions` | аудит действий админа; `action`, `target_type/id`, `details` (JSONB) |
| `Faculty` → `Direction` → `Stream` | `faculties`/`directions`/`streams` | иерархия учебных групп (факультет → направление → поток/курс) |
| `CatalogDisciplineTemplate` | `catalog_discipline_templates` | шаблоны дисциплин по направлению |
| `CatalogLecturerTemplate` | `catalog_lecturer_templates` | шаблоны преподавателей по потоку |
| `CatalogSemester` | `catalog_semesters` | курс+семестр для потока |
| `CatalogDisciplineNode` | `catalog_discipline_nodes` | дисциплина в (поток, курс, семестр) |
| `LecturePublicationRequest` | `lecture_publication_requests` | заявка на публикацию лекции в каталог (модерация) |
| `LectureCatalogItem` | `lecture_catalog_items` | опубликованная лекция в каталоге (1:1 с lecture) |
| `LectureMaterialGenerationRequest` | `lecture_material_generation_requests` | заявка на генерацию материала с модерацией + регенерация |
| `GenerationUsage` | `generation_usage` | журнал расхода квоты (`kind`, `lecture_id?`, `mode?`, `created_at`); скользящее окно 30 дней — см. BUSINESS_LOGIC §7А |

### Связи (упрощённо)
```
User 1─1 StudentProfile / TeacherProfile
User 1─* Lecture (uploaded_by)
User *─1 Stream (stream_id)
Lecture 1─* AudioFile 1─1 Transcription
AudioFile 1─* TranscriptionTask        (очередь воркеров)
Lecture 1─* LectureNote                (по mode)
Lecture 1─1 LectureCatalogItem         (после публикации)
Faculty 1─* Direction 1─* Stream
Stream 1─* CatalogSemester / CatalogDisciplineNode / CatalogLecturerTemplate
```

---

## 8. Бэкенд: полный реестр API-эндпоинтов

Pydantic-схемы запросов/ответов — в [api/schemas.py](../api/schemas.py)
(+ inline-модели в [api/ml_endpoints.py](../api/ml_endpoints.py)).

### `/api/auth` — [routers/auth.py](../api/routers/auth.py)
| Метод | Путь | Назначение |
|------|------|-----------|
| POST | `/register` | регистрация (генерирует login, ставит cookie, возвращает token) |
| POST | `/login` | вход, ставит httpOnly cookie + token |
| POST | `/logout` | revoke токена (Redis) + чистит cookie |
| GET | `/refresh` | восстановление сессии по cookie → новый access_token |
| GET | `/me` | текущий пользователь (`UserOut`) |

### `/api/users` — [routers/users.py](../api/routers/users.py)
`GET/PUT /me` (профиль), `GET /me/quota` (остаток лимитов генераций/объяснений),
`PUT /me/role`, `POST /me/stream` (создать+назначить поток),
`POST /me/password`, `PUT/DELETE /me/avatar-emoji`, `POST/DELETE /me/avatar` (файл).

### `/api/lectures` — [routers/lectures.py](../api/routers/lectures.py)
Управление лекциями и весь конвейер транскрибации/материалов:
- `GET /` список, `POST /` создать, `GET /my` мои, `GET/PUT/DELETE /{id}`.
- Аудио и задачи: `POST /{id}/audio` (загрузка), `POST /{id}/transcribe` (поставить
  в очередь, 202), `GET /{id}/task-status`, `POST /{id}/re-transcribe`.
- Текст: `PUT /{id}/save-text`, `GET /{id}/save-text-permission`.
- AI-фильтр: `POST /{id}/apply-filter`, `POST /{id}/filter-request`,
  `GET /filter-requests`, `POST /filter-requests/{id}/approve|reject`.
- Заметки/материалы: `POST /{id}/notes/generate` (202, асинхронная генерация) +
  `GET /{id}/notes/generate/{job_id}` (статус), `GET /{id}/notes`,
  `GET/POST /{id}/notes`, `GET/DELETE /{id}/notes/{note_id}`.

### `/api/catalog` — [routers/catalog.py](../api/routers/catalog.py) (самый крупный, ~2000 строк)
Каталог дисциплин + модерация публикаций:
- Структура: `GET/POST/DELETE /semesters`, `…/discipline-nodes`, `POST /bulk-update`.
- Справочники: `GET /disciplines`, `/lecturers`, `POST /discipline-templates`,
  `/lecturer-templates`.
- Иерархия: CRUD `/faculties`, `/directions`, `/streams`.
- Items: `GET /lecture-options`, `GET /items`, `PATCH/DELETE /items/{id}`,
  `POST /publish` (ручная публикация).
- Заявки на публикацию: `GET /my-lecture-statuses`, `POST/GET /requests`,
  `POST /requests/{id}/approve|reject`.
- Заявки на генерацию материалов: `POST /material-requests`,
  `GET /material-requests/my|/lecture|`(все), `POST /material-requests/{id}/approve|reject`.

### `/api/boards` — [routers/boards.py](../api/routers/boards.py)
`GET /` (мои), `GET /recent`, `POST /` создать, `GET /public/{token}` (публичный
доступ, без auth), `GET/PUT/DELETE /{id}`, `POST/DELETE /{id}/share` (вкл/выкл
шаринга), `DELETE /recent/{id}`.
**WebSocket** `WS /{board_id}/ws?token=<jwt>` — real-time совместное редактирование:
сервер держит комнаты `_ws_rooms` в памяти и **синхронизирует инстансы через Redis
pub/sub** (канал `boards:{board_id}`); периодически persist'ит состояние в Postgres.
Без Redis работает только локальный broadcast в пределах одного процесса.

### `/api/admin` — [routers/admin.py](../api/routers/admin.py) (требует `require_admin`)
Пользователи: `GET /users`, `DELETE /users/{id}` (hard delete),
`POST /users/{id}/block|unblock`, `DELETE /users/{id}/avatar`,
`PUT /users/{id}/group-head`, `PUT /users/{id}/subscription` (выдать/снять Pro).
Контент: `DELETE/PUT /lectures/{id}`,
`DELETE /audio/{id}`, `DELETE /transcriptions/{id}`. Мониторинг: `GET /actions`
(аудит), `GET /stats`, `GET /queue`, `GET /worker-stats`, `GET /lectures`,
`GET /lectures/audio/with-expiry`, `GET /boards`.

### `/api/worker` — [routers/worker.py](../api/routers/worker.py) (требует `X-Worker-Key`)
| Метод | Путь | Назначение |
|------|------|-----------|
| POST | `/register` | проверка ключа воркера |
| GET | `/next` | выдать следующую `pending`-задачу (→ `processing`) |
| GET | `/download/{task_id}` | отдать аудиофайл |
| POST | `/result/{task_id}` | принять транскрипт (→ `completed`) |
| POST | `/error/{task_id}` | сообщить об ошибке (retry/failed) |
| POST | `/heartbeat` | продлить `last_heartbeat_at` |
| GET | `/status` | счётчики очереди + активные воркеры |

### `/api/ml` — [ml_endpoints.py](../api/ml_endpoints.py) (в основном без auth)
`GET /health`, `POST /process` (основная обработка по `mode`), `POST /batch-process`,
`POST /explain` (объяснить фрагмент — через Polza-клиент; **требует auth** и
расходует квоту `explain`, см. BUSINESS_LOGIC §7А), `POST /diagram`
(текст → Excalidraw/диаграмма), `GET /modes`, `POST /quick-summary`.

### `/api/transcribe` — [transcribe.py](../api/transcribe.py) (legacy «всё-в-одном»)
- `POST /upload` (**требует auth**, `get_current_user`) — принимает файл +
  метаданные формой, валидирует формат (mp3/wav/m4a/.../mp4/mkv/webm, ≤100 МБ),
  сохраняет на диск (`DATA_DIR/audio_queue/YYYY/MM/`), создаёт `Lecture` +
  `AudioFile` (`audio_expires_at` = +7 дней) + `TranscriptionTask` и **ставит в
  очередь** (НЕ транскрибирует на сервере — это делает воркер). Используется
  «Транскрайбером» в [AccountPage.tsx](../src/components/account/AccountPage.tsx).
- `POST /filter` (**без auth**) — AI-чистка текста через `TranscriptionFilter`.
- `GET /health` (**без auth**).

> Альтернативный, более структурный путь загрузки — через
> `POST /api/lectures/{id}/audio` + `POST /api/lectures/{id}/transcribe` (см. раздел lectures).

### `/api/export` — [routers/export.py](../api/routers/export.py)
`POST /pdf` (проксирует Markdown в pdf-service :3001), `POST /docx` (генерация на
backend через python-docx).

---

## 9. ML-слой (генерация и фильтрация)

Каталог [ml/](../ml/).

**`DeepSeekProcessor`** ([ml/deepseek_processor.py](../ml/deepseek_processor.py)) —
основной генератор. Публичные методы: `process_text(text, mode, **kwargs)` и
обёртки `summarize`, `extract_terms`, `expand_topic`, `generate_questions`,
`create_detailed_notes`, `create_cheat_sheet`, `batch_process`, `health_check`.
Внутри: `_simple_generation` и `_chunked_generation` (Multi-Step: `_extract_themes`
→ `_generate_chunk` по темам → `_merge_chunks`), нормализация формул
(`_normalize_math_delimiters` → всегда `$...$`/`$$...$$`).

**Режимы обработки** (`mode`), они же ключи `PROMPTS`/`PROCESSING_CONFIGS` в
[ml/prompts.py](../ml/prompts.py): `summarize`, `extract_terms`, `expand_topic`
(требует `topic`), `generate_questions`, `detailed_notes`, `cheat_sheet`.
У каждого свои `max_tokens`/`temperature`/`top_p` и флаг `needs_chunking`.

**`TranscriptionFilter`** ([ml/transcription_filter.py](../ml/transcription_filter.py))
+ [filter_prompts.py](../ml/filter_prompts.py) + [profanity_filter.py](../ml/profanity_filter.py)
— чистка распознанного текста (ошибки распознавания, слова-паразиты, пунктуация, мат).

**LLM-провайдеры (важная деталь).** В коде используются два набора env-переменных:
- `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` — основной `DeepSeekProcessor`
  (по умолчанию VseLLM, см. [.env.example](../.env.example)).
- `POLZA_API_KEY` / `POLZA_BASE_URL` / `POLZA_MODEL` и `DIAGRAM_*` — отдельный
  OpenAI-клиент в [ml_endpoints.py](../api/ml_endpoints.py) для `/explain` и `/diagram`.

Все вызовы идут через OpenAI-совместимый SDK, поэтому провайдер меняется только URL+ключом.

---

## 10. Воркер транскрибации

Каталог [worker/](../worker/). Операционные гайды — [WORKER_GUIDE.md](WORKER_GUIDE.md)
(как работает и как подключить) и [WORKER_RUN.md](WORKER_RUN.md) (запуск на Windows).

Отдельный десктоп-процесс (НЕ в docker-compose), запускается на машине с GPU.
Свой `worker/.venv`. Цикл ([worker/worker.py](../worker/worker.py)):

```
каждые POLL_INTERVAL сек:
  GET  /api/worker/next            → есть задача?
  GET  /api/worker/download/{id}   → скачать аудио во временный файл
  (в фоне каждые 20 сек) POST /api/worker/heartbeat
  transcribe()  (Whisper, CPU/GPU)   → worker/transcriber.py
  POST /api/worker/result/{id}     → отдать текст
  при ошибке: POST /api/worker/error/{id}
```

Управление через системный трей ([worker/tray_app.py](../worker/tray_app.py)):
вкл/выкл polling, счётчик задач, выбранное устройство. Конфиг
[worker/config.json](../worker/config.json) (порядок приоритета: env → файл →
defaults, см. [worker/config.py](../worker/config.py)): `SERVER_URL`, `API_KEY`,
`WORKER_NAME` (по умолч. hostname), `WHISPER_MODEL` (по умолч. `base`), `DEVICE`
(`auto`/`cpu`/`cuda`), `POLL_INTERVAL` (сек, по умолч. 30).

**Движок и GPU** ([worker/transcriber.py](../worker/transcriber.py)): пакет
`openai-whisper`, `whisper.load_model(model, device)` с кешем моделей; язык по
умолчанию `ru`, `fp16` включается только на CUDA. `DEVICE=auto` сам выбирает CUDA,
если `torch.cuda.is_available()`. Для GPU ставится torch с CUDA-колёсами
(`--index-url .../whl/cu121` или `cu118`), иначе работает на CPU (медленнее).
Подробности по запуску/драйверам — в [WORKER_GUIDE.md](WORKER_GUIDE.md)/[WORKER_RUN.md](WORKER_RUN.md).

---

## 11. Фронтенд (React SPA)

Точка входа [src/index.tsx](../src/index.tsx) → [src/App.tsx](../src/App.tsx).

**Маршруты** ([App.tsx](../src/App.tsx)):
- `/` — лендинг (`HomePage`): Header, Hero, HowItWorks, UploadDemo, Features, Footer.
- `/auth` — вход/регистрация ([AuthPage.tsx](../src/components/AuthPage.tsx)).
- `/account` — личный кабинет (protected, см. ниже).
- `/board/:token` — публичная доска ([PublicBoardPage.tsx](../src/components/PublicBoardPage.tsx)).
- `ProtectedRoute` редиректит на `/auth` без авторизации.

**Контексты:**
- [AuthContext.tsx](../src/contexts/AuthContext.tsx) — `user`, `token` (только в
  памяти, не в localStorage — защита от XSS), `login/register/logout/updateUser`.
  Сессия восстанавливается из httpOnly cookie через `GET /api/auth/refresh` при
  монтировании. Содержит TS-типы `User`, `RegisterData`, `LoginData`.
- [ThemeContext.tsx](../src/contexts/ThemeContext.tsx) — светлая/тёмная тема.

**Базовый URL API:** `process.env.REACT_APP_API_URL || 'http://localhost:8000'`
(используется во всех компонентах/хуках). Отдельного axios-инстанса нет — везде
нативный `fetch` с `Authorization: Bearer` и/или `credentials: 'include'`.

### Личный кабинет — секции и связь с бэкендом
[src/components/account/](../src/components/account/). [AccountPage.tsx](../src/components/account/AccountPage.tsx)
переключает секции (хранит активную в localStorage `mindesync_account_active_section`),
навигация — [Sidebar.tsx](../src/components/account/Sidebar.tsx).

Маппинг ниже сверен по реальным `fetch`-вызовам в компонентах.

| Секция (`ActiveSection`) | Компонент | Реально вызываемые API |
|--------------------------|-----------|------------------------|
| `profile` | [ProfileSection.tsx](../src/components/account/ProfileSection.tsx) | `/api/users/me`, `/me/quota` (карточка «Тариф»: план, прогресс-бары остатка по обоим пулам и дни до освобождения ближайшего слота из `next_reset_at`), `/me/password`, `/me/role`, `/me/stream`, `/me/avatar-emoji`; `/api/catalog/{faculties,directions,streams}` |
| `transcriber` | [TranscriberSection.tsx](../src/components/account/TranscriberSection.tsx) (UI) + логика в [AccountPage.tsx](../src/components/account/AccountPage.tsx) | `/api/transcribe/upload`, `/api/transcribe/filter`, `/api/lectures/{id}/task-status`, `/api/lectures/{id}/save-text` |
| `text-processing` | [TextProcessingSection.tsx](../src/components/account/TextProcessingSection.tsx) | `/api/lectures/my`, `/api/lectures/{id}`, `/api/ml/explain`, `/api/lectures/{id}/save-text-permission` |
| `lectures` | [LecturesSection.tsx](../src/components/account/LecturesSection.tsx) | `/api/lectures/*` (`notes`, `notes/generate`+polling, `apply-filter`, `re-transcribe`, `audio`); `/api/catalog/{my-lecture-statuses,material-requests,requests,publish}`; бейдж лимита `generation` ([QuotaBadge](../src/components/account/QuotaBadge.tsx)) + 429-обработка |
| `catalog` | [CatalogSection.tsx](../src/components/account/CatalogSection.tsx) | `/api/catalog/{items,semesters,faculties,directions,streams,material-requests}`, `/api/lectures/{id}/notes` |
| `catalog-moderation` | [CatalogModerationSection.tsx](../src/components/account/CatalogModerationSection.tsx) | `/api/catalog/*` CRUD + `requests/{id}/{approve\|reject}`, `material-requests/{id}/{approve\|reject}`, `bulk-update`, `disciplines`, `lecturers` |
| `admin` | [AdminDashboard.tsx](../src/components/account/AdminDashboard.tsx) | `/api/admin/*` (stats, users+block/unblock/group-head/**subscription**, lectures, boards, worker-stats), `/api/catalog/{streams,faculties,directions}` |
| `board` | [BoardSection.tsx](../src/components/account/BoardSection.tsx) | `/api/boards/*` (+ WebSocket `/{id}/ws`), `/api/lectures/my`, `/api/catalog/items` |

Вспомогательное: [ExplainSection.tsx](../src/components/account/ExplainSection.tsx)
(`/api/ml/explain`, `/api/lectures/my`, `/api/catalog/items`; бейдж лимита `explain`),
[TranscriptionModals.tsx](../src/components/account/TranscriptionModals.tsx),
[RichTextEditor.tsx](../src/components/RichTextEditor.tsx) (TipTap),
[QuotaBadge.tsx](../src/components/account/QuotaBadge.tsx) + [src/utils/quota.ts](../src/utils/quota.ts)
(бейдж остатка лимитов, обработка 429, шина обновления `mindesync:quota-changed`),
[types.ts](../src/components/account/types.ts).

**Хуки** [src/hooks/](../src/hooks/): `useMLProcessor` (вызов `/api/ml/process` с
AbortController — основной обработчик режимов), `useFileUpload`,
`useExport` (PDF/DOCX через `/api/export/*`).
**Утилиты** [src/utils/](../src/utils/): `markdownUtils` (`fixBrokenFormulas` —
починка формул), `exportUtils`. **Типы** [src/types/ml.ts](../src/types/ml.ts)
(`MLMode`, `MLProcessRequest/Response`).

---

## 12. Экспорт и PDF-сервис

**И PDF, и DOCX генерирует один и тот же Node-сервис** [pdf-service/server.js](../pdf-service/server.js)
(:3001); backend [routers/export.py](../api/routers/export.py) лишь **проксирует**
Markdown туда через `httpx` (адрес сервиса — env `PDF_SERVICE_URL`,
по умолчанию `http://pdf-service:3001`). На backend нет python-docx — вся
генерация документов внешняя.

| Backend-эндпоинт | Проксирует в pdf-service | Технология |
|------------------|--------------------------|-----------|
| `POST /api/export/pdf` | `POST /render-pdf` | `marked` → HTML → **Playwright/Chromium** (формулы через **KaTeX** с CDN), печать A4 |
| `POST /api/export/docx` | `POST /render-docx` | **Pandoc** (stdin→stdout), формулы `$...$`/`$$...$$` → нативный **OMML** Word |

Тело запроса в обоих случаях: `{ markdown, filename? }`. У pdf-service также есть
`GET /health` для docker-compose/nginx.

- Клиентские TXT/MD-экспорты — в [src/utils/exportUtils.ts](../src/utils/exportUtils.ts)
  и хуке [useExport.ts](../src/hooks/useExport.ts).

---

## 13. Конфигурация (env-переменные)

Шаблон — [.env.example](../.env.example). Корневой `.env`:

| Переменная | Назначение |
|-----------|-----------|
| `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` | основной LLM (VseLLM) |
| `POLZA_*`, `DIAGRAM_*` | LLM для `/api/ml/explain` и `/diagram` (см. §9) |
| `POSTGRES_USER/PASSWORD/DB`, `DATABASE_URL` | PostgreSQL (asyncpg) |
| `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT |
| `COOKIE_SECURE` | флаг Secure для cookie (true за HTTPS) |
| `REDIS_URL` | Redis (revoke токенов + pub/sub досок); опционально |
| `PDF_SERVICE_URL` | адрес pdf-service для экспорта (по умолчанию `http://pdf-service:3001`) |
| `CORS_ORIGINS` | разрешённые домены фронта |
| `REACT_APP_API_URL` | базовый URL API (вшивается в сборку React) |
| `WORKER_API_KEYS` | ключи воркеров: `Имя:ключ,Имя2:ключ2` |
| `QUOTA_GEN_FREE/PRO`, `QUOTA_EXPLAIN_FREE/PRO` | лимиты генераций/объяснений по тарифу (дефолты 5/15 и 10/30, см. [api/quota.py](../api/quota.py)) |
| `DEBUG`, `LOG_LEVEL` | отладка/логи |

Воркер конфигурируется отдельно через [worker/config.json](../worker/config.json).

---

## 14. Миграции БД

[alembic/](../alembic/), 20 ревизий `001`–`020` в
[alembic/versions/](../alembic/versions/). Применить: `alembic upgrade head`.
Создать новую: `alembic revision -m "описание"` (или `--autogenerate`).
Эволюция схемы хорошо читается по именам файлов (boards, sharing modes, catalog,
templates, semester, material generation, regeneration, can_choose_role и т.д.).

**Важно:** при изменении [api/models.py](../api/models.py) обязательно добавляйте
новую миграцию — схема в проде накатывается только через Alembic.

---

## 15. Запуск и деплой

**Локально (Windows):** [setup.bat](../setup.bat) (зависимости) → [run.bat](../run.bat)
(backend + frontend). Воркер и pdf-service — отдельно. Unix-аналоги: `setup.sh`/`run.sh`.

**Docker** ([docker-compose.yml](../docker-compose.yml)): сервисы `db` (postgres:16),
`redis`, `backend`, `pdf-service`, `frontend`, `nginx`. Запуск:
`docker compose up --build -d`. **Воркер в compose не входит** — запускается на
рабочей станции с GPU. CI — [.github/workflows/deploy.yml](../.github/workflows/deploy.yml).

---

## 16. Гайд «куда вносить изменения» (для ИИ)

| Задача | Где править |
|--------|-------------|
| Новое поле в сущности БД | [api/models.py](../api/models.py) + новая миграция в [alembic/versions/](../alembic/versions/) + схема в [api/schemas.py](../api/schemas.py) |
| Новый/изменённый эндпоинт | соответствующий файл в [api/routers/](../api/routers/) + схема в [schemas.py](../api/schemas.py); подключение роутера — [api/app.py](../api/app.py) |
| Изменить правила доступа | [api/dependencies.py](../api/dependencies.py) (`require_admin`, `require_catalog_moderator`, `can_moderate_stream`) |
| Поведение/срок жизни токена, logout | [api/auth.py](../api/auth.py) |
| Новый режим обработки текста | [ml/prompts.py](../ml/prompts.py) (`PROMPTS` + `PROCESSING_CONFIGS`) + ветка в [ml/deepseek_processor.py](../ml/deepseek_processor.py); фронт-тип `MLMode` в [src/types/ml.ts](../src/types/ml.ts) |
| Лимиты генераций / тарифы | [api/quota.py](../api/quota.py) (лимиты, окно, учёт); точки списания — [lectures.py](../api/routers/lectures.py) (`notes/generate`, `apply-filter`) и [ml_endpoints.py](../api/ml_endpoints.py) (`explain`); фронт — [src/utils/quota.ts](../src/utils/quota.ts), [QuotaBadge.tsx](../src/components/account/QuotaBadge.tsx) |
| Сменить LLM-провайдера/модель | env `DEEPSEEK_*` (основной) или `POLZA_*`/`DIAGRAM_*` (explain/diagram, см. [ml_endpoints.py](../api/ml_endpoints.py)) |
| Логика очереди транскрибации | [api/routers/worker.py](../api/routers/worker.py) (сервер) + [worker/worker.py](../worker/worker.py) (клиент); recovery-цикл в [api/app.py](../api/app.py) |
| Новая секция кабинета | компонент в [src/components/account/](../src/components/account/) + регистрация в `ActiveSection` ([types.ts](../src/components/account/types.ts)), [AccountPage.tsx](../src/components/account/AccountPage.tsx), [Sidebar.tsx](../src/components/account/Sidebar.tsx) |
| Экспорт в новый формат | [api/routers/export.py](../api/routers/export.py) и/или [pdf-service/server.js](../pdf-service/server.js); фронт — [src/hooks/useExport.ts](../src/hooks/useExport.ts) |
| Глобальный стейт авторизации на фронте | [src/contexts/AuthContext.tsx](../src/contexts/AuthContext.tsx) |

---

## 17. Подводные камни / неочевидности

- **Двойная схема аутентификации**: Bearer-заголовок ИЛИ httpOnly cookie
  `mindesync_token`. Токен на фронте живёт только в памяти; после F5 сессия — через
  `GET /api/auth/refresh`. Не переносите токен в localStorage.
- **Два LLM-провайдера**: `/api/ml/process` использует `DEEPSEEK_*`, а
  `/api/ml/explain` и `/diagram` — `POLZA_*`/`DIAGRAM_*`. Это разные клиенты.
- **Часть эндпоинтов без auth**: `/api/ml/process|batch-process|diagram|modes|quick-summary`,
  а также `/api/transcribe/filter` и `/api/transcribe/health` не требуют токена.
  Но `/api/transcribe/upload` и **`/api/ml/explain`** — **требуют** auth
  (`get_current_user`); explain вдобавок расходует квоту. Учитывайте при изменениях безопасности.
- **Лимиты генераций (подписки)**: личная генерация заметок/AI-фильтр и объяснения
  ограничены квотой со скользящим окном 30 дней (`generation_usage` + [api/quota.py](../api/quota.py)).
  При исчерпании — **429 `quota_exceeded`**. Тариф (`free`/`pro`) ставит админ. Полностью — BUSINESS_LOGIC §7А.
- **`export_router` имеет двойной префикс**: `prefix="/export"` в роутере +
  `prefix="/api"` при подключении → реальный путь `/api/export/*`.
- **Транскрибация только через воркеры**: у сервера нет GPU; задачи живут в
  `transcription_tasks`, «зависшие» возвращает фоновый recovery-цикл (`app.py`).
- **TTL аудио — 7 дней**: `audio_expires_at`, файлы чистит `_audio_cleanup_loop`.
  Само удаление мягкое (`is_deleted=True`) + физическое удаление файла.
- **Формулы**: и backend (`_normalize_math_delimiters`), и frontend
  (`fixBrokenFormulas`) нормализуют делимитеры к `$...$`/`$$...$$` для KaTeX.
- **Redis опционален**: без него не работают revoke токенов и синхронизация досок,
  но приложение не падает.
- **Каталог — самый сложный домен**: [routers/catalog.py](../api/routers/catalog.py)
  (~2000 строк) + 4 фронт-компонента. Модель: Faculty→Direction→Stream→
  (Semester/DisciplineNode) + заявки на публикацию и генерацию материалов с модерацией.
- **Мягкое удаление везде**: фильтруйте `is_deleted == False` в запросах.
```
