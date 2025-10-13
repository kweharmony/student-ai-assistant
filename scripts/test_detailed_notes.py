"""
Тест нового режима: Расширенный конспект с подробным описанием терминов
Запуск: python scripts/test_detailed_notes.py
"""
import os
import sys
from pathlib import Path
from datetime import datetime

# Ensure repo root on sys.path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ml.deepseek_processor import DeepSeekProcessor


def test_detailed_notes():
    """Тестирование расширенного конспекта"""
    
    # Тестовый текст
    test_text = """
    Машинное обучение — это область искусственного интеллекта, которая использует 
    статистические методы для обучения компьютерных систем выполнению задач без 
    явного программирования. Основными типами машинного обучения являются обучение 
    с учителем (supervised learning), обучение без учителя (unsupervised learning) 
    и обучение с подкреплением (reinforcement learning).
    
    Нейронные сети — это вычислительные модели, вдохновленные структурой 
    биологического мозга. Они состоят из слоев взаимосвязанных узлов (нейронов), 
    которые обрабатывают информацию. Глубокое обучение (deep learning) использует 
    нейронные сети с множеством слоев для решения сложных задач.
    
    Градиентный спуск — это оптимизационный алгоритм, используемый для минимизации 
    функции потерь в процессе обучения модели. Он итеративно корректирует параметры 
    модели в направлении, противоположном градиенту функции потерь.
    """
    
    print("=" * 70)
    print("🧪 ТЕСТ: РАСШИРЕННЫЙ КОНСПЕКТ С ДЕТАЛЬНЫМ ОПИСАНИЕМ ТЕРМИНОВ")
    print("=" * 70)
    
    if not os.getenv('DEEPSEEK_API_KEY'):
        print("\n❌ DEEPSEEK_API_KEY не найден!")
        return
    
    try:
        print("\n🔧 Инициализация процессора...")
        processor = DeepSeekProcessor()
        
        print("✅ Процессор готов")
        print(f"\n📝 Исходный текст ({len(test_text)} символов):")
        print("-" * 70)
        print(test_text.strip())
        print("-" * 70)
        
        print("\n⏳ Создание расширенного конспекта...")
        print("   (это может занять 30-60 секунд для детального анализа)")
        
        start = datetime.now()
        detailed_notes = processor.create_detailed_notes(test_text)
        time_taken = (datetime.now() - start).total_seconds()
        
        print(f"\n✅ Расширенный конспект создан за {time_taken:.2f} секунд")
        print(f"📊 Размер результата: {len(detailed_notes)} символов")
        
        print("\n" + "=" * 70)
        print("📋 РЕЗУЛЬТАТ:")
        print("=" * 70)
        print(detailed_notes)
        print("=" * 70)
        
        # Сохранение в файл
        save = input("\n💾 Сохранить результат в файл? (y/n): ").strip().lower()
        if save == 'y':
            output_file = ROOT / "scripts" / "detailed_notes_result.txt"
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(f"РАСШИРЕННЫЙ КОНСПЕКТ\n")
                f.write(f"Создан: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"{'=' * 70}\n\n")
                f.write(detailed_notes)
            print(f"✅ Сохранено в: {output_file}")
        
        print("\n🎉 Тест завершен успешно!")
        
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    test_detailed_notes()
