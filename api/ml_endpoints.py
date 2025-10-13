"""
FastAPI эндпоинты для ML обработки текста
Интеграция DeepSeek с веб-приложением
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import logging
import asyncio
from datetime import datetime

# Импортируем наш процессор
try:
    from ..ml.deepseek_processor import DeepSeekProcessor
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from ml.deepseek_processor import DeepSeekProcessor

# Настройка логирования
logger = logging.getLogger(__name__)

# Создаем роутер
router = APIRouter(prefix="/api/ml", tags=["ML Text Processing"])

# Глобальный экземпляр процессора
processor = None

def get_processor():
    """Получение глобального экземпляра процессора"""
    global processor
    if processor is None:
        processor = DeepSeekProcessor()
    return processor


# Модели данных для API
class ProcessRequest(BaseModel):
    """Запрос на обработку текста"""
    text: str = Field(..., min_length=10, max_length=50000, description="Текст лекции для обработки")
    mode: str = Field(..., description="Режим обработки: summarize, extract_terms, expand_topic, generate_questions, mindmap")
    topic: Optional[str] = Field(None, description="Тема для расширения (только для режима expand_topic)")
    context: Optional[str] = Field(None, description="Дополнительный контекст (для режима expand_topic)")

class BatchProcessRequest(BaseModel):
    """Запрос на пакетную обработку текста"""
    text: str = Field(..., min_length=10, max_length=50000, description="Текст лекции")
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
    deepseek_api_available: bool
    message: str
    timestamp: datetime


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Проверка работоспособности ML API"""
    try:
        proc = get_processor()
        is_available = proc.health_check()
        
        return HealthResponse(
            status="healthy" if is_available else "unhealthy",
            deepseek_api_available=is_available,
            message="DeepSeek API работает корректно" if is_available else "Проблемы с DeepSeek API",
            timestamp=datetime.now()
        )
    except Exception as e:
        logger.error(f"Ошибка health check: {str(e)}")
        return HealthResponse(
            status="error",
            deepseek_api_available=False,
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
    - mindmap: карта памяти
    """
    start_time = datetime.now()
    
    try:
        # Валидация режима
        valid_modes = ['summarize', 'extract_terms', 'expand_topic', 'generate_questions', 'mindmap']
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
        
        # Получаем процессор и обрабатываем текст
        proc = get_processor()
        
        if request.mode == "expand_topic":
            result = proc.expand_topic(
                topic=request.topic,
                context=request.context or request.text
            )
        else:
            result = proc.process_text(request.text, request.mode)
        
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
        valid_modes = ['summarize', 'extract_terms', 'expand_topic', 'generate_questions', 'mindmap']
        invalid_modes = [mode for mode in request.modes if mode not in valid_modes]
        
        if invalid_modes:
            raise HTTPException(
                status_code=400,
                detail=f"Неверные режимы: {', '.join(invalid_modes)}. Доступны: {', '.join(valid_modes)}"
            )
        
        # Получаем процессор и обрабатываем
        proc = get_processor()
        results = proc.batch_process(request.text, request.modes)
        
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
            "mindmap": {
                "name": "Карта памяти",
                "description": "Создание структурной схемы лекции",
                "requires_topic": False
            }
        }
    }


@router.post("/quick-summary")
async def quick_summary(text: str = Field(..., min_length=10)):
    """Быстрое создание конспекта (упрощенный эндпоинт)"""
    try:
        proc = get_processor()
        result = proc.summarize(text)
        
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