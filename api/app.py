from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .ml_endpoints import router, add_logging_middleware
from .transcribe import router as transcribe_router

app = FastAPI(title="Student AI Assistant ML API")

# Настройка CORS для работы с React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

add_logging_middleware(app)
app.include_router(router)
app.include_router(transcribe_router)

# This allows running with: uvicorn api.app:app --reload
