# Whisper Install

This document explains how local Whisper transcription is used in MindeSync.

## What Whisper is used for

Whisper performs local transcription of lecture audio and video. It runs on the machine that processes the file, either in the main backend flow or inside the dedicated worker.

## Recommended way to install

The easiest way is to run the project setup script:

```bash
# Windows
setup.bat

# Linux / macOS
./setup.sh
```

The setup script installs Python dependencies, downloads FFmpeg and Node.js locally, and offers a Whisper model choice.

## Manual backend install

If you want to install Whisper support by hand:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip setuptools wheel
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python scripts\download_model.py medium
```

## Whisper models

- `tiny` - fastest, lowest quality
- `base` - good for quick tests
- `small` - balanced default for many cases
- `medium` - higher quality, slower on CPU
- `large` - best quality, heaviest model

## Storage

Whisper models are stored inside the repository in `whisper_models/`.

## Worker usage

The worker uses the same Whisper models but has its own virtual environment in `worker/.venv`.

See [../worker/WORKER_RUN.md](../worker/WORKER_RUN.md) for the operational worker guide.

## GPU acceleration

If you have an NVIDIA GPU, install CUDA-enabled PyTorch in the worker venv for faster transcription.

See [CUDA_SETUP.md](CUDA_SETUP.md) for the current GPU instructions.

## Quick verification

```powershell
.\.venv\Scripts\python -c "import torch; print('CUDA:', torch.cuda.is_available())"
```

If this prints `True`, Whisper can use the GPU in the current environment.
