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
import socket
import tempfile
import threading
import time
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from transcriber import transcribe as do_transcribe

logger = logging.getLogger(__name__)


def _build_keepalive_options() -> list[tuple[int, int, int]]:
    """Опции сокета для включения TCP keepalive (переносимо между ОС).

    ОС сама шлёт keepalive-пробы по простаивающему соединению, поэтому
    мёртвый сокет (закрытый сервером/NAT во время простоя) обнаруживается
    заранее, а не зависанием до read-таймаута. Параметры идля/интервала/
    числа проб называются по-разному на разных платформах — добавляем те,
    что доступны.
    """
    options = [(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)]
    # Простой 60с до первой пробы
    if hasattr(socket, "TCP_KEEPIDLE"):          # Linux, и Windows на Python 3.7+
        options.append((socket.IPPROTO_TCP, socket.TCP_KEEPIDLE, 60))
    # Интервал между пробами 15с
    if hasattr(socket, "TCP_KEEPINTVL"):
        options.append((socket.IPPROTO_TCP, socket.TCP_KEEPINTVL, 15))
    # Сколько неотвеченных проб до признания соединения мёртвым
    if hasattr(socket, "TCP_KEEPCNT"):
        options.append((socket.IPPROTO_TCP, socket.TCP_KEEPCNT, 4))
    return options


class _KeepAliveHTTPAdapter(HTTPAdapter):
    """HTTPAdapter, включающий TCP keepalive на всех создаваемых сокетах."""

    def init_poolmanager(self, *args, **kwargs):
        kwargs["socket_options"] = _build_keepalive_options()
        super().init_poolmanager(*args, **kwargs)


class TranscriptionWorker:
    def __init__(self, config: dict):
        self.config = config
        self.enabled = True          # флаг вкл/выкл (управляется из трея)
        self.tasks_done_today = 0
        self.current_task_id: str | None = None
        self.device_used: str | None = None  # для отображения в трее

        self._base_url = config["SERVER_URL"].rstrip("/")
        self._session = self._build_session()

    def _build_session(self) -> requests.Session:
        """Создать новую HTTP-сессию со свежим пулом соединений.

        Пул соединений настроен на авто-ретраи (на свежем сокете) и на то,
        чтобы не переиспользовать протухшие keep-alive соединения, которые
        тихо закрывает сервер/NAT во время простоя.
        """
        session = requests.Session()
        session.headers.update({
            "X-Worker-Key": self.config["API_KEY"],
            "Content-Type": "application/json",
        })
        # Ретраим только GET (идемпотентные опросы/скачивание). POST НЕ ретраим:
        # /result и /error не идемпотентны — повтор после уже принятого сервером
        # запроса задвоил бы транскрипт или счётчик попыток. Для POST хватает
        # обработки ошибок в _process_task и серверного recovery-цикла.
        retry = Retry(
            total=2,
            connect=2,
            read=2,
            backoff_factor=1,
            status_forcelist=(502, 503, 504),
            allowed_methods=("GET",),
        )
        adapter = _KeepAliveHTTPAdapter(max_retries=retry)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        return session

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
                # Сбрасываем пул соединений: протухший keep-alive сокет
                # больше не будет переиспользован — следующий опрос пойдёт
                # по свежему соединению (как при перезапуске воркера).
                self._reset_session()
                time.sleep(self.config["POLL_INTERVAL"])
                continue

            if task is None:
                time.sleep(self.config["POLL_INTERVAL"])
                continue

            self._process_task(task)

    # ---------- Private ----------

    def _reset_session(self):
        """Закрыть текущую сессию и создать новую со свежим пулом соединений."""
        try:
            self._session.close()
        except Exception:
            pass
        self._session = self._build_session()

    def reload_config(self, new_config: dict):
        """Применить новые настройки (из окна трея).

        Обновляет адрес сервера и пересоздаёт сессию, чтобы новый API-ключ
        и адрес гарантированно вступили в силу — без ручного перезапуска.
        """
        self.config.update(new_config)
        self._base_url = self.config["SERVER_URL"].rstrip("/")
        self._reset_session()

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

            # Сохранить во временный файл. Расширение не важно: Whisper/ffmpeg
            # определяют формат по содержимому, а не по имени.
            fd, tmp_path_str = tempfile.mkstemp(suffix=".audio")
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
