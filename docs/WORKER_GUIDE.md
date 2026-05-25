# Worker Guide

The transcription worker runs on a workstation and processes queued audio tasks with Whisper.

## What the worker does

- polls the backend for pending tasks
- downloads the audio file assigned to the task
- runs Whisper locally on CPU or GPU
- sends the transcription result back to the backend
- sends heartbeat updates while a transcription is running

## Server-side requirements

The backend must expose a valid worker key through `WORKER_API_KEYS` in `.env`.

Example format:

```env
WORKER_API_KEYS=Del PC:worker_key_1,Lab PC:worker_key_2
```

## Worker configuration

The worker reads `worker/config.json`:

```json
{
  "SERVER_URL": "https://mindesync.ru",
  "API_KEY": "your_worker_key",
  "WORKER_NAME": "Your PC name",
  "WHISPER_MODEL": "medium",
  "DEVICE": "auto",
  "POLL_INTERVAL": 30
}
```

## Recommended launch path

Use the detailed Windows guide in [../worker/WORKER_RUN.md](../worker/WORKER_RUN.md).

Short version:

```powershell
cd worker
python -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip setuptools wheel
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python tray_app.py
```

## Tray icon states

- green - worker is enabled and can take new tasks
- gray - worker is paused and will not request new tasks

## Admin visibility

The admin dashboard shows active workers only when there are processing tasks with a worker name assigned. If the queue is empty, `active_workers` may also be empty even though the worker is running.

## Troubleshooting

- `Invalid worker API key` - check that `API_KEY` matches the server-side key exactly
- worker is running but no tasks are taken - check that there are `pending` tasks in the queue and that the tray icon is green
- Windows Tkinter error - set `TCL_LIBRARY` and `TK_LIBRARY` before launching the tray app
- slow transcription - install CUDA-enabled PyTorch if you have an NVIDIA GPU

