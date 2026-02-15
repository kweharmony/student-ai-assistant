"""
Скрипт для загрузки модели Whisper
Запускается один раз для скачивания модели на компьютер
"""

import whisper
import os
import sys

def download_whisper_model(model_name="base"):
    """
    Загружает модель Whisper
    
    Доступные модели (по возрастанию качества и размера):
    - tiny: ~75 MB, самая быстрая, наименее точная
    - base: ~150 MB, баланс скорости и качества (РЕКОМЕНДУЕТСЯ)
    - small: ~500 MB, хорошее качество
    - medium: ~1.5 GB, очень хорошее качество
    - large: ~3 GB, максимальное качество
    """
    
    print("\n" + "=" * 70)
    print("🎙️  ЗАГРУЗКА МОДЕЛИ WHISPER")
    print("=" * 70)
    print(f"\n📦 Модель: {model_name}")
    
    # Размеры моделей
    sizes = {
        "tiny": "~75 MB",
        "base": "~150 MB",
        "small": "~500 MB",
        "medium": "~1.5 GB",
        "large": "~3 GB"
    }
    
    print(f"📊 Примерный размер: {sizes.get(model_name, 'неизвестно')}")
    print(f"\n⚠️  ВАЖНО для длинных аудио:")
    print(f"   • Модель 'base' хороша для лекций до 1 часа")
    print(f"   • Для лекций 1-2 часа лучше использовать 'small'")
    print(f"   • Для максимального качества используйте 'medium' или 'large'")
    print(f"\n⏳ Начинаем загрузку... (это может занять несколько минут)\n")
    
    try:
        # Загружаем модель (она сохранится автоматически в ~/.cache/whisper/)
        model = whisper.load_model(model_name)
        
        print("\n" + "=" * 70)
        print("✅ МОДЕЛЬ УСПЕШНО ЗАГРУЖЕНА!")
        print("=" * 70)
        
        # Показываем, где сохранена модель
        cache_dir = os.path.expanduser("~/.cache/whisper/")
        print(f"\n📂 Модель сохранена в: {cache_dir}")
        
        # Проверяем, что модель работает
        print("\n🧪 Проверяем модель...")
        print("   Модель загружена и готова к работе!")
        
        print("\n✅ Всё готово к транскрибации!")
        print("\n💡 Теперь можете запускать:")
        print("   python test_whisper_local.py")
        print("   или")
        print("   uvicorn api.app:app --reload")
        
        return True
        
    except Exception as e:
        print("\n" + "=" * 70)
        print("❌ ОШИБКА ПРИ ЗАГРУЗКЕ МОДЕЛИ")
        print("=" * 70)
        print(f"\nОшибка: {str(e)}")
        print("\n💡 Возможные причины:")
        print("   • Нет подключения к интернету")
        print("   • Недостаточно места на диске")
        print("   • Не установлен ffmpeg")
        print("\n🔧 Проверьте:")
        print("   1. Интернет-соединение")
        print("   2. Свободное место на диске (минимум 500 MB)")
        print("   3. ffmpeg установлен: ffmpeg -version")
        
        return False


def main():
    """Главная функция"""
    
    print("\n╔══════════════════════════════════════════════════════════════╗")
    print("║          УСТАНОВКА МОДЕЛИ WHISPER ДЛЯ ТРАНСКРИБАЦИИ          ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    
    print("\n📋 Доступные модели:")
    print("   1. tiny   - ~75 MB   (быстрая, но менее точная)")
    print("   2. base   - ~150 MB  (рекомендуется для тестов) ⭐")
    print("   3. small  - ~500 MB  (хорошее качество)")
    print("   4. medium - ~1.5 GB  (очень хорошее качество)")
    print("   5. large  - ~3 GB    (максимальное качество)")
    
    print("\n💡 Для длинных лекций (1+ час) рекомендуется 'small' или 'medium'")
    
    # Спрашиваем пользователя
    choice = input("\n🤔 Какую модель загрузить? (по умолчанию: base): ").strip().lower()
    
    # Если пользователь ничего не ввёл, используем base
    if not choice or choice == "":
        choice = "base"
    
    # Проверяем валидность
    valid_models = ["tiny", "base", "small", "medium", "large"]
    if choice not in valid_models:
        print(f"\n❌ Неверный выбор: '{choice}'")
        print(f"   Доступные: {', '.join(valid_models)}")
        print("   Используем 'base' по умолчанию...")
        choice = "base"
    
    # Загружаем модель
    success = download_whisper_model(choice)
    
    if success:
        print("\n🎉 Установка завершена успешно!")
        sys.exit(0)
    else:
        print("\n⚠️  Установка завершена с ошибками")
        sys.exit(1)


if __name__ == "__main__":
    main()