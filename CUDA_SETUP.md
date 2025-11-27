# CUDA Setup Guide для Student AI Assistant

## Проблема

При запуске проекта через `run_project.bat` транскрибация работает **в 10-15 раз медленнее**, чем при запуске вручную через IDE с активированным CUDA.

## Причина

Виртуальное окружение может содержать CPU-версию PyTorch вместо GPU-версии. Это происходит, если:

1. PyTorch установлен из `requirements.txt` (по умолчанию ставится CPU версия)
2. В виртуальном окружении не установлена CUDA-версия PyTorch
3. Используется неправильное виртуальное окружение (venv вместо .venv)

## Решение

### Вариант 1: Автоматическая установка через setup_project.bat

```bash
# Запустите setup_project.bat
.\setup_project.bat

# Скрипт автоматически:
# 1. Проверит наличие CUDA
# 2. Предложит установить PyTorch с CUDA (если обнаружена GPU)
# 3. Установит правильную версию в .venv
```

### Вариант 2: Ручная установка

```bash
# 1. Активируйте виртуальное окружение .venv
.venv\Scripts\Activate.ps1  # Windows PowerShell

# 2. Удалите CPU версию PyTorch
pip uninstall torch torchaudio

# 3. Установите CUDA версию
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# 4. Проверьте установку
python -c "import torch; print('CUDA доступна:', torch.cuda.is_available())"
# Должно вывести: CUDA доступна: True

python -c "import torch; print('GPU:', torch.cuda.get_device_name(0))"
# Должно вывести: GPU: NVIDIA GeForce RTX xxxx
```

### Вариант 3: Быстрая проверка через check_cuda.bat

```bash
# Просто запустите скрипт проверки
.\check_cuda.bat

# Он покажет:
# - Доступна ли CUDA
# - Какая GPU используется
# - Версию PyTorch
# - Инструкции по установке (если CUDA недоступна)
```

## Проверка

### После установки запустите backend:

```bash
.\start_api_medium.bat
```

Скрипт выведет информацию:

```
Checking CUDA availability...
CUDA available: True
Device: NVIDIA GeForce RTX 3060
PyTorch version: 2.x.x+cu118
```

**✅ Правильно (CUDA работает):**
```
CUDA available: True
Device: NVIDIA GeForce RTX 3060
```

**❌ Неправильно (CUDA не работает):**
```
CUDA available: False
Device: CPU only
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
.venv\Scripts\Activate.ps1
pip uninstall torch torchaudio
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### 2. Несколько виртуальных окружений (venv, .venv, env)

**Причина:** Путаница между разными venv

**Решение:**
```bash
# Удалите старые окружения
Remove-Item -Recurse -Force venv, env  # Оставьте только .venv

# Убедитесь, что .venv содержит CUDA
.venv\Scripts\Activate.ps1
python -c "import torch; print(torch.cuda.is_available())"
```

### 3. CUDA работает в IDE, но не через bat-скрипты

**Причина:** IDE использует другое виртуальное окружение

**Решение:**
```bash
# 1. Узнайте путь к Python в IDE:
# В IDE терминале:
python -c "import sys; print(sys.executable)"
# Пример вывода: C:\...\student-ai-assistant\.venv\Scripts\python.exe

# 2. Убедитесь, что bat-скрипт использует тот же .venv
# Откройте start_api_medium.bat и проверьте:
# if exist ".venv\Scripts\activate.bat"  ← должен быть .venv, не venv!
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

# Или используйте меньшую модель:
# В .env измените:
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
- ✅ RTX серии: 2060, 2070, 2080, 3060, 3070, 3080, 3090, 4060, 4070, 4080, 4090
- ✅ GTX серии: 1060, 1070, 1080, 1650, 1660
- ❌ MX серии (недостаточная производительность)
- ❌ Integrated Graphics (Intel UHD, Intel Iris)

## Дополнительная информация

- **PyTorch с CUDA:** https://pytorch.org/get-started/locally/
- **CUDA Toolkit:** https://developer.nvidia.com/cuda-downloads
- **Проверка совместимости GPU:** https://developer.nvidia.com/cuda-gpus

## Контрольный чек-лист

Перед запуском транскрибации убедитесь:

- [ ] Установлена CUDA версия PyTorch в `.venv`
- [ ] `check_cuda.bat` показывает `CUDA available: True`
- [ ] `start_api_medium.bat` показывает вашу GPU при запуске
- [ ] Используется правильное виртуальное окружение (`.venv`, не `venv`)
- [ ] Нет других программ, использующих GPU
- [ ] Драйверы NVIDIA актуальные (GeForce Experience)

---

**Если всё настроено правильно:**
- 30 минут аудио → ~1-2 минуты обработки ⚡
- GPU используется на 80-100% (можно проверить через Task Manager → Производительность → GPU)
