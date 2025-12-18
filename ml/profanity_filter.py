"""
Профанити-фильтр для удаления запрещённых слов из транскрибированного текста

Этот модуль работает ЛОКАЛЬНО без API запросов и фильтрует текст ДО отправки в Gemini,
предотвращая блокировку из-за случайных ошибок транскрибации Whisper.

ВАЖНО: Фильтр применяется ВСЕГДА, независимо от настроек пользователя!
"""

import re
import logging
from typing import Dict, List, Set

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ProfanityFilter:
    """
    Класс для локальной фильтрации запрещённых слов
    
    Работает без API запросов, мгновенно и надёжно.
    Удаляет слова, которые могут вызвать блокировку Gemini API.
    """
    
    def __init__(self):
        """Инициализация фильтра с словарями запрещённых слов"""
        
        # ===== РУССКИЕ ЗАПРЕЩЁННЫЕ СЛОВА =====
        # Словарь: запрещённое_слово -> безопасная_замена
        self.russian_profanity = {
            # Матерные слова и их вариации (с разными окончаниями)
            r'\bб[л]?я[дт]ь?\b': '[слово]',
            r'\bб[л]?я\b': '[слово]',
            r'\bб[л]?я[дт][иеёюяуыаь]+\b': '[слово]',
            r'\bп[иеё]зд[аеиоуыяюь]*\b': '[слово]',
            r'\bху[йеёияюь]+\b': '[слово]',
            r'\bху[йи]\b': '[слово]',
            r'\bе[бп][аеиоуыяюь]*[тл][ь]?\b': '[слово]',
            r'\bе[бп]а[лнт]*[ьа]?\b': '[слово]',
            r'\bзае[бп]\b': '[слово]',
            r'\bнае[бп]\b': '[слово]',
            r'\bдоеб\b': '[слово]',
            r'\bдолбо[её]б\b': '[слово]',
            r'\bпро[её]б\b': '[слово]',
            r'\bобос[рс][аеиоуы]*\b': '[слово]',
            r'\bсра[лт][ьи]?\b': '[слово]',
            r'\bдерьм[оа]\b': '[слово]',
            r'\bговн[оа]\b': '[слово]',
            r'\bмуд[аеиоуыяюь]+\b': '[слово]',
            r'\bхер[аеиоуыя]*\b': '[слово]',
            
            # Сексуальные термины (часто ошибки транскрипции)
            r'\bсекс[аеиоуы]*\b': 'интимные отношения',
            r'\bтрах[аеиоуы]*\b': '[слово]',
            r'\bсоси\b': '[слово]',
            r'\bминет\b': '[слово]',
            r'\bблядь\b': '[слово]',
            r'\bпроститутк[аеи]\b': '[слово]',
            r'\bшлюх[аеи]\b': '[слово]',
            r'\bпорн[оа]\b': '[слово]',
            r'\bпохот[ьи]\b': '[слово]',
            
            # Оскорбления
            r'\bдебил[аы]?\b': 'некорректное выражение',
            r'\bидиот[аы]?\b': 'некорректное выражение',
            r'\bкретин[аы]?\b': 'некорректное выражение',
            r'\bдурак[аи]?\b': 'некорректное выражение',
            r'\bтупой\b': 'некорректное выражение',
            r'\bмразь\b': '[слово]',
            r'\bсука\b': '[слово]',
            r'\bсучк[аеи]\b': '[слово]',
            r'\bпидор[аы]?\b': '[слово]',
            r'\bгандон[аы]?\b': '[слово]',
            r'\bуёбок\b': '[слово]',
            r'\bуебок\b': '[слово]',
            r'\bмудак[аи]?\b': '[слово]',
            r'\bскотин[аы]\b': '[слово]',
            r'\bублюдок\b': '[слово]',
            r'\bтварь\b': '[слово]',
        }
        
        # ===== АНГЛИЙСКИЕ ЗАПРЕЩЁННЫЕ СЛОВА =====
        self.english_profanity = {
            # Матерные слова
            r'\bfuck(ing|ed|er|s)?\b': '[word]',
            r'\bshit(ty|s)?\b': '[word]',
            r'\bass(hole|es)?\b': '[word]',
            r'\bbitch(es|y)?\b': '[word]',
            r'\bbastard(s)?\b': '[word]',
            r'\bdamn(ed)?\b': '[word]',
            r'\bhell\b': '[word]',
            r'\bcrap(py|s)?\b': '[word]',
            r'\bpiss(ed|ing)?\b': '[word]',
            r'\bcock(s)?\b': '[word]',
            r'\bdick(s|head)?\b': '[word]',
            r'\bpussy\b': '[word]',
            r'\bcunt(s)?\b': '[word]',
            r'\bmotherfucker(s)?\b': '[word]',
            
            # Сексуальные термины
            r'\bsex(ual|y)?\b': 'intimate relations',
            r'\bporn(o|ography)?\b': '[word]',
            r'\bnude(s|ity)?\b': '[word]',
            r'\bwhore(s)?\b': '[word]',
            r'\bslut(s|ty)?\b': '[word]',
            r'\bblow\s?job\b': '[word]',
            r'\bhandjob\b': '[word]',
            
            # Оскорбления
            r'\bidiot(s|ic)?\b': 'inappropriate expression',
            r'\bstupid\b': 'inappropriate expression',
            r'\bmoron(s)?\b': 'inappropriate expression',
            r'\bimbecile(s)?\b': 'inappropriate expression',
            r'\bretard(ed|s)?\b': 'inappropriate expression',
        }
        
        # Объединяем все паттерны
        self.all_patterns = {**self.russian_profanity, **self.english_profanity}
        
        # Компилируем регулярные выражения для производительности
        self.compiled_patterns = {
            re.compile(pattern, re.IGNORECASE): replacement
            for pattern, replacement in self.all_patterns.items()
        }
        
        logger.info(f"✅ ProfanityFilter инициализирован ({len(self.compiled_patterns)} паттернов)")
    
    def filter_text(self, text: str) -> tuple[str, bool]:
        """
        Фильтрует текст, заменяя запрещённые слова на безопасные альтернативы
        
        Args:
            text: Исходный текст для фильтрации
        
        Returns:
            tuple: (отфильтрованный_текст, были_ли_замены)
        """
        if not text or len(text.strip()) == 0:
            return text, False
        
        original_text = text
        filtered_text = text
        replacements_made = []
        
        # Применяем все паттерны
        for pattern, replacement in self.compiled_patterns.items():
            matches = pattern.findall(filtered_text)
            if matches:
                replacements_made.extend(matches)
                filtered_text = pattern.sub(replacement, filtered_text)
        
        # Логируем, если были замены
        if replacements_made:
            logger.warning(f"⚠️ Профанити-фильтр: обнаружено {len(replacements_made)} запрещённых слов")
            unique_words = list(set(replacements_made))[:5]  # Преобразуем в список для индексации
            logger.info(f"🔍 Заменённые слова: {', '.join(unique_words)}...")  # Первые 5 уникальных
            logger.info(f"📊 Длина до: {len(original_text)}, после: {len(filtered_text)}")
            return filtered_text, True
        else:
            logger.info("✅ Профанити-фильтр: запрещённых слов не обнаружено")
            return filtered_text, False
    
    def check_contains_profanity(self, text: str) -> bool:
        """
        Проверяет, содержит ли текст запрещённые слова
        
        Args:
            text: Текст для проверки
        
        Returns:
            bool: True, если есть запрещённые слова
        """
        if not text:
            return False
        
        for pattern in self.compiled_patterns.keys():
            if pattern.search(text):
                return True
        
        return False
    
    def get_profanity_count(self, text: str) -> int:
        """
        Подсчитывает количество запрещённых слов в тексте
        
        Args:
            text: Текст для анализа
        
        Returns:
            int: Количество найденных запрещённых слов
        """
        if not text:
            return 0
        
        count = 0
        for pattern in self.compiled_patterns.keys():
            matches = pattern.findall(text)
            count += len(matches)
        
        return count


# ===== ГЛОБАЛЬНЫЙ ЭКЗЕМПЛЯР ФИЛЬТРА =====
_filter_instance = None

def get_filter() -> ProfanityFilter:
    """
    Получает глобальный экземпляр фильтра (синглтон)
    
    Returns:
        ProfanityFilter: Экземпляр фильтра
    """
    global _filter_instance
    if _filter_instance is None:
        _filter_instance = ProfanityFilter()
    return _filter_instance


# ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

def filter_profanity(text: str) -> str:
    """
    Быстрая фильтрация текста без создания экземпляра
    
    Args:
        text: Текст для фильтрации
    
    Returns:
        str: Отфильтрованный текст
    """
    filter_instance = get_filter()
    filtered_text, _ = filter_instance.filter_text(text)
    return filtered_text


def check_profanity(text: str) -> bool:
    """
    Быстрая проверка наличия запрещённых слов
    
    Args:
        text: Текст для проверки
    
    Returns:
        bool: True, если есть запрещённые слова
    """
    filter_instance = get_filter()
    return filter_instance.check_contains_profanity(text)


# ===== ТЕСТИРОВАНИЕ =====
if __name__ == "__main__":
    print("🧪 Тестирование ProfanityFilter")
    print("=" * 60)
    
    test_cases = [
        "Сегодня мы изучаем интеграл от функции",  # Чистый текст
        "Вот блядь какая сложная задача",  # Русский мат
        "This is a fucking difficult problem",  # Английский мат
        "Ебать как сложно блять понять этот код fuck shit",  # Смешанный
        "Программирование это искусство",  # Чистый
    ]
    
    filter_instance = ProfanityFilter()
    
    for i, test in enumerate(test_cases, 1):
        print(f"\nТест #{i}:")
        print(f"Оригинал: {test}")
        
        filtered, has_changes = filter_instance.filter_text(test)
        count = filter_instance.get_profanity_count(test)
        
        print(f"Фильтр:   {filtered}")
        print(f"Замены:   {'Да' if has_changes else 'Нет'}")
        print(f"Найдено:  {count} запрещённых слов")
    
    print("\n" + "=" * 60)
    print("✅ Тестирование завершено")
