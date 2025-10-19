"""
Простой тест Nexara API без uvicorn
Тестирует транскрибацию напрямую
ИСПРАВЛЕННАЯ ВЕРСИЯ с правильными MIME-типами
"""

import requests
import os
from dotenv import load_dotenv

# Загружаем API ключ из .env
load_dotenv()

def test_nexara_transcription(audio_file_path):
    """
    Простая функция для тестирования Nexara API
    """
    print("=" * 60)
    print("🎙️  ТЕСТ ТРАНСКРИБАЦИИ NEXARA API")
    print("=" * 60)
    
    # Получаем API ключ
    api_key = os.getenv('NEXARA_API_KEY')
    
    if not api_key:
        print("❌ ОШИБКА: NEXARA_API_KEY не найден в .env файле!")
        print("📝 Добавьте в .env файл строку:")
        print("   NEXARA_API_KEY=ваш-ключ-здесь")
        return
    
    print(f"✅ API ключ найден: {api_key[:10]}...")
    
    # Проверяем, существует ли файл
    if not os.path.exists(audio_file_path):
        print(f"❌ ОШИБКА: Файл не найден: {audio_file_path}")
        print("📝 Укажите правильный путь к аудиофайлу")
        return
    
    print(f"✅ Файл найден: {audio_file_path}")
    
    # Проверяем формат файла
    allowed_formats = ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'opus', 'mp4', 'mov', 'avi', 'mkv', 'webm']
    file_extension = audio_file_path.split('.')[-1].lower()
    
    if file_extension not in allowed_formats:
        print(f"❌ ОШИБКА: Формат {file_extension} не поддерживается")
        print(f"📝 Разрешённые форматы: {', '.join(allowed_formats)}")
        return
    
    print(f"✅ Формат файла поддерживается: {file_extension}")
    
    # Размер файла
    file_size = os.path.getsize(audio_file_path)
    file_size_mb = file_size / (1024 * 1024)
    print(f"📦 Размер файла: {file_size_mb:.2f} МБ")
    
    if file_size_mb > 1000:  # 1 ГБ лимит
        print("⚠️  ВНИМАНИЕ: Файл больше 1 ГБ, может не загрузиться!")
    
    print("\n🚀 Начинаем транскрибацию...")
    print("⏳ Это может занять некоторое время в зависимости от длительности аудио...")
    
    try:
        # ИСПРАВЛЕНО: Правильные MIME-типы для каждого формата
        mime_types = {
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'm4a': 'audio/x-m4a',  # ← КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ!
            'flac': 'audio/flac',
            'ogg': 'audio/ogg',
            'opus': 'audio/opus',
            'mp4': 'video/mp4',
            'mov': 'video/quicktime',
            'avi': 'video/x-msvideo',
            'mkv': 'video/x-matroska',
            'webm': 'video/webm'
        }
        
        # Получаем правильный MIME-тип
        mime_type = mime_types.get(file_extension, f'audio/{file_extension}')
        print(f"📋 MIME-тип: {mime_type}")
        
        # Настройки запроса
        url = "https://api.nexara.ru/api/v1/audio/transcriptions"
        headers = {
            "Authorization": f"Bearer {api_key}"
        }
        
        # Открываем и отправляем файл
        with open(audio_file_path, 'rb') as audio_file:
            files = {
                'file': (os.path.basename(audio_file_path), audio_file, mime_type)
            }
            data = {
                'response_format': 'json'
            }
            
            # Делаем запрос
            response = requests.post(
                url,
                headers=headers,
                files=files,
                data=data,
                timeout=300  # 5 минут
            )
        
        # Проверяем результат
        print(f"\n📡 Статус ответа: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            print("\n" + "=" * 60)
            print("✅ ТРАНСКРИБАЦИЯ УСПЕШНА!")
            print("=" * 60)
            
            # Выводим результаты
            text = result.get('text', '')
            duration = result.get('duration')
            language = result.get('language')
            
            print(f"\n🌍 Язык: {language}")
            print(f"⏱️  Длительность: {duration} секунд" if duration else "")
            print(f"📏 Длина текста: {len(text)} символов")
            print(f"📝 Количество слов: {len(text.split())}")
            
            print("\n📄 ТЕКСТ ТРАНСКРИПЦИИ:")
            print("-" * 60)
            # Выводим первые 500 символов
            if len(text) > 500:
                print(text[:500] + "...")
                print(f"\n... (ещё {len(text) - 500} символов)")
            else:
                print(text)
            print("-" * 60)
            
            # Сохраняем в файл
            output_file = "transcription_result.txt"
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(f"Файл: {audio_file_path}\n")
                f.write(f"Язык: {language}\n")
                f.write(f"Длительность: {duration} сек\n")
                f.write(f"\nТЕКСТ:\n{text}")
            
            print(f"\n💾 Полный текст сохранён в файл: {output_file}")
            
        else:
            print("\n❌ ОШИБКА ПРИ ТРАНСКРИБАЦИИ")
            print(f"Код ошибки: {response.status_code}")
            print(f"Ответ сервера: {response.text}")
            
    except requests.exceptions.Timeout:
        print("\n⏱️  ОШИБКА: Превышено время ожидания (более 5 минут)")
        print("💡 Попробуйте с более коротким аудио")
        
    except requests.exceptions.ConnectionError:
        print("\n🌐 ОШИБКА: Нет соединения с интернетом")
        print("💡 Проверьте подключение к интернету")
        
    except Exception as e:
        print(f"\n❌ НЕОЖИДАННАЯ ОШИБКА: {str(e)}")
        print(f"Тип ошибки: {type(e).__name__}")


if __name__ == "__main__":
    print("\n")
    print("╔════════════════════════════════════════════════════════╗")
    print("║   ПРОСТОЙ ТЕСТЕР ТРАНСКРИБАЦИИ NEXARA API              ║")
    print("║            ИСПРАВЛЕННАЯ ВЕРСИЯ v2.0                    ║")
    print("╚════════════════════════════════════════════════════════╝")
    print("\n")
    
    # ========== НАСТРОЙКА: УКАЖИТЕ ПУТЬ К ВАШЕМУ АУДИОФАЙЛУ ==========
    audio_file = "C:/Users/Михаил/Downloads/Абоба.m4a"  # ЗАМЕНИТЕ ЭТО!
    
    # ==================================================================
    
    if "ПУТЬ/К/ВАШЕМУ/ФАЙЛУ" in audio_file:
        print("⚠️  ВНИМАНИЕ: Вы не указали путь к аудиофайлу!")
        print("\n📝 Откройте файл simple_test.py и замените строку:")
        print('   audio_file = "ПУТЬ/К/ВАШЕМУ/ФАЙЛУ.m4a"')
        print("   на реальный путь, например:")
        print('   audio_file = "C:/Users/Hobana9/Downloads/lecture.m4a"')
        print("\n💡 Затем запустите снова: python simple_test.py")
    else:
        test_nexara_transcription(audio_file)
    
    print("\n")