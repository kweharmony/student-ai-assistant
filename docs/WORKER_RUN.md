# Запуск воркера

Это краткая инструкция для Windows. Воркер лучше запускать из `worker/.venv`, а не из системного Python.

## 1. Убедиться, что venv существует

Если виртуального окружения ещё нет, создайте его из папки `worker/`:

```powershell
python -m venv .venv
```

## 2. Установить зависимости

Сначала обновите инструменты установки:

```powershell
.\.venv\Scripts\python -m pip install --upgrade pip setuptools wheel
```

Потом установите зависимости воркера:

```powershell
.\.venv\Scripts\python -m pip install -r requirements.txt
```

Если нужна поддержка NVIDIA GPU, установите PyTorch с CUDA-индексом, который работает в этой среде. Для этого проекта у нас подошёл `cu118`:

```powershell
.\.venv\Scripts\python -m pip install --index-url https://download.pytorch.org/whl/cu118 torch torchvision torchaudio
```

## 3. Проверить `config.json`

Файл `worker/config.json` должен содержать:

```json
{
  "SERVER_URL": "https://mindesync.ru",
  "API_KEY": "ваш_ключ",
  "WORKER_NAME": "имя_компьютера",
  "WHISPER_MODEL": "medium",
  "DEVICE": "auto"
}
```

Важно:
- `SERVER_URL` должен указывать на доступный сервер.
- `API_KEY` должен совпадать с ключом в `WORKER_API_KEYS` на сервере.

## 4. Запустить воркер

На Windows PowerShell активация скриптом может быть заблокирована ExecutionPolicy. Поэтому надёжнее запускать воркер напрямую через Python из venv:

```powershell
$env:TCL_LIBRARY='C:\Users\User\AppData\Local\Programs\Python\Python313\tcl\tcl8.6'
$env:TK_LIBRARY='C:\Users\User\AppData\Local\Programs\Python\Python313\tcl\tk8.6'
.\.venv\Scripts\python tray_app.py
```

Если активация разрешена, можно использовать и такой вариант:

```powershell
.\.venv\Scripts\Activate.ps1
python tray_app.py
```

## 5. Проверить, что воркер виден серверу

Сначала проверьте регистрацию воркера:

```powershell
curl -X POST -H "X-Worker-Key: ВАШ_КЛЮЧ_ВОРКЕРА" https://mindesync.ru/api/worker/register
```

Если ключ корректный, сервер вернёт что-то вроде:

```json
{"status":"ok","worker_name":"Del PC"}
```

Потом проверьте статус очереди:

```powershell
curl -H "X-Worker-Key: ВАШ_КЛЮЧ_ВОРКЕРА" https://mindesync.ru/api/worker/status
```

Если `pending` и `processing` равны `0`, воркер работает, но просто сейчас нет задач, поэтому в админке он может не отображаться как активный.

## 6. Если воркер не появляется в админке

Проверьте:
- что сервер реально видит ключ через `/api/worker/register`
- что на сервере в `.env` прописан `WORKER_API_KEYS`
- что у воркера есть задачи в статусе `processing`
- что в логах воркера нет ошибок DNS, сети или `init.tcl`

## Быстрый тест

Если всё настроено, после запуска в трее должен появиться зелёный значок, а в логах будет:

```text
Воркер '...' запущен
Иконка в системном трее запущена
```
