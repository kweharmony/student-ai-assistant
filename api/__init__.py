"""
API модуль для веб-интерфейса Student AI Assistant
Содержит FastAPI эндпоинты для ML обработки
"""

from .ml_endpoints import router

__version__ = "1.0.0"
__all__ = ["router"]