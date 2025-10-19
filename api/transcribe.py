"""
Эндпоинт для транскрибации аудио через Nexara API
Этот файл отвечает за превращение аудио в текст
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional
import requests
import os
import tempfile
import logging
from dotenv import load_dotenv

# Загружаем переменные окружения (API ключи и т.д.)
load_dotenv()

# Настройка логирования (чтобы видеть, что происходит)
logger = logging.getLogger(__name__)

# Создаём роутер - это как раздел API для транскрибации
router = APIRouter(prefix="/api/transcribe", tags=["Audio Transcription"])

# URL API Nexara
NEXARA_API_URL = "https://api.nexara.ru/api/v1/audio/transcriptions"


class TranscriptionResponse(BaseModel):
    """
    Модель ответа - описывает, что мы вернём пользователю
    """
    success: bool  # Успешно ли прошла транскрибация
    text: str  # Транскрибированный текст
    filename: str  # Название файла
    duration: Optional[float] = None  # Длительность аудио (если есть)
    language: Optional[str] = None  # Язык (если определён)


@router.post("/audio", response_model=TranscriptionResponse)
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Основная функция транскрибации
    
    Что она делает:
    1. Принимает аудиофайл от пользователя
    2. Проверяет формат файла
    3. Отправляет в Nexara API
    4. Возвращает текст транскрипции
    """
    
    # ============ ШАГ 1: ПРОВЕРКА ФОРМАТА ============
    # Список разрешённых форматов (из документации Nexara)
    allowed_formats = ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'opus', 'mp4', 'mov', 'avi', 'mkv']
    
    # Получаем расширение файла (всё после последней точки)
    file_extension = audio.filename.split('.')[-1].lower()
    
    # Если формат не поддерживается - возвращаем ошибку
    if file_extension not in allowed_formats:
        raise HTTPException(
            status_code=400,
            detail=f"❌ Формат {file_extension} не поддерживается. Разрешены: {', '.join(allowed_formats)}"
        )
    
    # Получаем API ключ из переменных окружения
    api_key = os.getenv('NEXARA_API_KEY')
    
    # Если ключа нет - возвращаем ошибку
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="❌ NEXARA_API_KEY не найден в .env файле!"
        )
    
    try:
        # ============ ШАГ 2: СОХРАНЕНИЕ ФАЙЛА ВРЕМЕННО ============
        # API Nexara требует файл на диске, поэтому сохраняем временно
        
        # Создаём временный файл
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_extension}') as temp_file:
            # Читаем содержимое загруженного файла
            content = await audio.read()
            # Записываем в временный файл
            temp_file.write(content)
            # Запоминаем путь к временному файлу
            temp_file_path = temp_file.name
        
        logger.info(f"📝 Начинаем транскрибацию: {audio.filename}")
        
        # ============ ШАГ 3: ОТПРАВКА В NEXARA API ============
        
        # Заголовки запроса (авторизация)
        headers = {
            "Authorization": f"Bearer {api_key}"
        }
        
        # Открываем временный файл для отправки
        with open(temp_file_path, 'rb') as audio_file:
            # Формируем данные для отправки
            files = {
                'file': (audio.filename, audio_file, f'audio/{file_extension}')
            }
            
            # Параметры запроса
            data = {
                'response_format': 'json',  # Хотим получить JSON ответ
                # 'task': 'transcribe'  # По умолчанию, можно не указывать
            }
            
            # Отправляем POST запрос в Nexara
            response = requests.post(
                NEXARA_API_URL,
                headers=headers,
                files=files,
                data=data,
                timeout=300  # Максимум 5 минут на транскрибацию
            )
        
        # Удаляем временный файл (он больше не нужен)
        os.unlink(temp_file_path)
        
        # ============ ШАГ 4: ОБРАБОТКА ОТВЕТА ============
        
        # Проверяем, успешен ли запрос
        if response.status_code != 200:
            logger.error(f"❌ Ошибка Nexara API: {response.text}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Ошибка транскрибации: {response.text}"
            )
        
        # Парсим JSON ответ
        result = response.json()
        
        # Извлекаем текст из ответа
        transcribed_text = result.get('text', '')
        
        logger.info(f"✅ Транскрибация завершена! Длина текста: {len(transcribed_text)} символов")
        
        # ============ ШАГ 5: ВОЗВРАТ РЕЗУЛЬТАТА ============
        return TranscriptionResponse(
            success=True,
            text=transcribed_text,
            filename=audio.filename,
            duration=result.get('duration'),
            language=result.get('language')
        )
        
    except HTTPException:
        # Если это HTTPException - пробрасываем дальше
        raise
        
    except Exception as e:
        # Любая другая ошибка
        logger.error(f"❌ Неожиданная ошибка: {str(e)}")
        
        # Пытаемся удалить временный файл, если он остался
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass
        
        raise HTTPException(
            status_code=500,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """
    Проверка работоспособности API транскрибации
    Просто проверяет, есть ли API ключ
    """
    api_key = os.getenv('NEXARA_API_KEY')
    
    if api_key:
        return {
            "status": "healthy",
            "message": "✅ Nexara API ключ найден",
            "api_configured": True
        }
    else:
        return {
            "status": "unhealthy",
            "message": "❌ NEXARA_API_KEY не настроен",
            "api_configured": False
        }