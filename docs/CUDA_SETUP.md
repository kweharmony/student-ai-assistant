# CUDA Setup Guide для Student AI Assistant

## Проблема

Транскрибация работает **в 10-15 раз медленнее**, чем должна, потому что используется CPU вместо GPU.

## Причина

Виртуальное окружение может содержать CPU-версию PyTorch вместо GPU-версии. Это происходит, если:

1. PyTorch установлен из `requirements.txt` (по умолчанию ставится CPU версия)
2. При установке через `setup.bat` / `setup.sh` вы выбрали "n" на вопрос про CUDA

## Решение

### Вариант 1: Автоматическая установка через setup

```bash
# Windows:
setup.bat

# Linux / macOS:
./setup.sh
```

Скрипт автоматически предложит установить PyTorch с CUDA при обнаружении GPU.

### Вариант 2: Ручная установка

```bash
# 1. Активируйте виртуальное окружение .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate

# 2. Удалите CPU версию PyTorch
pip uninstall -y torch torchaudio

# 3. Установите CUDA версию
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# 4. Проверьте установку
python -c "import torch; print('CUDA:', torch.cuda.is_available())"
# Должно вывести: CUDA: True

python -c "import torch; print('GPU:', torch.cuda.get_device_name(0))"
# Должно вывести: GPU: NVIDIA GeForce RTX xxxx
```

## Проверка

После установки запустите проект:

```bash
# Windows:
run.bat

# Linux / macOS:
./run.sh
```

В логах API сервера должно быть:

```
CUDA available: True
Device: NVIDIA GeForce RTX 3060
```

## Сравнение производительности

| Режим | 30 минут аудио | 60 минут аудио |
|-------|----------------|----------------|
| **CPU only** | ~15-20 минут | ~30-40 минут |
| **CUDA GPU (RTX)** | ~1-2 минуты | ~2-4 минуты |
| **Ускорение** | **10-15x** | **10-15x** |

## Частые проблемы

### 1. "CUDA available: False" при наличии RTX GPU

**Причина:** Установлена CPU версия PyTorch

**Решение:**
```bash
.venv\Scripts\Activate.ps1  # или source .venv/bin/activate
pip uninstall -y torch torchaudio
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### 2. Несколько виртуальных окружений (venv, .venv, env)

**Причина:** Путаница между разными venv

**Решение:**
```bash
# Удалите старые окружения, оставьте только .venv
# Windows:
Remove-Item -Recurse -Force venv, env

# Linux / macOS:
rm -rf venv env

# Убедитесь, что .venv содержит CUDA
# Windows:
.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate

python -c "import torch; print(torch.cuda.is_available())"
```

### 3. CUDA работает в IDE, но не через run.bat

**Причина:** IDE использует другое виртуальное окружение

**Решение:**
```bash
# 1. Узнайте путь к Python в IDE:
python -c "import sys; print(sys.executable)"
# Должно быть: ...student-ai-assistant\.venv\Scripts\python.exe

# 2. Если путь другой — настройте IDE на использование .venv
```

### 4. "RuntimeError: CUDA out of memory"

**Причина:** GPU переполнена (другие программы используют видеопамять)

**Решение:**
```bash
# Закройте программы, использующие GPU:
# - Игры
# - Другие ML модели
# - Браузеры с hardware acceleration
# - Discord (hardware acceleration)

# Или используйте меньшую модель в .env:
WHISPER_MODEL=small  # вместо medium
```

## Требования к GPU

### Минимальные:
- NVIDIA GPU с CUDA Compute Capability 3.5+
- 4 GB VRAM (для модели `small`)
- 6 GB VRAM (для модели `medium`)
- 10 GB VRAM (для модели `large`)

### Рекомендуемые:
- RTX 2060 или выше
- 8 GB VRAM
- CUDA 11.8 или выше

### Совместимые GPU:
- RTX серии: 2060, 2070, 2080, 3060, 3070, 3080, 3090, 4060, 4070, 4080, 4090
- GTX серии: 1060, 1070, 1080, 1650, 1660
- MX серии (недостаточная производительность)
- Integrated Graphics (Intel UHD, Intel Iris) — не поддерживается

## Дополнительная информация

- **PyTorch с CUDA:** https://pytorch.org/get-started/locally/
- **CUDA Toolkit:** https://developer.nvidia.com/cuda-downloads
- **Проверка совместимости GPU:** https://developer.nvidia.com/cuda-gpus

## Контрольный чек-лист

- [ ] Установлена CUDA версия PyTorch в `.venv`
- [ ] `python -c "import torch; print(torch.cuda.is_available())"` выводит `True`
- [ ] `run.bat` / `run.sh` показывает вашу GPU при запуске
- [ ] Используется правильное виртуальное окружение (`.venv`)
- [ ] Нет других программ, использующих GPU
- [ ] Драйверы NVIDIA актуальные (GeForce Experience)

---

**Если всё настроено правильно:**
- 30 минут аудио → ~1-2 минуты обработки
- GPU используется на 80-100% (можно проверить через Task Manager → Производительность → GPU)
