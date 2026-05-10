"""
FastAPI эндпоинты для ML обработки текста
Интеграция DeepSeek API через VseLLM провайдер
"""

from fastapi import APIRouter, HTTPException, Request, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import logging
import json
import re
from datetime import datetime
import os
from openai import OpenAI
from dotenv import load_dotenv

# Импортируем DeepSeek процессор
try:
    from ..ml.deepseek_processor import DeepSeekProcessor
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from ml.deepseek_processor import DeepSeekProcessor

# Настройка логирования
logger = logging.getLogger(__name__)

load_dotenv()

# Создаем роутер
router = APIRouter(prefix="/api/ml", tags=["ML Text Processing"])

# Глобальный экземпляр процессора (stateless, безопасен для параллельных запросов)
processor = None
polza_client: Optional[OpenAI] = None

POLZA_BASE_URL = os.getenv('POLZA_BASE_URL', 'https://polza.ai/api/v1')
POLZA_API_KEY = os.getenv('POLZA_API_KEY')
POLZA_MODEL = os.getenv('POLZA_MODEL', 'deepseek/deepseek-v4-flash')

DIAGRAM_BASE_URL = os.getenv('DIAGRAM_BASE_URL', POLZA_BASE_URL)
DIAGRAM_API_KEY = os.getenv('DIAGRAM_API_KEY', POLZA_API_KEY)
DIAGRAM_MODEL = os.getenv('DIAGRAM_MODEL', 'google/gemma-3-27b-it')

EXPLAIN_SYSTEM_PROMPT = (
    "Ты — учебный ассистент. Объясняй фрагменты лекций простым, понятным языком. "
    "Сохраняй точность, не выдумывай факты. Если контекста мало — попроси уточнение. "
    "Структура ответа: краткое резюме, пошаговое объяснение, пример/аналогия, мини-словарь, "
    "1-2 контрольных вопроса. Пиши по-русски."
)

def get_processor():
    """Получение глобального экземпляра процессора"""
    global processor
    if processor is None:
        processor = DeepSeekProcessor()
    return processor


def get_polza_client() -> OpenAI:
    global polza_client
    if polza_client is None:
        if not POLZA_API_KEY:
            raise HTTPException(status_code=500, detail="POLZA_API_KEY не найден в переменных окружения")
        polza_client = OpenAI(api_key=POLZA_API_KEY, base_url=POLZA_BASE_URL)
    return polza_client


def get_diagram_client() -> OpenAI:
    if not DIAGRAM_API_KEY:
        raise HTTPException(status_code=500, detail="DIAGRAM_API_KEY не найден в переменных окружения")
    return OpenAI(api_key=DIAGRAM_API_KEY, base_url=DIAGRAM_BASE_URL)


# Модели данных для API
class ProcessRequest(BaseModel):
    """Запрос на обработку текста"""
    text: str = Field(..., min_length=10, max_length=70000, description="Текст лекции для обработки")
    mode: str = Field(..., description="Режим обработки: summarize, extract_terms, expand_topic, generate_questions, detailed_notes, cheat_sheet")
    topic: Optional[str] = Field(None, description="Тема для расширения (только для режима expand_topic)")
    context: Optional[str] = Field(None, description="Дополнительный контекст (для режима expand_topic)")

class BatchProcessRequest(BaseModel):
    """Запрос на пакетную обработку текста"""
    text: str = Field(..., min_length=10, max_length=70000, description="Текст лекции")
    modes: List[str] = Field(..., min_items=1, max_items=5, description="Список режимов обработки")

class ProcessResponse(BaseModel):
    """Ответ обработки текста"""
    success: bool
    mode: str
    processed_text: str
    processing_time: float
    timestamp: datetime
    error: Optional[str] = None

class BatchProcessResponse(BaseModel):
    """Ответ пакетной обработки"""
    success: bool
    results: Dict[str, str]
    total_processing_time: float
    timestamp: datetime
    errors: Optional[Dict[str, str]] = None

class HealthResponse(BaseModel):
    """Ответ проверки здоровья API"""
    status: str
    gemini_api_available: bool
    message: str
    timestamp: datetime


class ExplainRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=6000, description="Фрагмент лекции")
    lecture_title: Optional[str] = Field(None, max_length=300, description="Название лекции")
    question: Optional[str] = Field(None, max_length=300, description="Что именно нужно объяснить")


class ExplainResponse(BaseModel):
    success: bool
    explanation: str
    model: str
    processing_time: float
    timestamp: datetime
    error: Optional[str] = None


class QuickSummaryRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=70000, description="Текст лекции")


class DiagramRequest(BaseModel):
    text: str = Field(..., min_length=5, max_length=12000, description="Описание схемы")
    layout: Optional[str] = Field("auto", description="auto | LR | TB | GRID | MINDMAP")
    max_nodes: int = Field(12, ge=3, le=30)


class DiagramResponse(BaseModel):
    success: bool
    diagram: Optional[dict] = None
    model: str
    processing_time: float
    timestamp: datetime
    error: Optional[str] = None


DIAGRAM_SYSTEM_PROMPT = (
    "Ты преобразуешь пользовательский текст в JSON-схему для рисования. "
    "Возвращай ТОЛЬКО валидный JSON без пояснений и без markdown. "
    "Формат: {nodes:[{id,text,type}], edges:[{from,to,label?}], layout:{direction,spacingX,spacingY}}. "
    "id в формате n1,n2... type: box | table | note. "
    "Если пользователь просит таблицу, верни ОДИН узел с type=table и без edges. "
    "Для table используй text с строками, разделенными \"\\n\", и колонками через \" | \". "
    "Если таблица не запрошена, используй type=box и добавляй edges ТОЛЬКО при явной связи. "
    "Не делай полносвязный граф; не соединяй все со всеми. "
    "Если связи не описаны — edges пустой. Для линейного процесса соединяй по порядку. "
    "direction: LR или TB или GRID. spacingX, spacingY — числа. "
    "Не больше max_nodes узлов."
)


def _extract_json_payload(raw: str) -> dict:
    text = raw.strip()
    text = re.sub(r"^```[a-zA-Z]*", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("JSON not found")
    payload = text[start:end + 1]
    return json.loads(payload)


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Проверка работоспособности ML API"""
    try:
        proc = get_processor()
        is_available = proc.health_check()
        
        return HealthResponse(
            status="healthy" if is_available else "unhealthy",
            gemini_api_available=is_available,  # Оставляем поле для совместимости
            message="DeepSeek API работает корректно" if is_available else "Проблемы с DeepSeek API",
            timestamp=datetime.now()
        )
    except Exception as e:
        logger.error(f"Ошибка health check: {str(e)}")
        return HealthResponse(
            status="error",
            gemini_api_available=False,
            message=f"Ошибка инициализации: {str(e)}",
            timestamp=datetime.now()
        )


@router.post("/process", response_model=ProcessResponse)
async def process_text(request: ProcessRequest):
    """
    Обработка текста в выбранном режиме
    
    Поддерживаемые режимы:
    - summarize: краткий конспект
    - extract_terms: извлечение терминов
    - expand_topic: расширение темы
    - generate_questions: вопросы для самопроверки
    - detailed_notes: расширенный конспект с подробным разбором терминов (использует Multi-Step)
    - cheat_sheet: сжатая шпаргалка по лекции
    """
    start_time = datetime.now()
    
    try:
        # Валидация режима
        valid_modes = ['summarize', 'extract_terms', 'expand_topic', 'generate_questions', 'detailed_notes', 'cheat_sheet']
        if request.mode not in valid_modes:
            raise HTTPException(
                status_code=400, 
                detail=f"Неверный режим. Доступны: {', '.join(valid_modes)}"
            )
        
        # Дополнительная валидация для expand_topic
        if request.mode == "expand_topic" and not request.topic:
            raise HTTPException(
                status_code=400,
                detail="Для режима expand_topic требуется указать параметр 'topic'"
            )
        
        # Получаем процессор и обрабатываем текст (async!)
        proc = get_processor()
        
        if request.mode == "expand_topic":
            result = await proc.expand_topic(
                topic=request.topic,
                context=request.context or request.text
            )
        else:
            result = await proc.process_text(request.text, request.mode)
        
        # Вычисляем время обработки
        processing_time = (datetime.now() - start_time).total_seconds()
        
        logger.info(f"Успешно обработан текст в режиме {request.mode}. Время: {processing_time:.2f}с")
        
        return ProcessResponse(
            success=True,
            mode=request.mode,
            processed_text=result,
            processing_time=processing_time,
            timestamp=datetime.now()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        processing_time = (datetime.now() - start_time).total_seconds()
        logger.error(f"Ошибка обработки текста: {str(e)}")
        
        return ProcessResponse(
            success=False,
            mode=request.mode,
            processed_text="",
            processing_time=processing_time,
            timestamp=datetime.now(),
            error=str(e)
        )


@router.post("/batch-process", response_model=BatchProcessResponse)
async def batch_process_text(request: BatchProcessRequest):
    """
    Пакетная обработка текста в нескольких режимах
    Полезно для создания полного набора материалов за один запрос
    """
    start_time = datetime.now()
    
    try:
        # Валидация режимов
        valid_modes = ['summarize', 'extract_terms', 'expand_topic', 'generate_questions', 'detailed_notes', 'cheat_sheet']
        invalid_modes = [mode for mode in request.modes if mode not in valid_modes]
        
        if invalid_modes:
            raise HTTPException(
                status_code=400,
                detail=f"Неверные режимы: {', '.join(invalid_modes)}. Доступны: {', '.join(valid_modes)}"
            )
        
        # Получаем процессор и обрабатываем (ASYNC!)
        proc = get_processor()
        results = await proc.batch_process(request.text, request.modes)
        
        # Вычисляем общее время обработки
        total_time = (datetime.now() - start_time).total_seconds()
        
        # Проверяем на ошибки в результатах
        errors = {}
        clean_results = {}
        
        for mode, result in results.items():
            if result.startswith("Ошибка обработки:"):
                errors[mode] = result
            else:
                clean_results[mode] = result
        
        logger.info(f"Пакетная обработка завершена. Режимы: {request.modes}. Время: {total_time:.2f}с")
        
        return BatchProcessResponse(
            success=len(clean_results) > 0,
            results=clean_results,
            total_processing_time=total_time,
            timestamp=datetime.now(),
            errors=errors if errors else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        total_time = (datetime.now() - start_time).total_seconds()
        logger.error(f"Ошибка пакетной обработки: {str(e)}")
        
        return BatchProcessResponse(
            success=False,
            results={},
            total_processing_time=total_time,
            timestamp=datetime.now(),
            errors={"general": str(e)}
        )


@router.post("/explain", response_model=ExplainResponse)
async def explain_fragment(request: ExplainRequest):
    start_time = datetime.now()
    try:
        client = get_polza_client()
        title = request.lecture_title or "Без названия"
        question = request.question or "Объясни смысл этого фрагмента"

        user_prompt = (
            f"Лекция: {title}\n"
            f"Запрос пользователя: {question}\n\n"
            "Фрагмент:\n"
            f"\"\"\"{request.text}\"\"\"\n\n"
            "Объясни коротко и по делу, без лишней воды."
        )

        response = client.chat.completions.create(
            model=POLZA_MODEL,
            messages=[
                {"role": "system", "content": EXPLAIN_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=800,
            top_p=0.9,
        )

        explanation = response.choices[0].message.content or ""
        processing_time = (datetime.now() - start_time).total_seconds()

        return ExplainResponse(
            success=True,
            explanation=explanation,
            model=POLZA_MODEL,
            processing_time=processing_time,
            timestamp=datetime.now(),
        )
    except HTTPException:
        raise
    except Exception as e:
        processing_time = (datetime.now() - start_time).total_seconds()
        logger.error(f"Ошибка explain: {str(e)}")
        return ExplainResponse(
            success=False,
            explanation="",
            model=POLZA_MODEL,
            processing_time=processing_time,
            timestamp=datetime.now(),
            error=str(e),
        )


@router.post("/diagram", response_model=DiagramResponse)
async def diagram_from_text(request: DiagramRequest):
    start_time = datetime.now()
    try:
        client = get_diagram_client()
        user_prompt = (
            f"Текст: {request.text}\n"
            f"Пожелание по layout: {request.layout}\n"
            f"max_nodes: {request.max_nodes}"
        )
        response = client.chat.completions.create(
            model=DIAGRAM_MODEL,
            messages=[
                {"role": "system", "content": DIAGRAM_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=1200,
            top_p=0.9,
        )
        raw = response.choices[0].message.content or ""
        diagram = _extract_json_payload(raw)

        processing_time = (datetime.now() - start_time).total_seconds()
        return DiagramResponse(
            success=True,
            diagram=diagram,
            model=DIAGRAM_MODEL,
            processing_time=processing_time,
            timestamp=datetime.now(),
        )
    except Exception as e:
        processing_time = (datetime.now() - start_time).total_seconds()
        return DiagramResponse(
            success=False,
            diagram=None,
            model=DIAGRAM_MODEL,
            processing_time=processing_time,
            timestamp=datetime.now(),
            error=str(e),
        )


@router.get("/modes")
async def get_available_modes():
    """Получение списка доступных режимов обработки"""
    return {
        "modes": {
            "summarize": {
                "name": "Краткий конспект",
                "description": "Создание структурированного конспекта лекции",
                "requires_topic": False
            },
            "extract_terms": {
                "name": "Извлечение терминов",
                "description": "Поиск ключевых терминов и их определений",
                "requires_topic": False
            },
            "expand_topic": {
                "name": "Расширение темы",
                "description": "Подробное объяснение сложной темы",
                "requires_topic": True
            },
            "generate_questions": {
                "name": "Вопросы для самопроверки",
                "description": "Генерация вопросов для закрепления материала",
                "requires_topic": False
            },
            "detailed_notes": {
                "name": "Расширенный конспект",
                "description": "Подробный разбор всех терминов и методов",
                "requires_topic": False
            },
            "cheat_sheet": {
                "name": "Шпаргалка",
                "description": "Сжатая выжимка с формулами и ключевыми тезисами",
                "requires_topic": False
            }
        }
    }


@router.post("/quick-summary")
async def quick_summary(request: QuickSummaryRequest):
    """Быстрое создание конспекта (упрощенный эндпоинт)"""
    try:
        proc = get_processor()
        result = await proc.summarize(request.text)  # ASYNC!
        
        return JSONResponse({
            "success": True,
            "summary": result,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Ошибка быстрого конспектирования: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def add_logging_middleware(app: FastAPI) -> None:
    """Attach simple logging middleware to a FastAPI app."""
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start_time = datetime.now()
        logger.info(f"ML API запрос: {request.method} {request.url}")
        response = await call_next(request)
        process_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"ML API ответ: {response.status_code}, время: {process_time:.2f}с")
        return response


if __name__ == "__main__":
    # Тестирование API локально
    import uvicorn
    app = FastAPI(title="Student AI Assistant ML API")
    add_logging_middleware(app)
    app.include_router(router)
    uvicorn.run(app, host="0.0.0.0", port=8001)