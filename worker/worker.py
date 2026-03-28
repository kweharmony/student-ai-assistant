"""
Основной цикл воркера транскрибации.

Логика:
1. Каждые POLL_INTERVAL секунд спрашивает сервер: "Есть задачи?"
2. Если есть — скачивает аудио, транскрибирует, отправляет результат
3. Во время транскрибации каждые 20 секунд отправляет heartbeat
4. При ошибке — сообщает серверу (сервер решит: повторить или отметить failed)
"""

import logging
import os
import tempfile
import threading
import time
from pathlib import Path

import requests

from transcriber import transcribe as do_transcribe

logger = logging.getLogger(__name__)


class TranscriptionWorker:
    def __init__(self, config: dict):
        self.config = config
        self.enabled = True          # флаг вкл/выкл (управляется из трея)
        self.tasks_done_today = 0
        self.current_task_id: str | None = None
        self.device_used: str | None = None  # для отображения в трее

        self._session = requests.Session()
        self._session.headers.update({
            "X-Worker-Key": config["API_KEY"],
            "Content-Type": "application/json",
        })
        self._base_url = config["SERVER_URL"].rstrip("/")

    def run(self):
        """Главный цикл. Запускается в отдельном потоке."""
        logger.info(f"Воркер '{self.config['WORKER_NAME']}' запущен")
        while True:
            if not self.enabled:
                time.sleep(5)
                continue

            try:
                task = self._get_next_task()
            except Exception as e:
                logger.error(f"Ошибка при получении задачи: {e}")
                time.sleep(self.config["POLL_INTERVAL"])
                continue

            if task is None:
                time.sleep(self.config["POLL_INTERVAL"])
                continue

            self._process_task(task)

    # ---------- Private ----------

    def _get_next_task(self) -> dict | None:
        r = self._session.get(f"{self._base_url}/api/worker/next", timeout=15)
        r.raise_for_status()
        return r.json().get("task")

    def _process_task(self, task: dict):
        task_id = task["id"]
        self.current_task_id = task_id
        tmp_path = None

        # Запустить поток heartbeat
        stop_hb = threading.Event()
        hb_thread = threading.Thread(
            target=self._heartbeat_loop,
            args=(task_id, stop_hb),
            daemon=True,
        )
        hb_thread.start()

        try:
            logger.info(f"Задача {task_id}: скачиваю аудио...")
            r = self._session.get(
                f"{self._base_url}/api/worker/download/{task_id}",
                timeout=120,
                stream=True,
            )
            r.raise_for_status()

            # Сохранить во временный файл
            suffix = Path(task.get("audio_file_id", "audio")).suffix or ".audio"
            fd, tmp_path_str = tempfile.mkstemp(suffix=suffix)
            tmp_path = Path(tmp_path_str)
            with os.fdopen(fd, "wb") as f:
                for chunk in r.iter_content(chunk_size=65536):
                    f.write(chunk)

            logger.info(f"Задача {task_id}: транскрибирую ({tmp_path.stat().st_size // 1024} КБ)...")
            result = do_transcribe(
                str(tmp_path),
                model_name=self.config["WHISPER_MODEL"],
                device_setting=self.config["DEVICE"],
            )
            self.device_used = result.get("device_used")

            logger.info(f"Задача {task_id}: отправляю результат ({len(result['raw_text'])} символов)...")
            resp = self._session.post(
                f"{self._base_url}/api/worker/result/{task_id}",
                json=result,
                timeout=30,
            )
            resp.raise_for_status()

            self.tasks_done_today += 1
            logger.info(f"Задача {task_id} выполнена за {result['processing_time']}с")

        except Exception as e:
            logger.error(f"Задача {task_id}: ошибка — {e}")
            try:
                self._session.post(
                    f"{self._base_url}/api/worker/error/{task_id}",
                    json={"error_message": str(e)},
                    timeout=15,
                )
            except Exception:
                pass
        finally:
            stop_hb.set()
            self.current_task_id = None
            if tmp_path is not None and tmp_path.exists():
                tmp_path.unlink(missing_ok=True)

    def _heartbeat_loop(self, task_id: str, stop: threading.Event):
        while not stop.wait(timeout=20):
            try:
                self._session.post(
                    f"{self._base_url}/api/worker/heartbeat",
                    json={"task_id": task_id},
                    timeout=10,
                )
            except Exception:
                pass
