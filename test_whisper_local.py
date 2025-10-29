"""
Тест локальной транскрибации Whisper
БЕЗ запуска сервера, прямое тестирование
"""

import whisper
import os
import time

def test_local_whisper(audio_file_path, model_name="base"):
    """
    Тестирует локальный Whisper
    """
    
    print("\n" + "=" * 70)
    print("🎙️  ТЕСТ ЛОКАЛЬНОЙ ТРАНСКРИБАЦИИ WHISPER")
    print("=" * 70)
    
    # Проверка файла
    if not os.path.exists(audio_file_path):
        print(f"\n❌ Файл не найден: {audio_file_path}")
        return
    
    file_size_mb = os.path.getsize(audio_file_path) / (1024 * 1024)
    print(f"\n✅ Файл найден: {audio_file_path}")
    print(f"📦 Размер: {file_size_mb:.2f} MB")
    
    # Загрузка модели
    print(f"\n🔄 Загружаем модель '{model_name}'...")
    start_load = time.time()
    
    try:
        model = whisper.load_model(model_name)
        load_time = time.time() - start_load
        print(f"✅ Модель загружена за {load_time:.2f} сек")
    except Exception as e:
        print(f"❌ Ошибка загрузки модели: {e}")
        return
    
    # Транскрибация
    print(f"\n🎙️ Начинаем транскрибацию...")
    print(f"⏳ Это может занять время для длинных файлов...")
    print(f"💡 Примерное время: ~{file_size_mb * 0.5:.1f}-{file_size_mb:.1f} минут\n")
    
    start_transcribe = time.time()
    
    try:
        result = model.transcribe(
            audio_file_path,
            language='ru',  # Русский язык
            task='transcribe',
            fp16=False,
            verbose=False  # Показывать прогресс
        )
        
        transcribe_time = time.time() - start_transcribe
        
        print("\n" + "=" * 70)
        print("✅ ТРАНСКРИБАЦИЯ ЗАВЕРШЕНА!")
        print("=" * 70)
        
        text = result['text']
        language = result.get('language', 'unknown')
        
        print(f"\n🌍 Определённый язык: {language}")
        print(f"⏱️  Время транскрибации: {transcribe_time:.2f} сек ({transcribe_time/60:.2f} мин)")
        print(f"📏 Длина текста: {len(text)} символов")
        print(f"📝 Количество слов: {len(text.split())}")
        
        print(f"\n📄 ТЕКСТ (первые 500 символов):")
        print("-" * 70)
        print(text[:500] + ("..." if len(text) > 500 else ""))
        print("-" * 70)
        
        # Сохранение
        output_file = f"transcription_local_{os.path.basename(audio_file_path)}.txt"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(f"Файл: {audio_file_path}\n")
            f.write(f"Модель: {model_name}\n")
            f.write(f"Язык: {language}\n")
            f.write(f"Время: {transcribe_time:.2f} сек\n")
            f.write(f"\nТЕКСТ:\n{text}")
        
        print(f"\n💾 Полный текст сохранён: {output_file}")
        
        print(f"\n📊 СТАТИСТИКА:")
        print(f"   • Скорость: ~{file_size_mb/transcribe_time:.2f} MB/сек")
        print(f"   • Модель: {model_name}")
        
    except Exception as e:
        print(f"\n❌ Ошибка транскрибации: {e}")


if __name__ == "__main__":
    print("\n╔══════════════════════════════════════════════════════════════╗")
    print("║       ТЕСТЕР ЛОКАЛЬНОГО WHISPER ДЛЯ ТРАНСКРИБАЦИИ            ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    
    # ========== НАСТРОЙКИ ==========
    # Укажите путь к вашему аудиофайлу
    audio_file = "ПУТЬ/К/ВАШЕМУ/ФАЙЛУ"
    
    # Модель (tiny, base, small, medium, large)
    model = "base"
    # ================================
    
    if "ПУТЬ/К/ВАШЕМУ/ФАЙЛУ" in audio_file:
        print("\n⚠️  Вы не указали путь к аудиофайлу!")
        print("\n📝 Откройте test_whisper_local.py и измените:")
        print('   audio_file = "C:/path/to/your/lecture.mp3"')
        print('   model = "base"  # или small, medium для лучшего качества')
    else:
        test_local_whisper(audio_file, model)
    
    print("\n")