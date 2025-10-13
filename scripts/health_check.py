"""
Минимальный тест для проверки работоспособности DeepSeek API
"""

import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)

from ml.deepseek_processor import DeepSeekProcessor


def main():
    print("🔧 Проверка подключения к DeepSeek...")
    
    try:
        processor = DeepSeekProcessor()
        print("✅ DeepSeek процессор создан")
        
        if processor.health_check():
            print("✅ DeepSeek API работает")
            print("🎉 Система готова к работе!")
            return True
        else:
            print("❌ Проблемы с DeepSeek API")
            return False
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False


if __name__ == "__main__":
    success = main()
    if success:
        print("\n🚀 Проверка завершена успешно!")
    else:
        print("\n⚠️ Требуется проверка настроек")
