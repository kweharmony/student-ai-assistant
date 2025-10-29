"""
Эндпоинт для транскрибации аудио через ЛОКАЛЬНЫЙ Whisper
Не требует API ключей, работает полностью офлайн
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional
import whisper
import os
import tempfile
import logging
import time

# Настройка логирования
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transcribe", tags=["Audio Transcription"])

# ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
# Модель будет загружена один раз при старте сервера
_whisper_model = None
_model_name = os.getenv('WHISPER_MODEL', 'base')  # По умолчанию 'base'


def get_whisper_model():
    """
    Получает или загружает модель Whisper
    Модель загружается только один раз и переиспользуется
    """
    global _whisper_model
    
    if _whisper_model is None:
        logger.info(f"🔄 Загружаем модель Whisper '{_model_name}'...")
        try:
            _whisper_model = whisper.load_model(_model_name)
            logger.info(f"✅ Модель '{_model_name}' загружена успешно!")
        except Exception as e:
            logger.error(f"❌ Ошибка загрузки модели: {e}")
            raise Exception(f"Не удалось загрузить модель Whisper: {e}")
    
    return _whisper_model


class TranscriptionResponse(BaseModel):
    """Модель ответа транскрибации"""
    success: bool
    text: str
    filename: str
    duration: Optional[float] = None
    language: Optional[str] = None
    processing_time: Optional[float] = None  # Время обработки


@router.post("/audio", response_model=TranscriptionResponse)
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Транскрибирует аудиофайл используя локальный Whisper
    
    Поддерживаемые форматы: mp3, wav, m4a, flac, ogg, opus, mp4, mov, avi, mkv, webm
    Максимальный размер: ограничен только вашим железом
    """
    
    start_time = time.time()
    
    # Проверка формата
    allowed_formats = ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'opus', 'mp4', 'mov', 'avi', 'mkv', 'webm']
    file_extension = audio.filename.split('.')[-1].lower()
    
    if file_extension not in allowed_formats:
        raise HTTPException(
            status_code=400,
            detail=f"❌ Формат {file_extension} не поддерживается. Разрешены: {', '.join(allowed_formats)}"
        )
    
    logger.info(f"📝 Получен файл: {audio.filename} ({file_extension})")
    
    try:
        # Сохраняем временный файл
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_extension}') as temp_file:
            content = await audio.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        file_size_mb = os.path.getsize(temp_file_path) / (1024 * 1024)
        logger.info(f"📦 Размер файла: {file_size_mb:.2f} MB")
        
        # Получаем модель
        model = get_whisper_model()
        
        logger.info(f"🎙️ Начинаем транскрибацию...")
        
        # ===== ТРАНСКРИБАЦИЯ =====
        # Параметры для длинных аудио:
        # - fp16=False: отключаем 16-битную точность (стабильнее на CPU)
        # - verbose=True: показываем прогресс
        # - language='ru': указываем русский (ускоряет обработку)
        # - task='transcribe': транскрибация (не перевод)
        
        result = model.transcribe(
            temp_file_path,
            language='ru',  # Укажите 'en' для английского или None для автоопределения
            task='transcribe',
            fp16=False,  # Для CPU обязательно False
            verbose=True  # Показывать прогресс
        )
        
        # Удаляем временный файл
        os.unlink(temp_file_path)
        
        # Извлекаем результаты
        transcribed_text = result['text']
        detected_language = result.get('language', 'unknown')
        
        processing_time = time.time() - start_time
        
        logger.info(f"✅ Транскрибация завершена!")
        logger.info(f"   Длина текста: {len(transcribed_text)} символов")
        logger.info(f"   Язык: {detected_language}")
        logger.info(f"   Время обработки: {processing_time:.2f} сек")
        
        return TranscriptionResponse(
            success=True,
            text=transcribed_text,
            filename=audio.filename,
            duration=None,  # Whisper не возвращает длительность напрямую
            language=detected_language,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"❌ Ошибка транскрибации: {str(e)}")
        
        # Удаляем временный файл в случае ошибки
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass
        
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка транскрибации: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Проверка работоспособности локального Whisper"""
    
    try:
        model = get_whisper_model()
        return {
            "status": "healthy",
            "message": f"✅ Модель Whisper '{_model_name}' загружена и готова",
            "model": _model_name,
            "local": True
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "message": f"❌ Ошибка: {str(e)}",
            "model": _model_name,
            "local": True
        }


@router.get("/model-info")
async def model_info():
    """Информация о загруженной модели"""
    
    model_sizes = {
        "tiny": "~75 MB",
        "base": "~150 MB",
        "small": "~500 MB",
        "medium": "~1.5 GB",
        "large": "~3 GB"
    }
    
    return {
        "model": _model_name,
        "size": model_sizes.get(_model_name, "unknown"),
        "loaded": _whisper_model is not None,
        "cache_location": os.path.expanduser("~/.cache/whisper/"),
        "supported_formats": ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'opus', 'mp4', 'mov', 'avi', 'mkv', 'webm']
    }