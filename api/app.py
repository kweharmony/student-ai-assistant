from fastapi import FastAPI
from .ml_endpoints import router, add_logging_middleware
from .transcribe import router as transcribe_router

app = FastAPI(title="Student AI Assistant ML API")
add_logging_middleware(app)
app.include_router(router)
app.include_router(transcribe_router)

# This allows running with: uvicorn api.app:app --reload
