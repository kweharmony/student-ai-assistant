"""
Системный трей для управления воркером транскрибации.

Запуск: python tray_app.py

Иконка в трее:
  🟢 (зелёный круг) — воркер активен и принимает задачи
  ⚫ (серый круг)   — воркер отключён

Меню (правая кнопка мыши):
  Включить / Отключить воркер
  Статус (диалог с информацией)
  Настройки (диалог редактирования config.json)
  ──────────────────
  Выход
"""

import logging
import os
import sys
import threading

# Добавить папку worker в path для импортов
sys.path.insert(0, os.path.dirname(__file__))

from config import load_config, save_config
from worker import TranscriptionWorker

import pystray
from PIL import Image, ImageDraw

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


# ---------- Иконка ----------

def _make_icon(color: str) -> Image.Image:
    """Нарисовать круг заданного цвета 64x64."""
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([8, 8, 56, 56], fill=color)
    return img


COLOR_ACTIVE = "#22c55e"   # зелёный
COLOR_STOPPED = "#6b7280"  # серый


# ---------- Меню ----------

def _build_menu(worker: TranscriptionWorker, icon_ref: list) -> pystray.Menu:
    """Построить меню трея. icon_ref — список из одного элемента [icon]."""

    def toggle(icon, item):
        worker.enabled = not worker.enabled
        new_color = COLOR_ACTIVE if worker.enabled else COLOR_STOPPED
        icon.icon = _make_icon(new_color)
        icon.menu = _build_menu(worker, icon_ref)

    def show_status(icon, item):
        def _run():
            import tkinter as tk
            import tkinter.messagebox as mb
            root = tk.Tk()
            root.withdraw()
            mb.showinfo(
                "MindSync Worker — Статус",
                "\n".join([
                    f"Имя воркера: {worker.config['WORKER_NAME']}",
                    f"Статус: {'Активен' if worker.enabled else 'Отключён'}",
                    f"Устройство: {worker.device_used or 'не определено'}",
                    f"Модель Whisper: {worker.config['WHISPER_MODEL']}",
                    f"Текущая задача: {worker.current_task_id or 'нет'}",
                    f"Задач выполнено сегодня: {worker.tasks_done_today}",
                    "",
                    f"Сервер: {worker.config['SERVER_URL']}",
                ]),
            )
            root.destroy()
        threading.Thread(target=_run, daemon=True).start()

    def open_settings(icon, item):
        def _run():
            import tkinter as tk
            from tkinter import ttk

            cfg = worker.config.copy()
            root = tk.Tk()
            root.title("MindSync Worker — Настройки")
            root.resizable(False, False)

            fields = [
                ("Имя воркера", "WORKER_NAME"),
                ("URL сервера", "SERVER_URL"),
                ("API ключ", "API_KEY"),
                ("Модель Whisper", "WHISPER_MODEL"),
                ("Устройство (auto/cpu/cuda)", "DEVICE"),
            ]

            entries = {}
            for i, (label, key) in enumerate(fields):
                ttk.Label(root, text=label + ":").grid(row=i, column=0, padx=10, pady=5, sticky="w")
                var = tk.StringVar(value=str(cfg.get(key, "")))
                ttk.Entry(root, textvariable=var, width=40).grid(row=i, column=1, padx=10, pady=5)
                entries[key] = var

            def save():
                for key, var in entries.items():
                    cfg[key] = var.get()
                save_config(cfg)
                worker.config.update(cfg)
                worker._session.headers["X-Worker-Key"] = cfg["API_KEY"]
                worker._base_url = cfg["SERVER_URL"].rstrip("/")
                root.destroy()

            ttk.Button(root, text="Сохранить", command=save).grid(
                row=len(fields), column=0, columnspan=2, pady=10
            )
            root.mainloop()
        threading.Thread(target=_run, daemon=True).start()

    def on_exit(icon, item):
        icon.stop()

    toggle_label = "Отключить воркер" if worker.enabled else "Включить воркер"

    return pystray.Menu(
        pystray.MenuItem(toggle_label, toggle),
        pystray.MenuItem("Статус", show_status),
        pystray.MenuItem("Настройки", open_settings),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Выход", on_exit),
    )


# ---------- Точка входа ----------

def main():
    cfg = load_config()

    if not cfg["API_KEY"]:
        # Предупреждение в отдельном потоке — не блокирует запуск иконки
        def _warn():
            import tkinter as tk
            import tkinter.messagebox as mb
            root = tk.Tk()
            root.withdraw()
            mb.showwarning(
                "MindSync Worker",
                "API ключ не задан.\nОткройте настройки (правая кнопка на иконке → Настройки) и введите ключ.",
            )
            root.destroy()
        threading.Thread(target=_warn, daemon=True).start()

    worker = TranscriptionWorker(cfg)
    worker_thread = threading.Thread(target=worker.run, daemon=True)
    worker_thread.start()

    icon_ref = [None]  # список для передачи ссылки на icon в меню
    icon = pystray.Icon(
        name="MindSync Worker",
        icon=_make_icon(COLOR_ACTIVE),
        title="MindSync Worker",
    )
    icon_ref[0] = icon
    icon.menu = _build_menu(worker, icon_ref)

    logger.info("Иконка в системном трее запущена")
    icon.run()


if __name__ == "__main__":
    main()
