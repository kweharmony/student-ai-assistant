from fastapi import FastAPI
from .ml_endpoints import router, add_logging_middleware

app = FastAPI(title="Student AI Assistant ML API")
add_logging_middleware(app)
app.include_router(router)

# This allows running with: uvicorn api.app:app --reload
