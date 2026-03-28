"""
FastAPI-приложение MindeSync.
Подключает все роутеры: ML, транскрибация, auth, users, lectures, admin.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from .ml_endpoints import router as ml_router, add_logging_middleware
from .transcribe import router as transcribe_router
from .routers.auth import router as auth_router
from .routers.users import router as users_router
from .routers.lectures import router as lectures_router
from .routers.admin import router as admin_router

app = FastAPI(title="MindeSync — Student AI Assistant API")

# CORS: origins from env or defaults
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

add_logging_middleware(app)

# Existing routers (without auth, backward-compatible)
app.include_router(ml_router)
app.include_router(transcribe_router)

# New routers (with auth)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(lectures_router)
app.include_router(admin_router)

# This allows running with: uvicorn api.app:app --reload
