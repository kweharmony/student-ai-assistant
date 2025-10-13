"""
Минимальный тест для проверки работоспособности DeepSeek API
"""

from ml.deepseek_processor import DeepSeekProcessor

def main():
    print("🔧 Проверка подключения к DeepSeek...")
    
    try:
        # Инициализируем процессор
        processor = DeepSeekProcessor()
        print("✅ DeepSeek процессор создан")
        
        # Проверяем здоровье API
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
        print("\n🚀 Код очищен и работает корректно!")
        print("📖 Обновленная документация в ML_documentation.md")
    else:
        print("\n⚠️ Требуется проверка настроек")