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
import sys
from pathlib import Path

# Импорт профанити-фильтра для безопасной обработки текста
try:
    from ..ml.profanity_filter import filter_profanity
except ImportError:
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from ml.profanity_filter import filter_profanity

# ===== НАСТРОЙКА FFMPEG PATH =====
# Ищем FFmpeg в стандартных местах установки для Windows
def setup_ffmpeg_path():
    """Добавляет FFmpeg в PATH если он не найден"""
    import shutil
    
    # Проверяем, доступен ли ffmpeg
    if shutil.which('ffmpeg') is not None:
        logger.info("✅ FFmpeg уже доступен в PATH")
        return
    
    # Возможные пути установки FFmpeg на Windows
    possible_paths = [
        Path(os.environ.get('LOCALAPPDATA', '')) / 'Microsoft' / 'WinGet' / 'Packages',
        Path('C:/ProgramData/chocolatey/bin'),
        Path('C:/ffmpeg/bin'),
        Path(os.environ.get('PROGRAMFILES', '')) / 'ffmpeg' / 'bin',
    ]
    
    for base_path in possible_paths:
        if not base_path.exists():
            continue
            
        # Ищем ffmpeg.exe рекурсивно
        for ffmpeg_path in base_path.rglob('ffmpeg.exe'):
            bin_dir = str(ffmpeg_path.parent)
            logger.info(f"🔍 Найден FFmpeg: {bin_dir}")
            
            # Добавляем в PATH текущего процесса
            if bin_dir not in os.environ['PATH']:
                os.environ['PATH'] = bin_dir + os.pathsep + os.environ['PATH']
                logger.info(f"✅ FFmpeg добавлен в PATH: {bin_dir}")
            return
    
    logger.warning("⚠️ FFmpeg не найден автоматически. Установите FFmpeg: winget install ffmpeg")

# Настройка логирования
logger = logging.getLogger(__name__)

# Настраиваем FFmpeg при импорте модуля
setup_ffmpeg_path()

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
    
    temp_file_path = None
    
    try:
        # Читаем содержимое файла
        content = await audio.read()
        logger.info(f"📦 Прочитано байт: {len(content)}")
        
        if len(content) == 0:
            raise HTTPException(
                status_code=400,
                detail="❌ Файл пустой или не был загружен"
            )
        
        # Сохраняем временный файл
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_extension}', mode='wb') as temp_file:
            temp_file.write(content)
            temp_file.flush()  # Принудительно записываем на диск
            os.fsync(temp_file.fileno())  # Синхронизируем с диском
            temp_file_path = temp_file.name
        
        file_size_mb = os.path.getsize(temp_file_path) / (1024 * 1024)
        logger.info(f"📦 Размер файла: {file_size_mb:.2f} MB")
        logger.info(f"💾 Временный файл: {temp_file_path}")
        
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
        
        # Извлекаем результаты
        transcribed_text = result['text']
        detected_language = result.get('language', 'unknown')
        
        # ===== ПРОФАНИТИ-ФИЛЬТР (ОБЯЗАТЕЛЬНАЯ ОЧИСТКА) =====
        # Применяется ВСЕГДА для предотвращения блокировки Gemini API
        logger.info("🔒 Применяем профанити-фильтр к транскрипции...")
        transcribed_text = filter_profanity(transcribed_text)
        logger.info("✅ Профанити-фильтр применён")
        
        # Удаляем временный файл после успешной обработки
        try:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                logger.info(f"🗑️ Временный файл удален: {temp_file_path}")
        except Exception as cleanup_error:
            # Это не критично - файл мог быть уже удален системой
            logger.debug(f"Временный файл уже удален: {cleanup_error}")
        
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
        
    except HTTPException:
        # Пробрасываем HTTPException без изменений
        raise
        
    except Exception as e:
        logger.error(f"❌ Ошибка транскрибации: {str(e)}")
        logger.error(f"   Тип ошибки: {type(e).__name__}")
        
        # Удаляем временный файл в случае ошибки
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.info(f"🗑️ Временный файл удален после ошибки")
            except Exception as cleanup_error:
                # Файл может быть уже удален - это не критично
                logger.debug(f"Временный файл уже удален: {cleanup_error}")
        
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


# ===== AI-ФИЛЬТРАЦИЯ ТРАНСКРИБИРОВАННОГО ТЕКСТА =====

class FilterRequest(BaseModel):
    """Запрос на фильтрацию транскрибированного текста"""
    text: str


class FilterResponse(BaseModel):
    """Ответ фильтрации"""
    success: bool
    filtered_text: str
    original_length: int
    filtered_length: int
    processing_time: float


@router.post("/filter", response_model=FilterResponse)
async def filter_transcription(request: FilterRequest):
    """
    Фильтрует и очищает транскрибированный текст от ошибок распознавания
    
    Использует Gemini API для:
    - Исправления орфографических ошибок
    - Удаления фраз-паразитов
    - Улучшения пунктуации
    - Форматирования текста
    
    ВАЖНО: Это отдельный AI-процесс от создания конспектов!
    """
    start_time = time.time()
    
    try:
        # Импортируем фильтр (ленивая загрузка)
        try:
            from ..ml.transcription_filter import TranscriptionFilter
        except ImportError:
            import sys
            sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            from ml.transcription_filter import TranscriptionFilter
        
        logger.info(f"🔄 Начинаем AI-фильтрацию текста ({len(request.text)} символов)")
        logger.info(f"📝 Первые 200 символов входного текста: {request.text[:200]}")
        
        # ===== ПРОФАНИТИ-ФИЛЬТР (ОБЯЗАТЕЛЬНАЯ ПРЕДОБРАБОТКА) =====
        # Применяется ВСЕГДА перед отправкой в Gemini API
        logger.info("🔒 Применяем профанити-фильтр перед AI-обработкой...")
        safe_text = filter_profanity(request.text)
        logger.info("✅ Профанити-фильтр применён")
        
        # Создаём фильтр и обрабатываем БЕЗОПАСНЫЙ текст
        filter_instance = TranscriptionFilter()
        # ИСПОЛЬЗУЕМ АСИНХРОННУЮ ФИЛЬТРАЦИЮ ДЛЯ УСКОРЕНИЯ
        filtered_text = await filter_instance.filter_text_async(safe_text)

        processing_time = time.time() - start_time

        logger.info(f"✅ Фильтрация завершена за {processing_time:.2f}с")
        logger.info(f"📊 Размер: {len(request.text)} → {len(filtered_text)}")
        logger.info(f"📝 Первые 200 символов ОТФИЛЬТРОВАННОГО текста: {filtered_text[:200]}")
        
        # Проверяем, изменился ли текст
        if request.text.strip() == filtered_text.strip():
            logger.warning("⚠️ ВНИМАНИЕ: Текст не изменился после фильтрации!")
        else:
            logger.info(f"✅ Текст успешно отфильтрован (есть изменения)")
        
        return FilterResponse(
            success=True,
            filtered_text=filtered_text,
            original_length=len(request.text),
            filtered_length=len(filtered_text),
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"❌ Ошибка фильтрации: {str(e)}")
        
        # В случае ошибки возвращаем оригинальный текст
        processing_time = time.time() - start_time
        
        return FilterResponse(
            success=False,
            filtered_text=request.text,  # Возвращаем оригинал
            original_length=len(request.text),
            filtered_length=len(request.text),
            processing_time=processing_time
        )


@router.get("/filter/health")
async def filter_health_check():
    """Проверка работоспособности AI-фильтра"""
    
    try:
        from ..ml.transcription_filter import TranscriptionFilter
        
        filter_instance = TranscriptionFilter()
        is_healthy = filter_instance.health_check()
        
        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "message": "✅ AI-фильтр готов к работе" if is_healthy else "❌ Проблемы с AI-фильтром",
            "uses_gemini": True
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"❌ Ошибка: {str(e)}",
            "uses_gemini": True
        }