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

Модель потоков (важно для стабильности на Windows):
  Tkinter не потокобезопасен и должен жить в ГЛАВНОМ потоке. Поэтому:
    - главный поток держит один скрытый Tk-root и крутит его mainloop;
    - иконка трея (pystray) работает в отдельном фоновом потоке;
    - воркер тоже в фоновом потоке;
    - любой диалог из меню планируется на главный поток через root.after(),
      а не создаёт новый Tk() в случайном потоке (это и приводило к вылетам).
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


# ---------- Диалоги (выполняются ТОЛЬКО в главном Tk-потоке) ----------

def _show_status_dialog(worker: TranscriptionWorker) -> None:
    import tkinter.messagebox as mb
    mb.showinfo(
        "MindSync Worker — Статус",
        "\n".join([
            f"Имя воркера: {worker.config['WORKER_NAME']}",
            f"Статус: {'Активен' if worker.enabled else 'Отключён'}",
            f"Устройство: {worker.device_used or 'не определено'}",
            f"Модель Whisper: {worker.config['WHISPER_MODEL']}",
            f"Текущая задача: {worker.current_task_id or 'нет'}",
            f"Задач выполнено: {worker.tasks_done_today}",
            "",
            f"Сервер: {worker.config['SERVER_URL']}",
        ]),
    )


def _show_settings_dialog(worker: TranscriptionWorker) -> None:
    import tkinter as tk
    from tkinter import ttk

    cfg = worker.config.copy()
    # Toplevel привязан к общему root — никаких новых Tk() в потоках.
    win = tk.Toplevel()
    win.title("MindSync Worker — Настройки")
    win.resizable(False, False)
    win.attributes("-topmost", True)

    fields = [
        ("Имя воркера", "WORKER_NAME"),
        ("URL сервера", "SERVER_URL"),
        ("API ключ", "API_KEY"),
        ("Модель Whisper", "WHISPER_MODEL"),
        ("Устройство (auto/cpu/cuda)", "DEVICE"),
        ("Интервал опроса, сек", "POLL_INTERVAL"),
    ]

    entries = {}
    for i, (label, key) in enumerate(fields):
        ttk.Label(win, text=label + ":").grid(row=i, column=0, padx=10, pady=5, sticky="w")
        var = tk.StringVar(value=str(cfg.get(key, "")))
        ttk.Entry(win, textvariable=var, width=40).grid(row=i, column=1, padx=10, pady=5)
        entries[key] = var

    def save():
        for key, var in entries.items():
            val = var.get().strip()
            if key == "POLL_INTERVAL":
                # Поле числовое: некорректный ввод не должен ломать time.sleep().
                try:
                    val = int(val)
                except ValueError:
                    val = worker.config.get("POLL_INTERVAL", 30)
            cfg[key] = val
        save_config(cfg)
        worker.reload_config(cfg)   # корректно применяет ключ/адрес + свежая сессия
        win.destroy()

    ttk.Button(win, text="Сохранить", command=save).grid(
        row=len(fields), column=0, columnspan=2, pady=10
    )


# ---------- Меню ----------

def _build_menu(worker: TranscriptionWorker, on_ui) -> pystray.Menu:
    """Построить меню трея. on_ui(fn) — планирует fn на главный Tk-поток."""

    def toggle(icon, item):
        worker.enabled = not worker.enabled
        icon.icon = _make_icon(COLOR_ACTIVE if worker.enabled else COLOR_STOPPED)
        icon.menu = _build_menu(worker, on_ui)

    def show_status(icon, item):
        on_ui(lambda: _show_status_dialog(worker))

    def open_settings(icon, item):
        on_ui(lambda: _show_settings_dialog(worker))

    def on_exit(icon, item):
        icon.stop()
        on_ui("__quit__")  # сигнал главному потоку завершить mainloop

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
    import tkinter as tk

    cfg = load_config()

    worker = TranscriptionWorker(cfg)
    threading.Thread(target=worker.run, daemon=True).start()

    # Единственный Tk-root живёт в главном потоке и остаётся скрытым.
    root = tk.Tk()
    root.withdraw()

    def on_ui(fn):
        """Выполнить функцию в главном Tk-потоке (вызывается из потока трея)."""
        if fn == "__quit__":
            root.after(0, root.quit)
        else:
            root.after(0, fn)

    icon = pystray.Icon(
        name="MindSync Worker",
        icon=_make_icon(COLOR_ACTIVE),
        title="MindSync Worker",
    )
    icon.menu = _build_menu(worker, on_ui)

    if not cfg["API_KEY"]:
        import tkinter.messagebox as mb
        on_ui(lambda: mb.showwarning(
            "MindSync Worker",
            "API ключ не задан.\nОткройте настройки (правая кнопка на иконке → Настройки) и введите ключ.",
        ))

    # Иконка трея — в фоновом потоке, Tk mainloop — в главном.
    threading.Thread(target=icon.run, daemon=True).start()

    logger.info("Иконка в системном трее запущена")
    try:
        root.mainloop()
    finally:
        icon.stop()


if __name__ == "__main__":
    main()
