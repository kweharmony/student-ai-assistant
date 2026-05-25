# CUDA Setup

Use this guide if Whisper transcription is too slow on a machine with an NVIDIA GPU.

## When CUDA helps

- CPU-only transcription works, but is much slower
- CUDA-enabled PyTorch lets Whisper use the GPU
- for `medium` and `large` models the speedup is significant

## Recommended path

The easiest path is to let the setup scripts offer CUDA automatically:

```bash
# Windows
setup.bat

# Linux / macOS
./setup.sh
```

If you accept the CUDA prompt, the worker environment is configured with GPU support.

## Manual worker install

If you want to switch the worker venv yourself:

```powershell
cd worker
.\.venv\Scripts\python -m pip uninstall -y torch torchaudio torchvision
.\.venv\Scripts\python -m pip install --index-url https://download.pytorch.org/whl/cu118 torch torchvision torchaudio
.\.venv\Scripts\python -c "import torch; print('CUDA:', torch.cuda.is_available())"
```

The `cu118` index is the one that worked reliably in this repository.

## What to check

- `torch.cuda.is_available()` returns `True`
- the worker logs mention the GPU device name
- the worker is using `worker/.venv`, not a different Python environment
- NVIDIA drivers are installed and current

## If CUDA is still false

- make sure you are running the worker from `worker/.venv`
- make sure the machine actually has an NVIDIA GPU
- check that another environment did not overwrite the Python packages
- try reinstalling `torch`, `torchvision`, and `torchaudio` in the worker venv

