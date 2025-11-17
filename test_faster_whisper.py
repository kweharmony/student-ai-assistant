"""
Тест транскрибации с faster-whisper (GPU CUDA support)
БЫСТРЕЕ и ЛЕГЧЕ чем openai-whisper
Поддерживает Python 3.14
"""

from faster_whisper import WhisperModel
import os
import time

def test_faster_whisper(audio_file_path, model_name="medium", device="cuda"):
    """
    Тестирует faster-whisper с CUDA
    
    device: "cuda" для GPU, "cpu" для процессора
    compute_type: "float16" для GPU, "int8" для CPU
    """
    
    print("\n" + "=" * 70)
    print("🎙️  ТЕСТ ТРАНСКРИБАЦИИ FASTER-WHISPER")
    print("=" * 70)
    
    # Проверка файла
    if not os.path.exists(audio_file_path):
        print(f"\n❌ Файл не найден: {audio_file_path}")
        return
    
    file_size_mb = os.path.getsize(audio_file_path) / (1024 * 1024)
    print(f"\n✅ Файл найден: {audio_file_path}")
    print(f"📦 Размер: {file_size_mb:.2f} MB")
    
    # Определение устройства (через CTranslate2, не PyTorch)
    import ctranslate2
    cuda_available = ctranslate2.get_cuda_device_count() > 0
    
    if device == "cuda" and not cuda_available:
        print(f"\n⚠️  CUDA недоступна, переключаюсь на CPU")
        device = "cpu"
    
    compute_type = "float16" if device == "cuda" else "int8"
    
    print(f"\n🔧 Устройство: {device.upper()}")
    if device == "cuda":
        print(f"   GPU обнаружен через CTranslate2")
        print(f"   CUDA устройств: {ctranslate2.get_cuda_device_count()}")
        print(f"   Compute type: {compute_type} (FP16)")
        print(f"   ⚡ GPU ускорение АКТИВНО!")
    else:
        print(f"   Compute type: {compute_type} (INT8)")
    
    # Загрузка модели
    print(f"\n🔄 Загружаем модель '{model_name}'...")
    print(f"   (При первом запуске модель скачается автоматически)")
    start_load = time.time()
    
    try:
        model = WhisperModel(
            model_name,
            device=device,
            compute_type=compute_type,
            download_root="./whisper_models"  # Локальная папка для моделей
        )
        load_time = time.time() - start_load
        print(f"✅ Модель загружена на {device.upper()} за {load_time:.2f} сек")
    except Exception as e:
        print(f"❌ Ошибка загрузки модели: {e}")
        return
    
    # Транскрибация
    print(f"\n🎙️  Начинаем транскрибацию...")
    print(f"⏳ Это может занять время для длинных файлов...")
    
    if device == "cuda":
        print(f"💡 GPU ускорение активно! Ожидаемое время: ~{file_size_mb * 0.1:.1f}-{file_size_mb * 0.3:.1f} минут")
    else:
        print(f"💡 Примерное время на CPU: ~{file_size_mb * 0.5:.1f}-{file_size_mb:.1f} минут\n")
    
    start_transcribe = time.time()
    
    try:
        segments, info = model.transcribe(
            audio_file_path,
            language="ru",  # Русский язык
            task="transcribe",
            beam_size=5,  # Качество расшифровки (5 - хорошо)
            vad_filter=False,  # Отключаем VAD (требует onnxruntime)
            # vad_parameters=dict(min_silence_duration_ms=500)  # Закомментировано
        )
        
        # Собираем текст из сегментов
        print("\n📝 Обработка сегментов...")
        full_text = []
        for segment in segments:
            full_text.append(segment.text)
            print(f"   [{segment.start:.1f}s - {segment.end:.1f}s] {segment.text[:60]}...")
        
        text = " ".join(full_text)
        transcribe_time = time.time() - start_transcribe
        
        print("\n" + "=" * 70)
        print("✅ ТРАНСКРИБАЦИЯ ЗАВЕРШЕНА!")
        print("=" * 70)
        
        print(f"\n🌍 Определённый язык: {info.language} (вероятность: {info.language_probability:.2%})")
        print(f"⏱️  Время транскрибации: {transcribe_time:.2f} сек ({transcribe_time/60:.2f} мин)")
        print(f"🎵 Длительность аудио: {info.duration:.1f} сек ({info.duration/60:.1f} мин)")
        print(f"📏 Длина текста: {len(text)} символов")
        print(f"📝 Количество слов: {len(text.split())}")
        
        print(f"\n📄 ТЕКСТ (первые 500 символов):")
        print("-" * 70)
        print(text[:500] + ("..." if len(text) > 500 else ""))
        print("-" * 70)
        
        # Сохранение
        output_file = f"transcription_faster_{os.path.basename(audio_file_path)}.txt"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(f"Файл: {audio_file_path}\n")
            f.write(f"Модель: faster-whisper ({model_name})\n")
            f.write(f"Устройство: {device.upper()}\n")
            f.write(f"Язык: {info.language} ({info.language_probability:.2%})\n")
            f.write(f"Длительность: {info.duration:.1f} сек\n")
            f.write(f"Время обработки: {transcribe_time:.2f} сек\n")
            f.write(f"\nТЕКСТ:\n{text}")
        
        print(f"\n💾 Полный текст сохранён: {output_file}")
        
        print(f"\n📊 СТАТИСТИКА:")
        speed_ratio = info.duration / transcribe_time
        print(f"   • Скорость: {speed_ratio:.1f}x реального времени")
        print(f"   • Модель: {model_name}")
        print(f"   • Устройство: {device.upper()}")
        print(f"   • Compute type: {compute_type}")
        
        if device == "cuda":
            print(f"\n🚀 GPU работает отлично!")
        
    except Exception as e:
        print(f"\n❌ Ошибка транскрибации: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("\n╔══════════════════════════════════════════════════════════════╗")
    print("║       FASTER-WHISPER ТЕСТЕР С CUDA ПОДДЕРЖКОЙ                ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    
    # ========== НАСТРОЙКИ ==========
    # Укажите путь к вашему аудиофайлу
    # Используйте либо / вместо \, либо r"..." (raw string)
    audio_file = r"C:\Users\sol20\Downloads\Ковтун 7 ноября лекция (1).m4a"
    
    # Модель (tiny, base, small, medium, large-v2, large-v3)
    # Для RTX 4060: medium отличный баланс
    model = "medium"
    
    # Устройство: "cuda" для GPU, "cpu" для процессора
    device = "cuda"  # GPU с CUDA
    # ================================
    
    if "ПУТЬ/К/ВАШЕМУ/ФАЙЛУ" in audio_file:
        print("\n⚠️  Вы не указали путь к аудиофайлу!")
        print("\n📝 Откройте test_faster_whisper.py и измените:")
        print('   audio_file = "C:/path/to/your/lecture.mp3"')
        print('   model = "medium"  # рекомендуется для RTX 4060')
        print('   device = "cuda"  # GPU ускорение')
        print("\n💡 Модели:")
        print("   • tiny/base - быстрые, менее точные")
        print("   • small - хороший баланс")
        print("   • medium - отличное качество (рекомендуется) ⭐")
        print("   • large-v2 - очень точная")
        print("   • large-v3 - максимальное качество")
        print("\n🎯 faster-whisper в 4 раза быстрее openai-whisper!")
    else:
        test_faster_whisper(audio_file, model, device)
    
    print("\n")
