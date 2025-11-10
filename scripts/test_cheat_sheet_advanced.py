"""
Расширенный тест режима "шпаргалка" (cheat_sheet)

Этот тест демонстрирует работу ML-обработчика Gemini в режиме создания шпаргалки.
Режим cheat_sheet оптимизирован для создания компактной выжимки с формулами и ключевыми фактами.

Запуск: python scripts/test_cheat_sheet_advanced.py
"""
import os
import sys
from pathlib import Path
from datetime import datetime

# Ensure repo root on sys.path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ml.gemini_processor import GeminiProcessor


def print_section(title: str):
    """Красивый вывод секции"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def print_subsection(title: str):
    """Красивый вывод подсекции"""
    print("\n" + "-" * 80)
    print(f"  {title}")
    print("-" * 80)


def main():
    print_section("🧾 РАСШИРЕННЫЙ ТЕСТ ML РЕЖИМА: СОЗДАНИЕ ШПАРГАЛКИ")
    
    print("\n📋 О режиме cheat_sheet:")
    print("   ├─ Назначение: создание компактной шпаргалки для быстрого повторения")
    print("   ├─ Формат вывода: структурированный Markdown")
    print("   ├─ Особенности: акцент на формулы, определения, ключевые факты")
    print("   ├─ Промпт: специально оптимизирован для сжатой выжимки")
    print("   └─ Применение: подготовка к экзаменам, быстрое повторение материала")
    
    print("\n🔧 Технические детали:")
    print("   ├─ ML модель: Google Gemini 2.0 Flash")
    print("   ├─ Backend: ml/gemini_processor.py -> create_cheat_sheet()")
    print("   ├─ API endpoint: POST /api/ml/process (mode='cheat_sheet')")
    print("   └─ Конфигурация: см. ml/prompts.py -> CHEAT_SHEET_PROMPT")
    
    print_subsection("Проверка API ключа")
    
    # Проверка API ключа
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("\n❌ ОШИБКА: GEMINI_API_KEY не найден в переменных окружения!")
        print("\n💡 Решение:")
        print("   1. Создайте файл .env в корне проекта")
        print("   2. Добавьте строку: GEMINI_API_KEY=your_key_here")
        print("   3. Получить ключ: https://aistudio.google.com/apikey")
        return 1
    
    print(f"✅ API ключ найден: {api_key[:8]}...{api_key[-4:]}")
    
    print_subsection("Подготовка тестовых данных")
    
    # Расширенный пример текста лекции по машинному обучению
    lecture_text = """
    МАШИННОЕ ОБУЧЕНИЕ - ОСНОВЫ
    
    Машинное обучение (ML) — это раздел искусственного интеллекта, который изучает методы, 
    позволяющие компьютерам улучшать качество решения задач на основе данных без явного 
    программирования правил.
    
    === ОСНОВНЫЕ ТИПЫ ОБУЧЕНИЯ ===
    
    1. Обучение с учителем (Supervised Learning)
       - Есть размеченные данные (пары вход-выход)
       - Примеры: классификация, регрессия
       - Алгоритмы: линейная регрессия, логистическая регрессия, SVM, деревья решений
    
    2. Обучение без учителя (Unsupervised Learning)
       - Нет разметки, ищем структуру в данных
       - Примеры: кластеризация, снижение размерности
       - Алгоритмы: K-means, DBSCAN, PCA, t-SNE
    
    3. Обучение с подкреплением (Reinforcement Learning)
       - Агент получает награды за действия
       - Примеры: игры, робототехника
       - Алгоритмы: Q-learning, DQN, PPO
    
    === КЛЮЧЕВЫЕ ПОНЯТИЯ ===
    
    Модель (Model) - математическая функция f(x) для предсказаний
    Признаки (Features) - входные переменные X = [x₁, x₂, ..., xₙ]
    Целевая переменная (Target) - то, что предсказываем Y
    Обучающая выборка (Training Set) - данные для обучения модели
    Тестовая выборка (Test Set) - данные для оценки качества
    Ошибка (Error/Loss) - разница между предсказанием и реальностью
    Переобучение (Overfitting) - модель слишком подстроилась под обучающие данные
    Недообучение (Underfitting) - модель слишком простая
    
    === ЛИНЕЙНАЯ РЕГРЕССИЯ ===
    
    Модель:
    y = w₀ + w₁x₁ + w₂x₂ + ... + wₙxₙ
    или в векторной форме: y = w^T * x + b
    
    Функция потерь (MSE - Mean Squared Error):
    L(w) = (1/n) * Σᵢ₌₁ⁿ (yᵢ - ŷᵢ)²
    где ŷᵢ = w^T * xᵢ - предсказание
    
    Оптимизация - градиентный спуск:
    w := w - α * ∂L/∂w
    где α - learning rate (скорость обучения)
    
    Градиент функции потерь:
    ∂L/∂w = -(2/n) * Σᵢ₌₁ⁿ (yᵢ - ŷᵢ) * xᵢ
    
    === МЕТОДЫ БОРЬБЫ С ПЕРЕОБУЧЕНИЕМ ===
    
    1. Регуляризация L1 (Lasso Regression)
       L(w) = MSE + λ * Σᵢ|wᵢ|
       Эффект: обнуляет неважные веса, отбор признаков
    
    2. Регуляризация L2 (Ridge Regression)
       L(w) = MSE + λ * Σᵢwᵢ²
       Эффект: уменьшает веса, но не обнуляет
    
    3. Elastic Net (комбинация L1 и L2)
       L(w) = MSE + λ₁ * Σᵢ|wᵢ| + λ₂ * Σᵢwᵢ²
    
    4. Кросс-валидация (Cross-Validation)
       - k-fold CV: разбиваем данные на k частей
       - Обучаем на k-1 части, тестируем на оставшейся
       - Повторяем k раз, усредняем результаты
    
    5. Early Stopping
       - Останавливаем обучение, когда ошибка на валидации растет
    
    6. Dropout (для нейросетей)
       - Случайное отключение нейронов во время обучения
    
    === МЕТРИКИ КАЧЕСТВА ===
    
    Для регрессии:
    - MSE = (1/n) * Σ(yᵢ - ŷᵢ)²
    - RMSE = √MSE
    - MAE = (1/n) * Σ|yᵢ - ŷᵢ|
    - R² = 1 - (SS_res / SS_tot)
    
    Для классификации:
    - Accuracy = (TP + TN) / (TP + TN + FP + FN)
    - Precision = TP / (TP + FP)  # Точность
    - Recall = TP / (TP + FN)     # Полнота
    - F1-score = 2 * (P * R) / (P + R)  # Гармоническое среднее
    
    где:
    TP (True Positive) - правильно предсказан положительный класс
    TN (True Negative) - правильно предсказан отрицательный класс
    FP (False Positive) - ошибочно предсказан положительный класс
    FN (False Negative) - ошибочно предсказан отрицательный класс
    
    === ВАЖНЫЕ ПРАКТИКИ ===
    
    1. Нормализация данных
       - Min-Max: x' = (x - min) / (max - min)
       - Z-score: x' = (x - μ) / σ
    
    2. Разделение данных
       - Train: 70-80%
       - Validation: 10-15%
       - Test: 10-15%
    
    3. Feature Engineering
       - Создание новых признаков
       - Полиномиальные признаки
       - Взаимодействия признаков
    
    4. Гиперпараметры
       - Подбор через Grid Search или Random Search
       - Примеры: learning rate, количество деревьев, глубина дерева
    
    === ПОПУЛЯРНЫЕ АЛГОРИТМЫ ===
    
    Линейные модели: Linear Regression, Logistic Regression, Perceptron
    Деревья: Decision Tree, Random Forest, Gradient Boosting (XGBoost, LightGBM)
    Кластеризация: K-means, DBSCAN, Hierarchical Clustering
    Снижение размерности: PCA, t-SNE, UMAP
    Нейронные сети: MLP, CNN, RNN, LSTM, Transformer
    """
    
    print(f"📄 Длина входного текста: {len(lecture_text)} символов")
    print(f"📊 Количество строк: {len(lecture_text.split(chr(10)))}")
    print(f"📝 Примерное количество слов: {len(lecture_text.split())}")
    
    print_subsection("Инициализация ML процессора")
    
    try:
        processor = GeminiProcessor()
        print("✅ GeminiProcessor успешно инициализирован")
        
        # Health check
        print("\n🔍 Выполняем health check Gemini API...")
        is_healthy = processor.health_check()
        
        if is_healthy:
            print("✅ Gemini API доступен и работает корректно")
        else:
            print("⚠️  Gemini API недоступен, но попробуем выполнить запрос...")
        
    except Exception as e:
        print(f"❌ Ошибка инициализации: {e}")
        return 2
    
    print_subsection("Обработка текста в режиме cheat_sheet")
    
    print("\n⏳ Отправляем запрос к Gemini API...")
    print("   (это может занять 5-15 секунд в зависимости от объема текста)")
    
    try:
        start_time = datetime.now()
        
        # Главная проверка - создание шпаргалки
        result = processor.create_cheat_sheet(lecture_text)
        
        end_time = datetime.now()
        elapsed = (end_time - start_time).total_seconds()
        
        print(f"\n✅ Шпаргалка успешно создана!")
        print(f"⏱️  Время обработки: {elapsed:.2f} секунд")
        
        print_subsection("Анализ результата")
        
        # Статистика результата
        result_length = len(result)
        result_lines = len(result.split('\n'))
        result_words = len(result.split())
        compression_ratio = (1 - result_length / len(lecture_text)) * 100
        
        print(f"\n📊 Статистика результата:")
        print(f"   ├─ Длина: {result_length} символов")
        print(f"   ├─ Строк: {result_lines}")
        print(f"   ├─ Слов: {result_words}")
        print(f"   ├─ Степень сжатия: {compression_ratio:.1f}%")
        print(f"   └─ Формат: Markdown")
        
        # Проверка на наличие ключевых элементов
        print(f"\n🔍 Проверка содержимого:")
        has_headers = '#' in result
        has_formulas = any(char in result for char in ['=', '∑', '√', '²', '₁'])
        has_lists = any(marker in result for marker in ['- ', '* ', '1. ', '2. '])
        has_code_blocks = '```' in result or '`' in result
        
        print(f"   ├─ Заголовки (H1-H6): {'✅' if has_headers else '❌'}")
        print(f"   ├─ Формулы/символы: {'✅' if has_formulas else '❌'}")
        print(f"   ├─ Списки: {'✅' if has_lists else '❌'}")
        print(f"   └─ Блоки кода: {'✅' if has_code_blocks else '❌'}")
        
        print_subsection("РЕЗУЛЬТАТ (превью первых 1500 символов)")
        
        print("\n" + result[:1500])
        if len(result) > 1500:
            print(f"\n... (показаны первые 1500 из {result_length} символов) ...")
        
        print_subsection("Сохранение результата")
        
        # Опция сохранения
        print("\n💾 Хотите сохранить полную шпаргалку в файл?")
        save = input("   Введите 'y' для сохранения, любой другой символ для пропуска: ").strip().lower()
        
        if save == 'y':
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_filename = f"cheat_sheet_output_{timestamp}.md"
            output_path = ROOT / "scripts" / output_filename
            
            # Сохраняем с метаданными
            full_output = f"""# Шпаргалка по лекции
            
**Создано:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}  
**Режим обработки:** cheat_sheet  
**ML модель:** Google Gemini 2.0 Flash  
**Время обработки:** {elapsed:.2f} сек  
**Исходный текст:** {len(lecture_text)} символов  
**Результат:** {result_length} символов  
**Сжатие:** {compression_ratio:.1f}%  

---

{result}
"""
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(full_output)
            
            print(f"\n✅ Шпаргалка сохранена: {output_path}")
            print(f"   Размер файла: {os.path.getsize(output_path)} байт")
        else:
            print("\n⏭️  Сохранение пропущено")
        
        print_section("✅ ТЕСТ УСПЕШНО ЗАВЕРШЕН")
        
        print("\n📈 Итоги теста:")
        print(f"   ✅ API доступен: {'Да' if is_healthy else 'Частично'}")
        print(f"   ✅ Обработка выполнена: Да")
        print(f"   ✅ Результат получен: Да ({result_length} символов)")
        print(f"   ✅ Время обработки: {elapsed:.2f} сек")
        print(f"   ✅ Формат Markdown: {'Да' if has_headers else 'Частично'}")
        
        print("\n💡 Следующие шаги:")
        print("   - Протестировать другие режимы (summarize, extract_terms, etc.)")
        print("   - Проверить работу через веб-интерфейс на http://localhost:3000")
        print("   - Посмотреть API документацию: http://127.0.0.1:8000/docs")
        
        return 0
        
    except Exception as e:
        print(f"\n❌ ОШИБКА во время обработки:")
        print(f"   Тип: {type(e).__name__}")
        print(f"   Сообщение: {str(e)}")
        print(f"\n🔧 Возможные причины:")
        print("   - Неверный API ключ")
        print("   - Нет доступа к интернету")
        print("   - Превышен лимит запросов к Gemini API")
        print("   - Ошибка в коде ml/gemini_processor.py")
        return 3


if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n⚠️  Тест прерван пользователем (Ctrl+C)")
        sys.exit(130)
    except Exception as e:
        print(f"\n\n❌ Неожиданная ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
