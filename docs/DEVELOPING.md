# Гайд разработчика — как читать код MindeSync и куда лезть

Этот документ для разработчика, который впервые открыл репозиторий и хочет
**понять код и научиться в нём ориентироваться**: с чего начать чтение, как
проследить запрос насквозь, куда вносить изменения и на чём обычно спотыкаются.

Соседние документы:
- [GUIDE.md](GUIDE.md) — что это за продукт и как им пользоваться (читать первым,
  если вообще не знаком с проектом).
- [AI_CONTEXT.md](AI_CONTEXT.md) — плотная карта-референс (полный реестр эндпоинтов,
  все таблицы БД). Держите открытым как справочник, когда читаете этот гайд.
- [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md) — точные бизнес-правила и переходы статусов.

---

## Содержание

1. [Карта репозитория за 2 минуты](#1-карта-репозитория-за-2-минуты)
2. [С чего начать чтение кода](#2-с-чего-начать-чтение-кода)
3. [Как устроен один запрос (анатомия)](#3-как-устроен-один-запрос-анатомия)
4. [Сквозной поток №1: транскрибация](#4-сквозной-поток-1-транскрибация)
5. [Сквозной поток №2: генерация заметки](#5-сквозной-поток-2-генерация-заметки)
6. [Сквозной поток №3: каждый авторизованный запрос](#6-сквозной-поток-3-каждый-авторизованный-запрос)
7. [Остальные домены — обзорно](#7-остальные-домены--обзорно)
8. [Куда вносить изменения (рецепты)](#8-куда-вносить-изменения-рецепты)
9. [Конвенции и грабли — прочитать обязательно](#9-конвенции-и-грабли--прочитать-обязательно)
10. [Локальная разработка](#10-локальная-разработка)

---

## 1. Карта репозитория за 2 минуты

```
api/            FastAPI backend — вся серверная бизнес-логика
  app.py        точка входа: сборка приложения, CORS, фоновые циклы
  database.py   async-движок SQLAlchemy + фабрика сессий + Base
  models.py     ВСЕ ORM-модели (таблицы БД) — один файл
  schemas.py    Pydantic-схемы запросов/ответов (первый слой валидации)
  auth.py       JWT, bcrypt, отзыв токенов через Redis
  dependencies.py  get_db, get_current_user, require_admin, проверки прав
  worker_auth.py   проверка X-Worker-Key
  ml_endpoints.py  /api/ml/* — обработка текста LLM
  transcribe.py    /api/transcribe/* — загрузка «всё-в-одном»
  routers/      по одному файлу на домен (auth, users, lectures, catalog, ...)
ml/             промпты и вызовы LLM, фильтры текста
worker/         отдельный десктоп-процесс транскрибации (НЕ в docker)
pdf-service/    Node.js: Markdown → PDF/DOCX
src/            React SPA (кабинет в src/components/account/)
alembic/        миграции БД (20 ревизий)
```

Главное, что нужно усвоить про backend сразу:

- **Все модели БД — в одном файле** [api/models.py](../api/models.py). Не ищите их по
  каталогам.
- **Один домен = один роутер** в [api/routers/](../api/routers/). Хотите понять фичу —
  открываете соответствующий роутер.
- **Вся бизнес-логика на сервере (`api/`)**, фронт — тонкий клиент на `fetch`.

---

## 2. С чего начать чтение кода

Чтобы въехать в проект, читайте файлы в таком порядке:

1. **[api/app.py](../api/app.py)** — как собирается приложение, какие роутеры с
   какими префиксами подключены, и какие **фоновые циклы** крутятся (recovery
   зависших задач, очистка аудио, очистка квот). Это оглавление backend'а.
2. **[api/models.py](../api/models.py)** — модель данных. Пока не поймёте таблицы и
   связи, остальное будет в тумане. Обращайте внимание на enum'ы вверху файла —
   это статусы, вокруг которых построены конечные автоматы.
3. **[api/dependencies.py](../api/dependencies.py)** — как работает авторизация и
   проверки прав (`get_current_user`, `require_admin`, `require_catalog_moderator`,
   `can_moderate_stream`). Эти зависимости висят почти на каждом эндпоинте.
4. **Один роутер целиком** — рекомендую [routers/lectures.py](../api/routers/lectures.py):
   он средний по размеру и затрагивает почти все подсистемы (права, очередь,
   ML, квоты).
5. **[ml/deepseek_processor.py](../ml/deepseek_processor.py)** и
   [ml/prompts.py](../ml/prompts.py) — как генерируются материалы.

После этого открывайте [AI_CONTEXT.md](AI_CONTEXT.md) §8 как справочник по
эндпоинтам — он уже будет читаться легко.

> Самый сложный домен — **каталог** ([routers/catalog.py](../api/routers/catalog.py),
> ~2000 строк). Не начинайте с него. Возвращайтесь, когда освоите остальное.

---

## 3. Как устроен один запрос (анатомия)

Любой эндпоинт устроен по одной схеме — узнаёте её один раз и читаете все роутеры:

```python
@router.post("/{id}/something")
async def do_something(
    id: UUID,
    body: SomethingIn,                          # 1. Pydantic-валидация (→ 422)
    db: AsyncSession = Depends(get_db),          # 2. сессия БД
    user: User = Depends(get_current_user),      # 3. авторизация (→ 401/403)
):
    obj = await db.get(Model, id)                # 4. достать объект
    if not obj or obj.is_deleted:                # 5. мягкое удаление!
        raise HTTPException(404)
    _check_owner(obj, user)                       # 6. бизнес-права (→ 403)
    ...                                           # 7. логика
    await db.commit()
    return SomethingOut.model_validate(obj)       # 8. сериализация ответа
```

Где это лежит:
- Тело и валидация формата — схема в [schemas.py](../api/schemas.py). Нарушение —
  **422**, ещё до тела функции.
- Бизнес-проверки (права, дубли, существование) — **внутри** функции, дают
  400/403/404/409.
- Проверки прав часто вынесены в хелперы прямо в файле роутера (`_check_owner`,
  `_can_read_lecture` и т.п.) или в [dependencies.py](../api/dependencies.py).

Запомните это разделение: **422 — это схема, всё остальное — логика роутера**.

---

## 4. Сквозной поток №1: транскрибация

Самый показательный поток в проекте — он проходит через сервер, очередь, отдельный
процесс-воркер и фоновый recovery. Разберём по шагам и по файлам.

### Шаг 1. Загрузка (сервер принимает файл, но НЕ распознаёт)

`POST /api/transcribe/upload` → [api/transcribe.py](../api/transcribe.py):
- проверяет auth (`get_current_user`), валидирует формат и размер (≤100 МБ);
- сохраняет файл на диск (`DATA_DIR/audio_queue/YYYY/MM/`);
- создаёт три записи: `Lecture` (статус `processing`), `AudioFile`
  (`audio_expires_at = now + 7 дней`) и **`TranscriptionTask` со статусом
  `pending`** — это и есть постановка в очередь.

Ключевая мысль: **сервер не транскрибирует**. У него нет GPU. Он только кладёт
задачу в таблицу `transcription_tasks`.

> Есть и второй, «структурный» путь загрузки через
> [routers/lectures.py](../api/routers/lectures.py): `POST /api/lectures/` →
> `POST /{id}/audio` → `POST /{id}/transcribe`. Итог тот же — `pending`-задача.

### Шаг 2. Воркер забирает задачу

Воркер ([worker/worker.py](../worker/worker.py)) крутит цикл и дёргает сервер
([routers/worker.py](../api/routers/worker.py)), аутентифицируясь заголовком
`X-Worker-Key` ([worker_auth.py](../api/worker_auth.py)):

- `GET /api/worker/next` — сервер берёт **самую старую `pending`** через
  `SELECT ... FOR UPDATE SKIP LOCKED` (это гарантирует, что два воркера не возьмут
  одну задачу), переводит её в `processing`, проставляет `worker_name`,
  `started_at`, `last_heartbeat_at`.
- `GET /api/worker/download/{task_id}` — скачивает аудио.
- В фоне каждые ~20 сек `POST /api/worker/heartbeat` — продлевает
  `last_heartbeat_at` (чтобы сервер не счёл воркер зависшим).

### Шаг 3. Распознавание

[worker/transcriber.py](../worker/transcriber.py) — обёртка над пакетом
`openai-whisper`: `whisper.load_model(model, device)`, язык по умолчанию `ru`,
`fp16` только на CUDA. `DEVICE=auto` сам выбирает CUDA, если она доступна.

### Шаг 4. Результат возвращается на сервер

- Успех: `POST /api/worker/result/{task_id}` → сервер создаёт `Transcription`
  (`raw_text`, `whisper_model`, ...), задача → `completed`, **а лекция →
  `ready`**. Вот момент, когда лекция «готова».
- Ошибка: `POST /api/worker/error/{task_id}` → `retry_count += 1`; если `>= 3` →
  `failed`, иначе → обратно в `pending` (другой воркер попробует снова).
- Все три эндпоинта проверяют, что задача принадлежит **этому** воркеру
  (`worker_name`), иначе 403.

### Шаг 5. Защита от зависаний

В [api/app.py](../api/app.py) крутится `_timeout_recovery_loop()` (каждые 5 мин):
задачи, застрявшие в `processing` без heartbeat дольше 30 мин, возвращаются в
`pending` (или `failed`, если попытки исчерпаны). Поэтому упавший воркер не блокирует
очередь навсегда.

**Где что править:** серверная сторона очереди — [routers/worker.py](../api/routers/worker.py);
клиент — [worker/worker.py](../worker/worker.py); recovery — [api/app.py](../api/app.py);
статусы — enum `TranscriptionTaskStatus` в [models.py](../api/models.py).

---

## 5. Сквозной поток №2: генерация заметки

Второй поток, который надо понять, — асинхронная генерация материала с квотой. Он
показывает паттерн «фоновая задача + опрос статуса», используемый в нескольких
местах.

### Шаг 1. Запрос на генерацию

`POST /api/lectures/{id}/notes/generate` → [routers/lectures.py](../api/routers/lectures.py):
- права: `_check_owner_or_catalog_moderator`; нужен непустой текст транскрипции;
  для режима `expand_topic` обязателен параметр `topic`;
- **списывается слот квоты ДО запуска** (защита от спама параллельными
  запросами) — см. [api/quota.py](../api/quota.py);
- запускается фоновая задача (FastAPI `BackgroundTasks`), её статус кладётся в
  **in-memory словарь `_note_gen_jobs`**, эндпоинт сразу возвращает `job_id` (202).

### Шаг 2. Фоновая работа

Фоновая функция вызывает ML-процессор и делает **upsert** `LectureNote` по паре
`(lecture_id, mode)` (уникальность гарантирует БД):

- [ml/deepseek_processor.py](../ml/deepseek_processor.py) → `process_text(text, mode)`.
  Внутри либо `_simple_generation`, либо `_chunked_generation` (для длинных текстов:
  выделить темы → генерировать по кускам → слить). Формулы нормализуются к
  `$...$`/`$$...$$`.
- Промпты и параметры режима (`max_tokens`, `temperature`, `needs_chunking`) — в
  [ml/prompts.py](../ml/prompts.py) (`PROMPTS` + `PROCESSING_CONFIGS`).

Если генерация **провалилась или вернула пустой текст** — слот квоты возвращается
(`quota.refund`), чтобы не списывать за бесполезный результат.

### Шаг 3. Опрос статуса

Фронт опрашивает `GET /api/lectures/{id}/notes/generate/{job_id}` (статусы
`pending → processing → done|failed`). Опрашивать может **только инициатор** (сверка
`user_id`). На фронте — [LecturesSection.tsx](../src/components/account/LecturesSection.tsx):
держит список активных задач и опрашивает их одним интервалом, поэтому **разные
режимы генерируются параллельно** (ограничение — одна задача на пару лекция+режим).

> ⚠️ `_note_gen_jobs` живёт в памяти процесса. При нескольких воркерах uvicorn
> статус задачи виден только на том инстансе, что её принял, и теряется при
> рестарте. Это осознанное упрощение — см. раздел 9.

**Где что править:** логика — [routers/lectures.py](../api/routers/lectures.py);
генерация — [ml/](../ml/); квоты — [api/quota.py](../api/quota.py); фронт —
[LecturesSection.tsx](../src/components/account/LecturesSection.tsx) +
[QuotaBadge.tsx](../src/components/account/QuotaBadge.tsx).

---

## 6. Сквозной поток №3: каждый авторизованный запрос

Короткий, но важный — проходит на **каждом** защищённом эндпоинте.

1. Токен достаётся в `_extract_token()` ([dependencies.py](../api/dependencies.py)):
   сначала заголовок `Authorization: Bearer`, потом — fallback на httpOnly cookie
   `mindesync_token`.
2. `get_current_user()` декодирует JWT ([auth.py](../api/auth.py)), проверяет, что
   токен **не отозван** (Redis-блэклист `revoked:{jti}`), что пользователь
   существует, не удалён и активен (с авто-разблокировкой, если `blocked_until`
   уже прошёл).
3. Подгружает профили (`student_profile`/`teacher_profile`) и `stream`.

Сопутствующее:
- **Восстановление сессии после F5:** токен на фронте живёт только в памяти (не в
  localStorage — защита от XSS). После перезагрузки фронт зовёт
  `GET /api/auth/refresh`, который по cookie выдаёт новый токен и отзывает старый
  (ротация).
- **Logout** кладёт `jti` в Redis-блэклист. Без Redis отзыв молча не работает —
  приложение не падает, но «выйти из всех сессий» не сработает.

**Где что править:** механика токенов — [auth.py](../api/auth.py); извлечение и
проверки — [dependencies.py](../api/dependencies.py); фронт-стейт —
[AuthContext.tsx](../src/contexts/AuthContext.tsx).

---

## 7. Остальные домены — обзорно

Эти подсистемы разбирайте по мере надобности; точные эндпоинты — в
[AI_CONTEXT.md](AI_CONTEXT.md) §8, правила — в [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md).

- **Каталог дисциплин** ([routers/catalog.py](../api/routers/catalog.py)) — самый
  большой домен. Иерархия `Faculty → Direction → Stream → (Semester / DisciplineNode)`,
  плюс заявки на публикацию и на генерацию материалов с модерацией. Скоуп старосты —
  только свой поток (`can_moderate_stream`). Подробно — BUSINESS_LOGIC §8–10.
- **Доски** ([routers/boards.py](../api/routers/boards.py)) — Excalidraw-JSON в
  `Board.data`. Интересное — **WebSocket** `/{board_id}/ws` для совместного
  редактирования: комнаты в памяти (`_ws_rooms`) + синхронизация между инстансами
  через Redis pub/sub.
- **Админка** ([routers/admin.py](../api/routers/admin.py)) — всё под
  `require_admin`. Внимание: удаление пользователя — **hard delete** с
  переназначением его контента на системного админа (не мягкое, в отличие от
  остального).
- **Экспорт** ([routers/export.py](../api/routers/export.py)) — backend только
  **проксирует** Markdown в Node-сервис [pdf-service/server.js](../pdf-service/server.js).
  PDF — через Playwright/Chromium + KaTeX, DOCX — через Pandoc. На backend генерации
  документов нет.
- **ML-эндпоинты** ([ml_endpoints.py](../api/ml_endpoints.py)) — `/api/ml/process`,
  `/explain`, `/diagram`. Используют **другого** LLM-провайдера (см. раздел 9).

---

## 8. Куда вносить изменения (рецепты)

| Задача | Что трогать (по порядку) |
|--------|--------------------------|
| Новое поле в сущности БД | [models.py](../api/models.py) → **новая миграция** в [alembic/versions/](../alembic/versions/) → схема в [schemas.py](../api/schemas.py) |
| Новый / изменённый эндпоинт | нужный файл в [routers/](../api/routers/) + схема в [schemas.py](../api/schemas.py); если новый роутер — подключить в [app.py](../api/app.py) |
| Изменить правила доступа | [dependencies.py](../api/dependencies.py) (`require_admin`, `require_catalog_moderator`, `can_moderate_stream`) или хелперы в самом роутере |
| Поведение токена / logout | [auth.py](../api/auth.py) |
| Новый режим обработки текста | [ml/prompts.py](../ml/prompts.py) (`PROMPTS` + `PROCESSING_CONFIGS`) → ветка в [deepseek_processor.py](../ml/deepseek_processor.py) → фронт-тип `MLMode` в [src/types/ml.ts](../src/types/ml.ts) |
| Лимиты / тарифы | [api/quota.py](../api/quota.py) (лимиты, окно, учёт); точки списания — [lectures.py](../api/routers/lectures.py) и [ml_endpoints.py](../api/ml_endpoints.py); фронт — [quota.ts](../src/utils/quota.ts), [QuotaBadge.tsx](../src/components/account/QuotaBadge.tsx) |
| Сменить LLM / модель | только `.env`: `DEEPSEEK_*` (основной) или `POLZA_*`/`DIAGRAM_*` (explain/diagram). Код менять не нужно |
| Логика очереди транскрибации | [routers/worker.py](../api/routers/worker.py) (сервер) + [worker/worker.py](../worker/worker.py) (клиент) + recovery в [app.py](../api/app.py) |
| Новая секция кабинета | компонент в [src/components/account/](../src/components/account/) → зарегистрировать в `ActiveSection` ([types.ts](../src/components/account/types.ts)), [AccountPage.tsx](../src/components/account/AccountPage.tsx), [Sidebar.tsx](../src/components/account/Sidebar.tsx) |
| Новый формат экспорта | [routers/export.py](../api/routers/export.py) и/или [pdf-service/server.js](../pdf-service/server.js); фронт — [useExport.ts](../src/hooks/useExport.ts) |

---

## 9. Конвенции и грабли — прочитать обязательно

Это то, на чём новый разработчик гарантированно споткнётся, если не знать заранее.

- **Мягкое удаление везде.** У `User`, `Lecture`, `AudioFile`, `Transcription` есть
  `is_deleted`. **Любой** запрос должен фильтровать `is_deleted == False`. Забудете —
  будете показывать удалённое. Исключение — hard delete пользователя в админке.

- **Время в БД — наивный UTC.** Все `DateTime`-колонки — `TIMESTAMP WITHOUT TIME
  ZONE`, код везде использует `datetime.utcnow()`. Если в колонку попадёт
  tz-aware datetime от клиента (ISO с `Z`), **asyncpg падает с `DataError` → 500**.
  Перед записью клиентского времени приводите к наивному UTC
  (`.astimezone(utc).replace(tzinfo=None)`) — так сделано для `subscription_expires_at`
  в [admin.py](../api/routers/admin.py). Этот баг уже один раз ловили.

- **Два разных LLM-провайдера.** `/api/ml/process` (генерация материалов) использует
  клиент на переменных `DEEPSEEK_*`. А `/api/ml/explain` и `/diagram` — **другой**
  клиент на `POLZA_*`/`DIAGRAM_*` в [ml_endpoints.py](../api/ml_endpoints.py). Это
  не один клиент с разными моделями, а два отдельных. **И ещё**: имя `DEEPSEEK_*` —
  историческое, фактически туда сейчас прописана модель **Qwen** через VseLLM
  (см. [GUIDE.md](GUIDE.md) §6). Смотрите на значение переменной, а не на имя.

- **Не все эндпоинты требуют auth.** `/api/ml/process|batch-process|diagram|modes|
  quick-summary` и `/api/transcribe/filter|health` — **без токена**. А вот
  `/api/transcribe/upload` и `/api/ml/explain` — **требуют** auth, и `explain` ещё
  и тратит квоту. Учитывайте при правках безопасности.

- **In-memory реестры — не для кластера.** `_note_gen_jobs` (статусы генерации) и
  `_ws_rooms` (комнаты досок) живут в памяти процесса. При нескольких воркерах
  uvicorn они не шарятся: для досок это компенсируется Redis pub/sub, для
  note-job — нет (статус виден только на принявшем инстансе). Если будете
  масштабировать — это первое, что сломается.

- **Двойной префикс у export.** В роутере объявлен `prefix="/export"`, а
  подключается он в [app.py](../api/app.py) ещё и с `prefix="/api"` → реальный путь
  `/api/export/*`. Не удивляйтесь.

- **Redis опционален.** Без него не работают отзыв токенов (logout) и синхронизация
  досок между инстансами, но приложение не падает.

- **Право на текст опубликованной лекции** переходит к модератору потока, а не
  остаётся у студента-владельца. См. матрицу прав в BUSINESS_LOGIC §4.

- **При изменении [models.py](../api/models.py) — обязательно миграция.** Схема в
  проде накатывается только через Alembic (`alembic upgrade head`), автосоздания
  таблиц нет.

---

## 10. Локальная разработка

Полные команды — в [README.md](../README.md). Здесь — что нужно разработчику.

**Поднять backend для разработки:**

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn api.app:app --host 0.0.0.0 --port 8000 --reload
```

- Интерактивная документация и «потрогать API» — `http://localhost:8000/docs`
  (Swagger генерируется FastAPI автоматически из роутеров и схем).
- Фронт — `npm start` (порт 3000), базовый URL API берётся из `REACT_APP_API_URL`.

**Миграции (Alembic):**

```powershell
alembic upgrade head                       # накатить все
alembic revision -m "описание"             # создать пустую
alembic revision --autogenerate -m "..."   # создать из diff моделей
```

**Воркер** запускается отдельно и в своём окружении `worker/.venv` — см.
[WORKER_GUIDE.md](WORKER_GUIDE.md) и [WORKER_RUN.md](../worker/WORKER_RUN.md).

**Первый админ:**

```powershell
.\.venv\Scripts\python -m scripts.create_admin
```

**Где смотреть, если что-то не работает:** вывод `uvicorn` (логи backend),
консоль браузера (фронт), консоль воркера (транскрибация). Уровень логов
регулируется `LOG_LEVEL` в `.env`.
