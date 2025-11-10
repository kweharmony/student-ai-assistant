"""
Проверка CUDA для faster-whisper
"""

print("\n" + "=" * 70)
print("🔍 ПРОВЕРКА CUDA ДЛЯ FASTER-WHISPER")
print("=" * 70)

# 1. Проверка CTranslate2 (основа faster-whisper)
print("\n1️⃣ CTranslate2 (движок faster-whisper):")
try:
    import ctranslate2
    print(f"   ✅ CTranslate2 версия: {ctranslate2.__version__}")
    cuda_devices = ctranslate2.get_cuda_device_count()
    print(f"   ✅ CUDA устройств: {cuda_devices}")
    if cuda_devices > 0:
        print(f"   🚀 GPU ДОСТУПЕН! faster-whisper будет использовать CUDA")
    else:
        print(f"   ⚠️  CUDA не найдена")
except Exception as e:
    print(f"   ❌ Ошибка: {e}")

# 2. Проверка PyTorch (опционально, для некоторых операций)
print("\n2️⃣ PyTorch (опционально):")
try:
    import torch
    print(f"   ✅ PyTorch версия: {torch.__version__}")
    print(f"   CUDA доступна: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"   GPU: {torch.cuda.get_device_name(0)}")
    else:
        print(f"   ⚠️  PyTorch без CUDA (не критично для faster-whisper)")
except Exception as e:
    print(f"   ⚠️  PyTorch не установлен: {e}")

# 3. Проверка faster-whisper
print("\n3️⃣ faster-whisper:")
try:
    from faster_whisper import WhisperModel
    print(f"   ✅ faster-whisper установлен")
    
    # Попробуем загрузить tiny модель на GPU
    print(f"\n   🧪 Тестируем загрузку модели на CUDA...")
    model = WhisperModel("tiny", device="cuda", compute_type="float16")
    print(f"   ✅ Модель 'tiny' загружена на GPU!")
    print(f"   🎉 CUDA РАБОТАЕТ С FASTER-WHISPER!")
    
except Exception as e:
    print(f"   ❌ Ошибка: {e}")
    print(f"\n   Пробуем CPU...")
    try:
        model = WhisperModel("tiny", device="cpu", compute_type="int8")
        print(f"   ✅ На CPU работает (но медленнее)")
    except Exception as e2:
        print(f"   ❌ Ошибка и на CPU: {e2}")

# 4. Итоговая рекомендация
print("\n" + "=" * 70)
print("📋 ИТОГ:")
print("=" * 70)

try:
    cuda_ok = ctranslate2.get_cuda_device_count() > 0
    if cuda_ok:
        print("\n✅ CUDA ГОТОВА К РАБОТЕ!")
        print("\n💡 Используйте в test_faster_whisper.py:")
        print('   device = "cuda"')
        print('   model = "medium"  # или large-v2')
        print("\n⚡ Ожидаемая скорость: в 5-10 раз быстрее CPU")
    else:
        print("\n⚠️  CUDA не доступна")
        print("\n💡 Используйте в test_faster_whisper.py:")
        print('   device = "cpu"')
except:
    print("\n❌ Не удалось определить статус CUDA")

print("\n")
