# Business Logic — Подробное описание бизнес-логики MindeSync

> **Назначение этого файла.** Это исчерпывающее описание *поведения* системы:
> бизнес-правила, жизненные циклы сущностей, переходы статусов, модель прав
> доступа и рабочие процессы (модерация, публикация, генерация) — с технической
> привязкой к конкретным функциям и проверкам в коде. Все факты сверены с
> исходным кодом построчно.
>
> Парный документ — [AI_CONTEXT.md](AI_CONTEXT.md) — отвечает на вопрос «*где* что
> лежит» (карта кода, эндпоинты, таблицы). Этот файл отвечает на вопрос «*как* это
> работает и *по каким правилам*». Вместе они — единая техдокументация проекта
> (плюс операционные [WORKER_GUIDE.md](WORKER_GUIDE.md) / [WORKER_RUN.md](WORKER_RUN.md)).

---

## Оглавление

1. [Модель ролей и прав доступа](#1-модель-ролей-и-прав-доступа)
2. [Аккаунт: регистрация, вход, сессии, блокировки](#2-аккаунт-регистрация-вход-сессии-блокировки)
3. [Профиль, роль, поток](#3-профиль-роль-поток)
4. [Лекция: жизненный цикл и права](#4-лекция-жизненный-цикл-и-права)
5. [Транскрибация: конечный автомат очереди](#5-транскрибация-конечный-автомат-очереди)
6. [AI-фильтрация транскрипта](#6-ai-фильтрация-транскрипта)
7. [Генерация учебных материалов (заметок)](#7-генерация-учебных-материалов-заметок)
   - [7А. Лимиты генераций (подписки)](#7а-лимиты-генераций-подписки)
8. [Каталог дисциплин: иерархия и автоструктуры](#8-каталог-дисциплин-иерархия-и-автоструктуры)
9. [Публикация лекции в каталог (модерация)](#9-публикация-лекции-в-каталог-модерация)
10. [Заявки на генерацию материалов (модерация)](#10-заявки-на-генерацию-материалов-модерация)
11. [Доски: владение, шаринг, коллаборация](#11-доски-владение-шаринг-коллаборация)
12. [Администрирование](#12-администрирование)
13. [Сквозные правила и подводные камни](#13-сквозные-правила-и-подводные-камни)
14. [Справочник статусов](#14-справочник-статусов)
15. [Валидация входных данных (Pydantic)](#15-валидация-входных-данных-pydantic)

---

## 1. Модель ролей и прав доступа

Источник: [api/dependencies.py](../api/dependencies.py), хелперы в роутерах.

### Роли (`User.role`, enum `UserRole`)
- **student** — базовая роль: загружает лекции, транскрибирует, генерирует материалы для себя, отправляет заявки на публикацию.
- **teacher** — те же возможности, что у студента (отдельных «учительских» эндпоинтов нет; роль влияет на профиль и отображение).
- **admin** — полный доступ ко всему через `/api/admin/*` и ко всем модераторским действиям каталога.

### Подроль «староста» (`User.is_group_head` + `User.stream_id`)
Не отдельная роль, а флаг поверх студента. Даёт права **модератора каталога в
пределах своего потока** (`stream_id`). Назначается только админом
([admin.py](../api/routers/admin.py) `set_group_head`, и только студенту).

### Ключевые проверки прав (зависимости)
| Функция | Правило |
|---------|---------|
| `require_admin` | пропускает только `role == "admin"`, иначе 403 |
| `require_catalog_moderator` | admin **ИЛИ** (`is_group_head` И `stream_id is not None`); иначе 403 |
| `can_moderate_stream(user, stream_id)` | admin → всегда `True`; староста → `True` только если `user.stream_id == stream_id`; иначе `False` |

> **Принцип скоупинга:** админ видит/правит все потоки; староста — **только свой**.
> В роутерах это выражено двумя способами: либо через `can_moderate_stream(...)`,
> либо явным `if moderator.role != "admin": stmt.where(... == moderator.stream_id)`
> в списках (фильтрация выдачи) и `if moderator.stream_id != item.stream_id: 403`
> в операциях над конкретным объектом.

### Право самостоятельного выбора роли (`User.can_choose_role`)
Одноразовый флаг. Если `True`, пользователь может один раз сменить себе роль через
`PUT /api/users/me/role`; после смены флаг сбрасывается в `False` (см. §3).

---

## 2. Аккаунт: регистрация, вход, сессии, блокировки

Источник: [api/routers/auth.py](../api/routers/auth.py), [api/auth.py](../api/auth.py),
[api/dependencies.py](../api/dependencies.py).

### Регистрация `POST /api/auth/register`
1. Проверка уникальности email → иначе **409**.
2. **Логин генерируется автоматически** (`_generate_login`): берётся часть email до
   `@`, очищается до `[a-zA-Z0-9._-]`, добавляется `_` + 4 случайные цифры. Если
   префикс < 2 символов → `user`. `_unique_login` делает до 10 попыток подобрать
   уникальный (иначе 500).
3. При `stream_id` — проверка существования потока.
4. Создаётся `User` (роль student/teacher) + соответствующий профиль
   (`StudentProfile` или `TeacherProfile`) с переданными полями.
5. Выдаётся JWT, ставится httpOnly cookie `mindesync_token`, в ответе
   `generated_login` (показывается пользователю — это его логин для входа).

### Вход `POST /api/auth/login`
- Поиск по email (не удалён) → `verify_password` (bcrypt). Неверно → **401**
  «Неверный логин или пароль».
- **Проверка блокировки с авто-разблокировкой**: если `is_active == False`, но
  `blocked_until` уже прошёл — аккаунт автоматически разблокируется и вход
  проходит; иначе **403** с деталями `{message, reason, blocked_until}`.
- Обновляется `last_login_at`, выдаётся токен + cookie.

### Сессии и токены
- JWT HS256, payload `{sub, role, exp, jti}`, срок `ACCESS_TOKEN_EXPIRE_MINUTES`
  (24 ч по умолчанию).
- **Передача:** заголовок `Authorization: Bearer` (приоритет) ИЛИ cookie (fallback).
- **`GET /api/auth/refresh`**: читает cookie → проверяет валидность/не-отозванность →
  **ротация токена**: старый `jti` отзывается, выдаётся новый. Используется фронтом
  при перезагрузке страницы (токен в памяти, не в localStorage).
- **`POST /api/auth/logout`**: кладёт `jti` в Redis-блэклист (`revoked:{jti}` с TTL)
  и удаляет cookie. Без Redis отзыв не работает (но запрос не падает).
- На каждом защищённом запросе `get_current_user` проверяет: токен валиден → не
  отозван → пользователь существует и не удалён → активен (с той же
  авто-разблокировкой по `blocked_until`).

### Блокировка (админ)
`POST /api/admin/users/{id}/block` ([admin.py](../api/routers/admin.py)):
- `duration_minutes` задаёт `blocked_until = now + N минут`; если не указан →
  `blocked_until = None` = **бессрочно**.
- Ставит `is_active=False`, `blocked_reason/by/at`, пишет запись в `admin_actions`.
- Нельзя заблокировать самого себя (**400**).
- `unblock` обнуляет все поля блокировки и `is_active=True`.

---

## 3. Профиль, роль, поток

Источник: [api/routers/users.py](../api/routers/users.py).

- **`PUT /api/users/me`** — обновление профиля; при смене `stream_id` проверяется
  существование потока; обновляются поля профиля студента/преподавателя.
- **`PUT /api/users/me/role`** — смена роли **только если `can_choose_role == True`**
  (иначе 403). После смены `can_choose_role` → `False` (одноразово).
- **`POST /api/users/me/stream`** — создать новый поток и привязать к себе:
  - Имя нормализуется (`upper()`) и проверяется регэкспом `^[А-ЯA-ZЁ]+\d{2}$`
    (формат «БВТ24»: заглавные буквы + 2 цифры) → иначе 400.
  - Если поток с таким именем уже есть → **409** (нужно выбрать из списка).
  - Проверяются факультет и направление (направление должно принадлежать факультету).
  - Создаётся `Stream`, `user.stream_id` присваивается.
- **`POST /api/users/me/password`** — смена пароля (проверяется текущий).
- **Аватар**: эмодзи (`PUT/DELETE /me/avatar-emoji`) или файл
  (`POST /me/avatar`: только JPEG/PNG/WebP, ≤ 5 MB; сохраняется в
  `/data/avatars/{user_id}.ext`, `avatar_url` = относительный путь).

---

## 4. Лекция: жизненный цикл и права

Источник: [api/routers/lectures.py](../api/routers/lectures.py).

### Статусы лекции (`Lecture.status`, enum `LectureStatus`)
```
processing ──(воркер прислал транскрипт)──► ready
   ▲                                          │
   └──────────(re-transcribe)─────────────────┘
error  — зарезервирован (в основном потоке не выставляется)
```
- Создаётся в `processing` (и при `POST /api/lectures/`, и при загрузке аудио).
- Переходит в `ready`, когда воркер успешно прислал результат
  (`/api/worker/result` ставит `Lecture.status = ready`, см. §5).
- `re-transcribe` сбрасывает лекцию обратно в `processing`.

### Матрица прав на лекцию (хелперы в lectures.py)
| Действие | Правило (функция) |
|----------|-------------------|
| **Чтение** (`get`, notes, task-status) | `_can_read_lecture`: владелец **ИЛИ** `is_public` **ИЛИ** есть `catalog_item` (опубликована) |
| **Редактирование метаданных / удаление** | `_check_owner_or_catalog_moderator`: владелец **ИЛИ** (опубликована И `can_moderate_stream`) |
| **Загрузка аудио / транскрибация / apply-filter** | `_check_owner`: **только владелец** |
| **Сохранить текст** (`save-text`) | `_can_save_text_in_lecture`: **admin** ИЛИ (`is_group_head` И опубликована И `can_moderate_stream`). Владелец-студент НЕ может сам сохранять текст в опубликованную лекцию — это право модератора |
| **Генерация/правка заметок** | `_check_owner_or_catalog_moderator` |

> Эндпоинт `GET /api/lectures/{id}/save-text-permission` возвращает `{can_save}` —
> фронт по нему показывает/прячет кнопку сохранения.

### Удаление
Всё мягкое: `is_deleted=True` + `deleted_by/at`. Дочерние сущности при чтении
фильтруются по `is_deleted == False`. Физически файлы аудио удаляет фоновый
cleanup-цикл по TTL (см. §13).

### Две точки входа загрузки аудио
1. **One-shot** `POST /api/transcribe/upload` ([transcribe.py](../api/transcribe.py)):
   за один вызов создаёт `Lecture` + `AudioFile` + `TranscriptionTask`. Лимит 100 МБ,
   формат из белого списка. Используется «Транскрайбером» в UI.
2. **Структурный путь** ([lectures.py](../api/routers/lectures.py)):
   `POST /api/lectures/` → `POST /{id}/audio` (создаёт AudioFile + Task) →
   `POST /{id}/transcribe` (ставит ещё одну Task на последний аудиофайл).
- В обоих случаях `audio_expires_at = now + 7 дней`.

---

## 5. Транскрибация: конечный автомат очереди

Источник: [api/routers/worker.py](../api/routers/worker.py) (сервер),
[worker/worker.py](../worker/worker.py) (клиент), recovery-цикл в
[api/app.py](../api/app.py).

### Состояния `TranscriptionTask.status` (enum `TranscriptionTaskStatus`)
```
                  ┌──────────────────────────────────────────┐
                  │                                          │
  (создана) → pending ──/worker/next──► processing ──/result──► completed
                  ▲                        │  │
                  │                        │  └──/error & retry_count>=3──► failed
                  └──/error & retry<3──────┘
                  └──recovery loop (stale heartbeat)──┘
```
- **Создание**: задача рождается в `pending` (при загрузке аудио, `transcribe`,
  `re-transcribe`, `transcribe/upload`).
- **Выдача воркеру** `GET /api/worker/next`: выбирает самую старую `pending` через
  **`SELECT ... FOR UPDATE SKIP LOCKED`** (два воркера никогда не возьмут одну
  задачу), переводит в `processing`, проставляет `worker_name/id`, `started_at`,
  `last_heartbeat_at`.
- **Heartbeat** `POST /api/worker/heartbeat` (каждые ~20 сек) обновляет
  `last_heartbeat_at` (только если задача принадлежит этому воркеру).
- **Успех** `POST /api/worker/result/{id}`: создаёт `Transcription`
  (`raw_text`, `whisper_model`, `language`, `processing_time`), задача → `completed`
  (`completed_at`), а **лекция → `ready`**.
- **Ошибка** `POST /api/worker/error/{id}`: `retry_count += 1`; если `>= 3` →
  `failed`; иначе → `pending` (обнуляются `worker_name/id`, `started_at`) — задача
  вернётся в очередь. Ответ содержит `will_retry`.
- **Защита от зависаний** (recovery loop, каждые 5 мин в [app.py](../api/app.py)):
  задачи в `processing`, у которых `last_heartbeat_at` (или `started_at`) старше
  30 мин: при `retry_count >= 3` → `failed`, иначе → `pending` (повторная попытка).
- **Принадлежность**: `download`/`result`/`error` проверяют, что задача
  принадлежит запросившему воркеру (`worker_name`), иначе 403.

> Статус `error` в enum присутствует, но в этом потоке не используется — ошибки
> идут через `pending`(retry)/`failed`.

`GET /api/worker/status` и `GET /api/admin/worker-stats` возвращают счётчики по
статусам + список активных воркеров (различные `worker_name` среди `processing`).

---

## 6. AI-фильтрация транскрипта

«Фильтрация» = очистка распознанного текста через `TranscriptionFilter`
(ml-слой): исправление ошибок ASR, удаление слов-паразитов, пунктуация. Результат
пишется в `Transcription.processed_text`, ставится `is_ai_filtered=True`, `filtered_at`.

Есть **два пути** запуска:

### A. Прямой (для своей лекции) — `POST /api/lectures/{id}/apply-filter`
- Только владелец (`_check_owner`). Синхронно фильтрует `raw_text` →
  `processed_text`. Без модерации.

### B. С модерацией (для опубликованной лекции) — заявка `LectureAiFilterRequest`
Применяется, когда лекция уже в каталоге. Состояние заявки — **два измерения**:
`status` (pending/approved/rejected/failed) + строковый `generation_status`
(idle/processing/completed/failed).

**Создание** `POST /api/lectures/{id}/filter-request`:
- Требует: доступ к лекции, лекция **опубликована** (`catalog_item is not None`),
  есть транскрипция. Если уже отфильтрована и `regenerate != True` → **409**.
- Запрещены дубли: 409 если уже есть `pending`-заявка или `approved+processing`.
- Создаётся заявка `pending` / `generation_status=idle`.

**Одобрение** `POST /api/lectures/filter-requests/{id}/approve` (модератор потока):
- Допустимо из `pending` **или** `failed`. Ставит `approved` + `processing`,
  запускает фоновую `_run_ai_filter_job`, которая выполняет фильтрацию и переводит
  `generation_status` в `completed` или `failed` (с `generation_error`).

**Отклонение** `.../reject`: требует непустой `review_comment` → `rejected`.

**Список** `GET /api/lectures/filter-requests` (модератор): джойнит только
опубликованные лекции; староста видит только свой поток. Фильтр `?status=` мапит
составные состояния (например `approved`+`completed` = «approved», `approved`+
`processing` = «processing»).

---

## 7. Генерация учебных материалов (заметок)

Материал = `LectureNote` (одна запись на пару `lecture_id` + `mode`, уникальность
гарантируется БД). Режимы генерации обрабатываются ML-процессором (см.
[AI_CONTEXT.md](AI_CONTEXT.md) §9). Есть **два пути**:

### A. Прямая генерация (для своей/модерируемой лекции)
`POST /api/lectures/{id}/notes/generate` ([lectures.py](../api/routers/lectures.py)):
- Права: `_check_owner_or_catalog_moderator`. Нужен непустой текст транскрипции.
  Для `expand_topic` обязательна `topic`.
- Запускается фоновая задача (`BackgroundTasks` + in-memory словарь
  `_note_gen_jobs`): вызывает процессор, **upsert** `LectureNote` по `mode`.
- Прогресс — `GET /api/lectures/{id}/notes/generate/{job_id}` (статусы
  `pending → processing → done|failed`); опрашивать может **только инициатор**
  (сверка `user_id`).
- ⚠️ Реестр задач — в памяти процесса: статусы теряются при рестарте и не
  шарятся между инстансами (см. §13).
- **Параллельные генерации.** Каждый вызов создаёт отдельный `job_id` и отдельную
  фоновую задачу, поэтому **разные** режимы (и/или разные лекции) генерируются
  одновременно. Ограничение одно: **одна задача на пару (лекция, режим)** — повтор
  того же режима не запускается параллельно (на фронте режим в работе убран из меню
  «Добавить», и `LectureNote` всё равно уникален по `lecture_id+mode`). Фронт
  ([LecturesSection.tsx](../src/components/account/LecturesSection.tsx)) хранит список
  активных задач и опрашивает их одним интервалом параллельно (раньше второй запуск
  сбрасывал отслеживание первого — исправлено).
- Каждый старт прямой генерации списывает слот квоты (см. §7А).
- Ручной upsert/правка/удаление заметок: `POST/DELETE /api/lectures/{id}/notes...`.

### B. Через каталог с модерацией — см. §10.

---

## 7А. Лимиты генераций (подписки)

Источник: [api/quota.py](../api/quota.py), модель `GenerationUsage` в
[api/models.py](../api/models.py), точки списания в
[lectures.py](../api/routers/lectures.py) и [ml_endpoints.py](../api/ml_endpoints.py).

Цель — ограничить расход платного LLM-API: пользователь генерирует материал в
**своих** лекциях не безлимитно, а в пределах тарифа.

### Два независимых пула (скользящее окно 30 дней)
| Пул (`GenerationUsageKind`) | Что входит | free | pro |
|------------------------------|-----------|------|-----|
| `generation` | генерация заметок (`notes/generate`, все режимы) **+** AI-фильтр личной лекции (`apply-filter`) — общий счётчик | 5 | 15 |
| `explain` | объяснение фрагмента (`/api/ml/explain`) | 10 | 30 |

Лимиты настраиваются через env (`QUOTA_GEN_FREE/PRO`, `QUOTA_EXPLAIN_FREE/PRO`).

### Как считается остаток
Каждый израсходованный слот = одна строка в `generation_usage`
(`user_id`, `kind`, `lecture_id?`, `mode?`, `created_at`). Использовано за период =
`COUNT(*)` строк за последние **30 дней** (настоящее скользящее окно, не
календарный месяц). `next_reset_at` = время самого старого расхода в окне + 30 дней
(когда освободится ближайший слот). Строки старше 35 дней подчищает фоновый
`_usage_cleanup_loop` ([app.py](../api/app.py), раз в сутки).

### Когда слот списывается, а когда нет
- Списывается **только** при генерации в собственной личной лекции
  (`lecture.uploaded_by == user.id`) и для `apply-filter`/`explain` инициатором.
- **Не** списывается: у `admin` (безлимит), при модераторской генерации в чужой
  опубликованной лекции, и на пути «через каталог с модерацией» (§10 — там барьер
  это апрув старосты).
- **Резерв и возврат:** слот пишется **до** запуска генерации (защита от спама
  параллельными запросами). Если генерация провалилась — слот **возвращается**
  (`quota.refund`): для синхронного `apply-filter` сразу, для фоновой
  `notes/generate` — в `_run_note_gen_job` при `failed`, для `explain` — в ветке
  ошибки. **Провалом считается не только исключение (ошибка LLM/API), но и пустой
  ответ модели** (HTTP 200 с пустым текстом) — слот тоже возвращается, чтобы не
  списывать за бесполезный результат. Регенерация считается новым расходом.
  *Граничный случай:* если процесс упадёт между резервом слота и запуском фоновой
  задачи `notes/generate`, слот останется списанным (задача не успеет вернуть его).

### Тариф (`User.subscription_tier` = `free|pro`)
- Назначается **только админом**: `PUT /api/admin/users/{id}/subscription`
  (body `{tier, expires_at?}`), пишется в `admin_actions` (`set_subscription`).
  Фронт-админка по умолчанию выдаёт `pro` на 30 дней.
- `subscription_expires_at` имеет смысл для `pro`; при истечении срока
  `effective_tier` трактует пользователя как `free` (см. [quota.py](../api/quota.py)).
- ⚠️ **Время — наивный UTC.** Колонка `TIMESTAMP WITHOUT TIME ZONE`, как и весь
  проект (`datetime.utcnow()`). Клиент шлёт tz-aware ISO (`toISOString()` с `Z`),
  поэтому роут приводит `expires_at` к наивному UTC перед записью — иначе asyncpg
  падает с `DataError` на записи tz-aware в наивную колонку (этот баг был — 500 при
  выдаче Pro — и исправлен в [admin.py](../api/routers/admin.py)).
- При исчерпании лимита эндпоинты отвечают **429** с телом
  `{code: "quota_exceeded", kind, tier, limit, used, remaining, next_reset_at}`.
- Текущий остаток фронт берёт из `GET /api/users/me/quota`.

---

## 8. Каталог дисциплин: иерархия и автоструктуры

Источник: [api/routers/catalog.py](../api/routers/catalog.py).

### Иерархия справочников
```
Faculty (факультет)
  └── Direction (направление)
        └── Stream (поток/группа, напр. «БВТ24»)
              ├── CatalogSemester     (курс + семестр: winter/spring)
              ├── CatalogDisciplineNode (дисциплина в курсе+семестре)
              ├── CatalogLecturerTemplate (шаблоны лекторов потока)
              └── LectureCatalogItem  (опубликованные лекции)
Direction
  └── CatalogDisciplineTemplate (шаблоны дисциплин направления)
```

### Кто что может (права на CRUD)
| Сущность | Создание/изменение/удаление |
|----------|------------------------------|
| Faculty, Direction, Stream, Semester (course) | **только admin** (`require_admin`) |
| DisciplineNode, шаблоны дисциплин/лекторов, bulk-update, правка/удаление items, publish, approve/reject заявок | **модератор** (`require_catalog_moderator`), со скоупом по своему потоку/направлению |

### Автоматические структуры
- **`_ensure_catalog_semesters`**: при создании курса/узла/публикации автоматически
  заводит оба семестра потока — `winter` и `spring` (если их ещё нет).
- **`_ensure_catalog_discipline_node`**: при публикации/правке item'а
  автодобавляет узел дисциплины в (поток, курс, семестр), если отсутствует.

### Удаление с проверкой непустоты (force-семантика)
Удаление faculty/direction/stream/course/discipline-node сначала **считает
зависимый контент** (`_stream_usage_counts`, счётчики items/заявок/пользователей).
Если не пусто и `force=false` → **409 `catalog_node_not_empty`** с телом
`{code, message, counts}` (фронт показывает «Удалить вместе со всем содержимым?»).
При `force=true` каскадно вызывается `_delete_stream_related_data`, который:
- обнуляет `users.stream_id` и снимает `is_group_head` у затронутых пользователей;
- удаляет catalog items, заявки на публикацию/материалы, шаблоны лекторов,
  семестры и узлы дисциплин этих потоков.

### Списки-«объединения»
`GET /api/catalog/disciplines` и `/lecturers` возвращают объединение: значения из
**шаблонов** + `DISTINCT` фактические значения из опубликованных `LectureCatalogItem`.

### Массовое переименование `POST /api/catalog/bulk-update`
Модератор переименовывает course/semester/discipline сразу у всех подходящих
`LectureCatalogItem` **и** синхронно у `CatalogDisciplineNode`. Скоуп — свой поток.

---

## 9. Публикация лекции в каталог (модерация)

Цель: студент просит опубликовать свою лекцию в общий каталог; модератор потока
(староста/админ) одобряет, и появляется `LectureCatalogItem`.

### Поток (happy path)
```
Студент: POST /api/catalog/requests        → LecturePublicationRequest (pending)
Модератор: POST /api/catalog/requests/{id}/approve
            → _ensure_catalog_item(...) создаёт/обновляет LectureCatalogItem
            → авто-семестры + узел дисциплины
            → request.status = approved
(или) Модератор: .../reject (нужен review_comment) → rejected
```

### Детали
- **Создание** `POST /api/catalog/requests`: только владелец лекции
  (`uploaded_by == user.id`, иначе 403); лекция не удалена; `discipline` по
  умолчанию = `subject` или `title`, если не передана. Заявка `pending`.
- **`my-lecture-statuses`**: возвращает по каждой лекции пользователя **последнюю**
  заявку (статус + комментарий ревью) — для отображения значка в «Моих лекциях».
- **Одобрение** (модератор целевого потока, `can_moderate_stream`): модератор может
  переопределить поля (дисциплина, лектор, курс, семестр, номер, год, название
  лекции) и даже **целевой поток** (`body.stream_id`). `_ensure_catalog_item`
  делает upsert `LectureCatalogItem` (1:1 с лекцией — повторное одобрение обновляет
  существующую запись), фиксирует `published_by` и `source_request_id`.
- **Отклонение**: обязателен `review_comment` (иначе 400).
- **Ручная публикация** `POST /api/catalog/publish`: модератор сразу создаёт
  catalog item без заявки (`source_request_id = None`).

После публикации лекция становится доступна на чтение всем (через `catalog_item`),
а модератор потока получает права на её текст/заметки/материалы (см. §4).

---

## 10. Заявки на генерацию материалов (модерация)

Аналог §9, но для генерации учебных материалов по **уже опубликованной** лекции.
Сущность — `LectureMaterialGenerationRequest`. Состояние двумерное: `status`
(pending/approved/rejected) + `generation_status` (idle/processing/completed/failed).
Публичный статус собирается `_public_material_request_status`.

### Соответствие режимов (`MATERIAL_MODE_TO_ML_MODE`)
| Режим заявки (`mode`) | ML-режим | Что делает |
|------------------------|----------|-----------|
| `summary` | `summarize` | конспект |
| `detailed_notes` | `detailed_notes` | подробный конспект |
| `qa` | `generate_questions` | вопросы |
| `flashcards` | `cheat_sheet` | шпаргалка |
| `mindmap` | `extract_terms` | термины |
| `ai_filter` | `ai_filter` | **не генерация заметки, а чистка транскрипта** (особый случай) |

### Создание `POST /api/catalog/material-requests`
- Режим должен быть в карте выше; лекция опубликована; `stream_id` заявки **совпадает**
  с потоком лекции в каталоге (иначе 400).
- Для `ai_filter`: нужна транскрипция; если уже отфильтрована и не `regenerate` → 409.
- Для остальных: если заметка по этому `mode` уже есть и не `regenerate` → 409.
- Анти-дубли: 409 если есть `pending`, либо `approved+processing`, либо
  `approved+failed` по этому режиму (последнюю должен сначала разобрать модератор).
- `is_regeneration`/`regeneration_reason` сохраняются, если `regenerate=true`.

### Одобрение `POST /api/catalog/material-requests/{id}/approve`
- Разрешено из `pending` **или** «approved+failed» (`_is_material_request_failed`).
- Проверяет, что лекция всё ещё принадлежит потоку заявки.
- Ставит `approved`+`processing`, запускает фоновую `_run_material_generation_job`
  → `_generate_note_for_mode`:
  - для `ai_filter` — фильтрует транскрипт (как в §6),
  - иначе — `processor.process_text(text, ml_mode)` и **upsert** `LectureNote`.
  - по завершении `generation_status` = `completed`/`failed` (+ `generation_error`).
- **Отклонение**: обязателен `review_comment` → `rejected`.

### Списки
- `GET /material-requests/my` — заявки пользователя.
- `GET /material-requests/lecture?lecture_id=` — по лекции, **последняя на каждый режим**.
- `GET /material-requests` — модераторский список (скоуп по потоку для старосты),
  фильтр `?status=` с маппингом составных состояний.

---

## 11. Доски: владение, шаринг, коллаборация

Источник: [api/routers/boards.py](../api/routers/boards.py). Доска = Excalidraw-JSON
в `Board.data`.

### Владение и доступ
- `GET /api/boards` — **свои** доски (`owner_id == me`).
- `GET /api/boards/recent` — недавно открытые **чужие** доски (через `BoardVisit`).
- `POST /api/boards` — создать (владелец = текущий пользователь).
- `GET /api/boards/{id}` — владелец **или** публичная (`_get_accessible_board`).
- `GET /api/boards/public/{token}` — доступ по share-токену (требует `is_public`),
  фиксирует визит.
- `DELETE /api/boards/{id}` — **только владелец** (`_get_owned_board`).

### Режим редактирования (`_can_edit_board`)
`True`, если: пользователь — владелец, **или** доска `is_public` и
`share_mode == "edit"`. Менять `is_public` через `PUT` может только владелец.

### Шаринг
- `POST /api/boards/{id}/share` (владелец): если токена нет — генерирует
  `secrets.token_urlsafe(32)`; ставит `is_public=True`, `share_mode = body.mode`
  (`view`/`edit`).
- `DELETE /api/boards/{id}/share`: сбрасывает токен, `is_public=False`,
  `share_mode="view"`.

### Учёт визитов (`BoardVisit`)
При открытии чужой доски создаётся/обновляется запись (уникальна по board+user):
`last_opened_at`, `last_access_mode`. Это и есть «недавние». Удалить из недавних —
`DELETE /api/boards/recent/{id}`.

### Realtime-коллаборация `WS /api/boards/{board_id}/ws?token=<jwt>`
1. Доска не найдена → закрытие `4404`.
2. Аутентификация по `token`: если пользователь может редактировать
   (`_can_edit_board`) → `can_edit=True`. Если доска **не публичная** и прав нет →
   закрытие `4403`. Если публичная, но не редактор → подключение **только на чтение**
   (получает обновления, свои `update` игнорируются).
3. Сообщения `type:"update"` от редакторов: снапшот сохраняется в Postgres
   (`_save_board_data`, fire-and-forget) и рассылается остальным.
4. **Масштабирование**: если есть Redis — рассылка идёт через pub/sub канал
   `boards:{id}` (работает между инстансами); иначе — только локальный broadcast
   по комнатам `_ws_rooms` в памяти процесса.

---

## 12. Администрирование

Источник: [api/routers/admin.py](../api/routers/admin.py). Все эндпоинты —
`require_admin`.

### Жёсткое удаление пользователя `DELETE /api/admin/users/{id}`
**Это hard delete с переназначением контента**, не мягкое:
- Нельзя удалить самого себя (400).
- Находит системного админа (`login == "admin"`; fallback — любой другой админ;
  если нет — 400 с просьбой создать пользователя `admin`).
- **Переназначает** все лекции удаляемого на системного админа; обнуляет nullable-FK
  (`deleted_by`, `blocked_by`) и переназначает `admin_actions.admin_id`.
- Затем физически `DELETE FROM users` (профиль удаляется каскадом БД).

### Прочие операции
- **Блокировка/разблокировка** — см. §2.
- **Назначение старосты** `PUT /users/{id}/group-head`: только для **студента**;
  при назначении обязателен существующий `stream_id`.
- **Удаление контента** (`lectures`/`audio`/`transcriptions`) — **мягкое** + запись
  в `admin_actions`. Правка лекции — без проверки владельца.
- **Аудит** `GET /actions` — лог из `admin_actions` (действия: `block_user`,
  `unblock_user`, `delete_lecture`, `edit_lecture`, `delete_audio`,
  `delete_transcription`, `delete_avatar`).
- **Статистика** `GET /stats` — счётчики пользователей по ролям/статусам, лекций,
  аудио, транскрипций, досок, размера очереди (pending+processing).
- **Очередь** `GET /queue` — листинг файлов в `DATA_DIR/audio_queue` на диске.
- **Списки с фильтрами** — `/users`, `/lectures` (вкл. `include_deleted`),
  `/lectures/audio/with-expiry` (с расчётом `days_left`/`expired`), `/boards`.

> ⚠️ Действия **старост** (модерация каталога, фильтр-заявки) в `admin_actions`
> **не логируются** — аудит ведётся только для действий через admin-роутер.

---

## 13. Сквозные правила и подводные камни

- **Мягкое удаление везде.** У `User`, `Lecture`, `AudioFile`, `Transcription` есть
  `is_deleted`. Любой бизнес-запрос фильтрует `is_deleted == False`. Исключение —
  hard delete пользователя (§12) и физические `delete()` в каталоге при `force`.
- **TTL аудио — 7 дней.** `audio_expires_at` ставится при загрузке; фоновый
  `_audio_cleanup_loop` ([app.py](../api/app.py), раз в час) удаляет файл с диска и
  ставит `is_deleted=True`. В списках «Мои лекции» отсутствующий `audio_expires_at`
  бэкфилится (`created_at + 7 дней`).
- **Recovery-цикл** возвращает зависшие задачи транскрибации (§5).
- **Конфликты (409) как защита от гонок/дублей.** Заявки на фильтрацию и материалы
  не допускают параллельных `pending`/`processing` по одному режиму; повторная
  публикация — upsert (1:1 лекция↔catalog_item).
- **In-memory реестры — не для прод-кластера.** `_note_gen_jobs` (§7) и `_ws_rooms`
  (§11) живут в памяти процесса: при нескольких воркерах uvicorn состояние не
  шарится (для досок это компенсируется Redis pub/sub, для note-job — нет; статус
  job виден только на том инстансе, что его принял).
- **Два измерения статуса у заявок.** И у фильтр-заявок, и у материал-заявок:
  модерация (`status`) отдельно от хода генерации (`generation_status`). «Провал
  генерации» (`approved`+`failed`) повторно модерируется (можно одобрить заново или
  отклонить).
- **Скоуп старосты.** Любой модераторский список фильтруется его `stream_id`; любая
  операция над объектом проверяет принадлежность потоку. Админ — без ограничений.
- **Право на текст опубликованной лекции** переходит к модератору потока, а не
  остаётся у студента-владельца (§4).

---

## 14. Справочник статусов

### `LectureStatus`
| Статус | Значение |
|--------|----------|
| `processing` | создана / идёт (пере)транскрибация |
| `ready` | есть результат транскрибации |
| `error` | зарезервирован (в основном потоке не используется) |

### `TranscriptionTaskStatus`
| Статус | Значение |
|--------|----------|
| `pending` | в очереди, ждёт воркера |
| `processing` | взята воркером |
| `completed` | успешно завершена |
| `failed` | исчерпаны попытки (`retry_count >= 3`) |
| `error` | в enum есть, в потоке не используется |

### `LectureAiFilterRequestStatus` × `generation_status`
| status | generation_status | смысл |
|--------|-------------------|-------|
| `pending` | `idle` | ждёт модерации |
| `approved` | `processing` | одобрена, идёт фильтрация |
| `approved` | `completed` | фильтрация выполнена |
| `approved` | `failed` | ошибка генерации (можно перемодерировать) |
| `rejected` | `idle` | отклонена (есть `review_comment`) |

### `MaterialGenerationRequestStatus` × `generation_status`
Та же двумерная модель, что и у фильтр-заявок (см. §10). Публичный статус собирает
`_public_material_request_status`: `pending`/`rejected` напрямую, иначе по
`generation_status` → `processing`/`completed`/`failed` (по умолчанию `approved`).

### `PublicationRequestStatus`
| Статус | Значение |
|--------|----------|
| `pending` | ждёт модерации |
| `approved` | опубликована (создан `LectureCatalogItem`) |
| `rejected` | отклонена (обязателен `review_comment`) |

### `UserRole`
`student` / `teacher` / `admin` (+ ортогональный флаг `is_group_head` со скоупом
по `stream_id`).

---

## 15. Валидация входных данных (Pydantic)

Источник: [api/schemas.py](../api/schemas.py). Это **первый слой валидации** —
отрабатывает до бизнес-логики роутера; нарушение даёт **422 Unprocessable Entity**.
Бизнес-проверки из разделов выше (права, дубли, существование) идут **после** и
дают 400/403/404/409. Здесь — только ограничения формата/длины полей запросов.

### Auth / профиль
| Схема | Поле | Ограничение |
|-------|------|-------------|
| `RegisterRequest` | `email` | валидный email (`EmailStr`) |
| | `password` | 6–128 символов |
| | `role` | строго `student` или `teacher` (regex) — **через регистрацию нельзя стать admin** |
| | `full_name` | ≤ 100 |
| | `group_name` | ≤ 20 |
| | `course` | целое 1–6 |
| | `faculty` | ≤ 100 |
| | `department`/`position`/`academic_degree` | ≤ 150 / 100 / 100 |
| `LoginRequest` | `email`, `password` | **без ограничений** (email — обычная строка, не `EmailStr`) |
| `UserRoleUpdateIn` | `role` | `student`/`teacher` (regex) |
| `UserUpdateRequest` | те же поля профиля | те же лимиты, что при регистрации; `email` — `EmailStr` |
| `StreamCreateForUserIn` | `stream_name` | 3–20 (доп. regex `^[А-ЯA-ZЁ]+\d{2}$` проверяется уже в роутере, см. §3) |
| | `faculty_id`, `direction_id` | обязательные UUID |
| `SetEmojiRequest` | `emoji` | 1–10 |
| `ChangePasswordRequest` | `new_password` | 6–128; `current_password` — без лимита |

### Лекции / заметки
| Схема | Поле | Ограничение |
|-------|------|-------------|
| `LectureCreateRequest` | `title` | 1–300 (обязательно) |
| | `subject` | ≤ 100; `description` — без лимита |
| `LectureUpdateRequest` | `title` | ≤ 300 (опционально); `subject` ≤ 100 |
| `NoteGenerateIn` | `mode` | 1–50 (обязательно); `topic` ≤ 300 |
| `LectureNoteIn` | `mode`, `content` | **без ограничений длины** |
| `SaveTextIn` | `text` | **без ограничений длины** |
| `LectureAiFilterRequestCreateIn` | `regenerate` | bool (по умолч. false) |
| `LectureAiFilterRequestModerateIn` | `review_comment` | ≤ 500 (на reject непустота проверяется в роутере) |

### Каталог / публикация / материалы
| Схема | Поле | Ограничение |
|-------|------|-------------|
| `PublicationRequestCreateIn` | `lecture_id`, `stream_id` | обязательные UUID |
| | `discipline` | 1–150 (опционально); `comment` ≤ 500 |
| | `course_text`/`lecture_number_text`/`study_year_text` | ≤ 50; `semester_text` ≤ 20 |
| `PublicationRequestModerateIn` | `lecture_title` | 1–300; `discipline` 1–150; `lecturer_name` ≤ 150; `review_comment` ≤ 500 |
| `ManualCatalogPublishIn` | `discipline` | 1–150 (**обязательно**); остальные текстовые — те же лимиты |
| `CatalogItemUpdateIn` | `lecture_title` | 1–300; `discipline` 1–150; прочие — те же лимиты |
| `MaterialGenerationRequestCreateIn` | `mode` | 1–50 (обязательно); `regeneration_reason` ≤ 500 |
| `MaterialGenerationRequestModerateIn` | `review_comment` | ≤ 500 |
| `CatalogBulkUpdateIn` | `*_text` / `*discipline` | ≤ 50 / ≤ 20 / ≤ 150 (все опциональны) |
| `Faculty/Direction/Stream*CreateIn`, `*UpdateIn` | `name` | 1–150 (обязательно) |
| `CatalogDisciplineTemplateCreateIn` / `LecturerTemplateCreateIn` | `name` | 1–150 |
| `CatalogSemesterCreateIn` | `course_text` | 1–50 |
| `CatalogDisciplineNodeCreateIn` | `course_text` | 1–50; `semester_key` 1–10; `name` 1–150 |

> Замечание: значения вроде `course_text`/`semester_text` — **свободные строки**
> (валидируется только длина), а не enum. Семантика семестра (`winter`/`spring`)
> навязывается логикой `_ensure_catalog_semesters`, а не схемой.

### Воркер
| Схема | Поле | Ограничение / дефолт |
|-------|------|----------------------|
| `WorkerResultIn` | `raw_text` | обязательно; `language="ru"`, `processing_time=0.0`, `whisper_model="base"`, `device_used` опц. |
| `WorkerErrorIn` | `error_message` | обязательно |
| `WorkerHeartbeatIn` | `task_id` | опционально (UUID) |

### Админ / доски
| Схема | Поле | Ограничение |
|-------|------|-------------|
| `BlockUserRequest` | `reason` | 1–300 (**обязательно**); `duration_minutes` — целое > 0 или `null` (бессрочно) |
| `DeleteContentRequest` | `reason` | ≤ 300 (опционально) |
| `AdminLectureUpdateRequest` | `title` | 1–300; `subject` ≤ 100 |
| `AdminSetGroupHeadIn` | `is_group_head` | bool; `stream_id` опц. (обязательность при назначении — в роутере, §12) |
| `BoardCreate` | `title` | ≤ 255 (по умолч. «Новое полотно») |
| `BoardUpdate` | `title` | ≤ 255; `data`/`is_public` опц. |
| `BoardShareRequest` | `mode` | строго `view` или `edit` (regex) |

### Наблюдения, важные для поведения
- **`LoginRequest` не валидируется** — пустой/кривой email не отсекается схемой,
  проверка идёт бизнес-логикой (поиск по email → 401).
- **`role` при регистрации ограничен** `student|teacher` — стать `admin` через
  публичный API нельзя (только через скрипты seed/`create_admin` или другого админа).
- **`SaveTextIn.text` и `LectureNoteIn.content` не ограничены по длине** на уровне
  схемы — лимит только у типа колонки БД (`Text`, фактически без жёсткого предела).
- **Текстовые поля каталога — свободные строки** с лимитом длины; они не
  привязаны к enum, поэтому, например, `semester_text` может содержать произвольное
  значение (консистентность поддерживается логикой, а не валидатором).
