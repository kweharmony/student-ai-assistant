#!/usr/bin/env bash
# =============================================================
#  Student AI Assistant — Run (Linux / macOS)
#  Запускает backend (FastAPI) и frontend (React)
# =============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

VENV_DIR=".venv"
TOOLS_DIR="tools"
WHISPER_MODEL="${WHISPER_MODEL:-medium}"

# ---------- helpers ----------
info()  { printf "\033[1;34m[INFO]\033[0m  %s\n" "$1"; }
ok()    { printf "\033[1;32m[OK]\033[0m    %s\n" "$1"; }
err()   { printf "\033[1;31m[ERR]\033[0m   %s\n" "$1"; }

# ---------- checks ----------
if [ ! -f "$VENV_DIR/bin/activate" ]; then
    err "Virtual environment not found. Run ./setup.sh first."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    err "npm dependencies not found. Run ./setup.sh first."
    exit 1
fi

# ---------- activate venv ----------
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

# Add local tools to PATH
export PATH="$SCRIPT_DIR/$TOOLS_DIR/ffmpeg/bin:$SCRIPT_DIR/$TOOLS_DIR/node/bin:$PATH"
export WHISPER_MODEL

# ---------- find npm ----------
NPM_CMD=""
if command -v npm &>/dev/null; then
    NPM_CMD="npm"
elif [ -x "$TOOLS_DIR/node/bin/npm" ]; then
    NPM_CMD="$TOOLS_DIR/node/bin/npm"
fi

if [ -z "$NPM_CMD" ]; then
    err "npm not found. Run ./setup.sh first."
    exit 1
fi

# ---------- cleanup on exit ----------
API_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    info "Stopping servers..."
    [ -n "$API_PID" ]      && kill "$API_PID"      2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID"  2>/dev/null
    wait "$API_PID"      2>/dev/null
    wait "$FRONTEND_PID" 2>/dev/null
    echo "Servers stopped."
}
trap cleanup EXIT INT TERM

# ---------- launch ----------
echo "========================================"
echo "  Student AI Assistant"
echo "========================================"
echo ""
info "Whisper model: $WHISPER_MODEL"
echo ""

info "Starting API server (http://localhost:8000)..."
uvicorn api.app:app --host 0.0.0.0 --port 8000 &
API_PID=$!

sleep 2

info "Starting frontend (http://localhost:3000)..."
"$NPM_CMD" start &
FRONTEND_PID=$!

sleep 2

echo ""
ok "Both servers are running!"
echo ""
echo "  API:      http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo "  Docs:     http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop."
echo ""

# Wait for either process to exit
while kill -0 "$API_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
    sleep 1
done
