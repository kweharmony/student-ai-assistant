# Technical Summary

This document gives a compact technical overview of the project.

## 1. Stack overview

### Frontend

- React 18
- TypeScript
- TipTap editor
- Tailwind CSS
- Framer Motion
- React Router

### Backend

- FastAPI
- Uvicorn
- SQLAlchemy async
- Alembic migrations
- Pydantic
- PostgreSQL via asyncpg

### Processing

- Whisper for local transcription
- DeepSeek v3.2 via VseLLM-compatible API
- Redis for token invalidation and WebSocket sync
- PDF service with Express, Playwright, and Chromium

## 2. Runtime components

- `api/` - main backend application
- `src/` - frontend SPA
- `worker/` - transcription worker with tray UI
- `pdf-service/` - standalone Markdown to PDF renderer
- `nginx/` - reverse proxy for the Docker deployment

## 3. Data flow

### Transcription

1. User uploads a media file.
2. Backend stores the task and file metadata in PostgreSQL.
3. Worker polls `GET /api/worker/next`.
4. Worker downloads the audio and runs Whisper.
5. Worker posts the transcription result back to the backend.

### AI processing

1. User selects a processing mode.
2. Frontend sends text to the backend ML endpoint.
3. Backend sends a prompt to DeepSeek.
4. Backend returns structured Markdown to the frontend.

### Export

1. Frontend builds or sends the final document content.
2. Backend or PDF service renders the result.
3. The user downloads the file.

## 4. Worker model

The transcription worker is a separate desktop process.

- it maintains its own `worker/.venv`
- it uses tray controls to enable or disable polling
- it sends heartbeat updates while a task is running
- the backend recovery loop returns stale tasks to `pending`

## 5. Deployment modes

### Local development

- `setup.bat` / `setup.sh` prepares dependencies
- `run.bat` / `run.sh` starts backend and frontend
- worker and PDF service are started separately

### Docker

- `docker compose up --build -d` starts the full web stack
- worker is not part of the compose file and must be run separately

## 6. Important config files

- `.env` - root application settings
- `worker/config.json` - worker server URL, API key, model, and device
- `package.json` - frontend dependencies
- `requirements.txt` - backend dependencies
- `pdf-service/package.json` - PDF service dependencies

## 7. Related docs

- [Project Documentation](PROJECT_DOCUMENTATION.md)
- [Features](FEATURES.md)
- [Worker Guide](WORKER_GUIDE.md)
- [CUDA Setup](CUDA_SETUP.md)

