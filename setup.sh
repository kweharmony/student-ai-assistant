#!/usr/bin/env bash
# =============================================================
#  Student AI Assistant — Setup (Linux / macOS)
#  Создаёт venv (Python 3.12), устанавливает зависимости,
#  скачивает FFmpeg, Node.js и модель Whisper в проект.
# =============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

VENV_DIR=".venv"
TOOLS_DIR="tools"
FFMPEG_DIR="$TOOLS_DIR/ffmpeg"
NODE_DIR="$TOOLS_DIR/node"
NODE_VERSION="v20.18.1"
WHISPER_MODEL="${WHISPER_MODEL:-medium}"
MARKER_FILE="$VENV_DIR/.setup_done"

# ---------- helpers ----------
info()  { printf "\033[1;34m[INFO]\033[0m  %s\n" "$1"; }
ok()    { printf "\033[1;32m[OK]\033[0m    %s\n" "$1"; }
warn()  { printf "\033[1;33m[WARN]\033[0m  %s\n" "$1"; }
err()   { printf "\033[1;31m[ERR]\033[0m   %s\n" "$1"; }
fail()  { err "$1"; exit 1; }

# ---------- detect OS / arch ----------
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
    Linux*)  PLATFORM="linux"  ;;
    Darwin*) PLATFORM="darwin" ;;
    MINGW*|MSYS*|CYGWIN*) fail "Для Windows используйте setup.bat" ;;
    *) fail "Неподдерживаемая ОС: $OS" ;;
esac

case "$ARCH" in
    x86_64|amd64) ARCH_TAG="x64" ;;
    aarch64|arm64) ARCH_TAG="arm64" ;;
    *) fail "Неподдерживаемая архитектура: $ARCH" ;;
esac

info "Платформа: $PLATFORM-$ARCH_TAG"

echo ""
warn "Для скачивания некоторых библиотек (PyTorch, Whisper)"
warn "может потребоваться VPN. Убедитесь что VPN включён."
echo ""
read -r -p "  Нажмите Enter чтобы продолжить..."

# =============================================================
#  1. Python 3.12
# =============================================================
info "Проверка Python 3.12..."

PYTHON_CMD=""
for cmd in python3.12 python3 python; do
    if command -v "$cmd" &>/dev/null; then
        PY_VER=$("$cmd" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || true)
        if [ "$PY_VER" = "3.12" ]; then
            PYTHON_CMD="$cmd"
            break
        fi
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    err "Python 3.12 не найден!"
    echo ""
    if [ "$PLATFORM" = "linux" ]; then
        echo "  Ubuntu/Debian: sudo apt update && sudo apt install python3.12 python3.12-venv"
        echo "  Fedora:        sudo dnf install python3.12"
        echo "  Arch:          sudo pacman -S python"
    else
        echo "  macOS: brew install python@3.12"
    fi
    exit 1
fi
ok "Python 3.12 найден: $PYTHON_CMD ($($PYTHON_CMD --version))"

# =============================================================
#  2. Virtual environment
# =============================================================
if [ ! -f "$VENV_DIR/bin/activate" ]; then
    info "Создание виртуального окружения (.venv)..."
    "$PYTHON_CMD" -m venv "$VENV_DIR"
    ok "Окружение создано"
else
    ok "Окружение .venv уже существует"
fi

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

# =============================================================
#  3. Python зависимости
# =============================================================
if [ -f "$MARKER_FILE" ] && [ "$MARKER_FILE" -nt "requirements.txt" ]; then
    ok "Python-зависимости уже установлены (requirements.txt не изменялся)"
else
    info "Установка Python-зависимостей..."
    pip install --upgrade pip -q
    pip install -r requirements.txt
    touch "$MARKER_FILE"
    ok "Python-зависимости установлены"
fi

# =============================================================
#  3.1. CUDA (PyTorch с GPU-ускорением)
# =============================================================
CUDA_MARKER="$VENV_DIR/.cuda_choice_done"

if [ ! -f "$CUDA_MARKER" ]; then
    echo ""
    info "Проверка CUDA (GPU-ускорение для Whisper)..."

    # Проверяем, есть ли уже CUDA-версия PyTorch
    CUDA_AVAILABLE=$("$VENV_DIR/bin/python" -c "import torch; print('yes' if torch.cuda.is_available() else 'no')" 2>/dev/null || echo "no")

    if [ "$CUDA_AVAILABLE" = "yes" ]; then
        ok "CUDA уже доступна"
        echo "yes" > "$CUDA_MARKER"
    else
        echo ""
        echo "  PyTorch сейчас установлен без поддержки GPU (CPU-only)."
        echo "  С CUDA транскрибация в 10-15 раз быстрее."
        echo "  Требуется: NVIDIA GPU + установленные драйверы NVIDIA."
        echo ""
        printf "  Установить PyTorch с CUDA? (y/N): "
        read -r INSTALL_CUDA

        if [ "$INSTALL_CUDA" = "y" ] || [ "$INSTALL_CUDA" = "Y" ]; then
            info "Установка PyTorch с CUDA..."
            pip uninstall -y torch torchaudio 2>/dev/null || true
            pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
            # Проверяем результат
            CUDA_CHECK=$("$VENV_DIR/bin/python" -c "import torch; print('yes' if torch.cuda.is_available() else 'no')" 2>/dev/null || echo "no")
            if [ "$CUDA_CHECK" = "yes" ]; then
                ok "CUDA PyTorch установлен и работает!"
                "$VENV_DIR/bin/python" -c "import torch; print(f'  GPU: {torch.cuda.get_device_name(0)}')"
            else
                warn "PyTorch с CUDA установлен, но GPU не обнаружен."
                warn "Убедитесь что установлены драйверы NVIDIA."
            fi
            echo "yes" > "$CUDA_MARKER"
        else
            info "Пропускаю CUDA. Whisper будет работать на CPU."
            echo "no" > "$CUDA_MARKER"
        fi
    fi
else
    ok "Выбор CUDA уже сделан (удалите $CUDA_MARKER чтобы выбрать снова)"
fi

# =============================================================
#  4. FFmpeg
# =============================================================
install_ffmpeg() {
    if command -v ffmpeg &>/dev/null; then
        ok "FFmpeg уже установлен: $(ffmpeg -version 2>&1 | head -1)"
        return
    fi

    # Проверяем локальную копию
    if [ -d "$FFMPEG_DIR" ]; then
        for f in "$FFMPEG_DIR"/*/bin/ffmpeg "$FFMPEG_DIR"/ffmpeg "$FFMPEG_DIR"/bin/ffmpeg; do
            if [ -x "$f" ]; then
                ok "FFmpeg найден в tools/"
                return
            fi
        done
    fi

    info "Скачивание FFmpeg..."
    mkdir -p "$FFMPEG_DIR"

    if [ "$PLATFORM" = "linux" ]; then
        FFMPEG_URL="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz"
        curl -L --progress-bar "$FFMPEG_URL" -o /tmp/ffmpeg.tar.xz
        tar -xf /tmp/ffmpeg.tar.xz -C "$FFMPEG_DIR" --strip-components=1
        rm -f /tmp/ffmpeg.tar.xz
    elif [ "$PLATFORM" = "darwin" ]; then
        if command -v brew &>/dev/null; then
            info "Устанавливаю FFmpeg через Homebrew..."
            brew install ffmpeg
        else
            warn "Homebrew не найден. Установите FFmpeg вручную:"
            echo "  brew install ffmpeg"
            echo "  или скачайте с https://evermeet.cx/ffmpeg/"
            return
        fi
    fi

    # Проверяем результат
    if [ -x "$FFMPEG_DIR/bin/ffmpeg" ]; then
        ok "FFmpeg скачан в $FFMPEG_DIR"
    elif command -v ffmpeg &>/dev/null; then
        ok "FFmpeg установлен системно"
    else
        warn "Не удалось установить FFmpeg. Установите вручную."
    fi
}

install_ffmpeg

# =============================================================
#  5. Node.js
# =============================================================
install_node() {
    # Проверяем системный Node
    if command -v node &>/dev/null; then
        NODE_VER="$(node --version)"
        NODE_MAJOR="${NODE_VER%%.*}"
        NODE_MAJOR="${NODE_MAJOR#v}"
        if [ "$NODE_MAJOR" -ge 18 ] 2>/dev/null; then
            ok "Node.js уже установлен: $NODE_VER"
            return
        else
            warn "Node.js $NODE_VER слишком старый (нужен >= 18)"
        fi
    fi

    # Проверяем локальную копию
    if [ -x "$NODE_DIR/bin/node" ]; then
        ok "Node.js найден в tools/"
        return
    fi

    info "Скачивание Node.js $NODE_VERSION..."
    mkdir -p "$NODE_DIR"

    NODE_ARCHIVE="node-${NODE_VERSION}-${PLATFORM}-${ARCH_TAG}"
    NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/${NODE_ARCHIVE}.tar.xz"

    if [ "$PLATFORM" = "darwin" ]; then
        NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/${NODE_ARCHIVE}.tar.gz"
        curl -L --progress-bar "$NODE_URL" -o /tmp/node.tar.gz
        tar -xf /tmp/node.tar.gz -C "$NODE_DIR" --strip-components=1
        rm -f /tmp/node.tar.gz
    else
        curl -L --progress-bar "$NODE_URL" -o /tmp/node.tar.xz
        tar -xf /tmp/node.tar.xz -C "$NODE_DIR" --strip-components=1
        rm -f /tmp/node.tar.xz
    fi

    if [ -x "$NODE_DIR/bin/node" ]; then
        ok "Node.js скачан в $NODE_DIR"
    else
        err "Не удалось скачать Node.js"
        echo "  Установите вручную: https://nodejs.org/"
    fi
}

install_node

# Добавляем локальные tools в PATH для npm install
export PATH="$SCRIPT_DIR/$FFMPEG_DIR/bin:$SCRIPT_DIR/$NODE_DIR/bin:$PATH"

# =============================================================
#  6. npm-зависимости
# =============================================================
# Определяем npm
NPM_CMD=""
if command -v npm &>/dev/null; then
    NPM_CMD="npm"
elif [ -x "$NODE_DIR/bin/npm" ]; then
    NPM_CMD="$NODE_DIR/bin/npm"
fi

if [ -z "$NPM_CMD" ]; then
    warn "npm не найден — пропускаю установку frontend-зависимостей"
else
    if [ -d "node_modules" ] && [ "node_modules" -nt "package.json" ]; then
        ok "npm-зависимости уже установлены"
    else
        info "Установка npm-зависимостей..."
        "$NPM_CMD" install --legacy-peer-deps
        ok "npm-зависимости установлены"
    fi
fi

# =============================================================
#  7. Whisper-модель
# =============================================================
echo ""
echo "========================================"
echo "  Выбор модели Whisper"
echo "========================================"
echo ""
echo "  1. tiny   -  ~75 MB  - 30 мин аудио ~ 10 мин  (низкое качество)"
echo "  2. base   - ~150 MB  - 30 мин аудио ~  7 мин  (нормальное качество)"
echo "  3. small  - ~500 MB  - 30 мин аудио ~  5 мин  (хорошее качество)"
echo "  4. medium - ~1.5 GB  - 30 мин аудио ~  3 мин  (отличное качество) [по умолчанию]"
echo "  5. large  -  ~3 GB   - 30 мин аудио ~  2 мин  (лучшее качество)"
echo ""
echo "  * Время указано для CPU. С CUDA GPU в 10-15 раз быстрее."
echo ""
printf "  Выберите модель (1-5, по умолчанию 4): "
read -r MODEL_CHOICE

case "$MODEL_CHOICE" in
    1) WHISPER_MODEL="tiny" ;;
    2) WHISPER_MODEL="base" ;;
    3) WHISPER_MODEL="small" ;;
    5) WHISPER_MODEL="large" ;;
    *) WHISPER_MODEL="medium" ;;
esac

info "Скачивание модели Whisper: $WHISPER_MODEL..."
"$VENV_DIR/bin/python" scripts/download_model.py "$WHISPER_MODEL"

# =============================================================
#  Готово
# =============================================================
echo ""
echo "========================================"
echo "  Установка завершена!"
echo "========================================"
echo ""
echo "  Запуск проекта:  ./run.sh"
echo ""
