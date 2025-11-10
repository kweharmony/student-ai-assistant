"""
Скрипт для настройки cuDNN и запуска faster-whisper с CUDA
"""

import os
import sys

# Настраиваем путь к cuDNN
try:
    import nvidia.cudnn
    cudnn_paths = list(nvidia.cudnn.__path__)
    if cudnn_paths:
        cudnn_path = cudnn_paths[0]
        cudnn_bin = os.path.join(cudnn_path, 'bin')
        
        # Добавляем в PATH
        if os.path.exists(cudnn_bin):
            if cudnn_bin not in os.environ.get('PATH', ''):
                os.environ['PATH'] = cudnn_bin + os.pathsep + os.environ.get('PATH', '')
                print(f"✅ cuDNN bin добавлен в PATH: {cudnn_bin}")
        
        # Также добавляем сам путь к cudnn
        if cudnn_path not in os.environ.get('PATH', ''):
            os.environ['PATH'] = cudnn_path + os.pathsep + os.environ.get('PATH', '')
            print(f"✅ cuDNN путь добавлен в PATH: {cudnn_path}")
        
        os.environ['CUDNN_PATH'] = cudnn_path
        print(f"✅ CUDNN_PATH установлен: {cudnn_path}")
    
except ImportError:
    print("❌ nvidia-cudnn-cu12 не установлен!")
    sys.exit(1)

# Проверяем cublas
try:
    import nvidia.cublas
    cublas_paths = list(nvidia.cublas.__path__)
    if cublas_paths:
        cublas_path = cublas_paths[0]
        cublas_bin = os.path.join(cublas_path, 'bin')
        
        if os.path.exists(cublas_bin):
            if cublas_bin not in os.environ.get('PATH', ''):
                os.environ['PATH'] = cublas_bin + os.pathsep + os.environ.get('PATH', '')
                print(f"✅ cuBLAS bin добавлен в PATH: {cublas_bin}")
        
        # Добавляем сам путь
        if cublas_path not in os.environ.get('PATH', ''):
            os.environ['PATH'] = cublas_path + os.pathsep + os.environ.get('PATH', '')
            print(f"✅ cuBLAS путь добавлен в PATH: {cublas_path}")
except ImportError:
    print("⚠️  nvidia-cublas-cu12 не найден (не критично)")

print("\n" + "=" * 70)
print("🚀 ЗАПУСК FASTER-WHISPER С CUDA")
print("=" * 70)
print()

# Запускаем тестовый скрипт через subprocess
if __name__ == "__main__":
    import subprocess
    result = subprocess.run([sys.executable, "test_faster_whisper.py"], env=os.environ.copy())
    sys.exit(result.returncode)
