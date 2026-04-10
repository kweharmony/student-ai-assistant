"""
Роутер экспорта: проксирует запрос на генерацию PDF в отдельный pdf-service.
"""

import io
import os

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/export", tags=["export"])

PDF_SERVICE_URL = os.getenv("PDF_SERVICE_URL", "http://pdf-service:3001")


class PdfExportRequest(BaseModel):
    markdown: str


@router.post("/pdf")
async def export_pdf(request: PdfExportRequest):
    """
    Принимает Markdown-текст (с LaTeX $$...$$),
    отправляет в pdf-service для рендеринга через Playwright + KaTeX,
    возвращает PDF-файл клиенту.
    """
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{PDF_SERVICE_URL}/render-pdf",
                json={"markdown": request.markdown},
            )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="PDF-сервис недоступен. Проверьте, запущен ли pdf-service.",
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="PDF-сервис не ответил вовремя.")

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"PDF-сервис вернул ошибку: {resp.text}",
        )

    return StreamingResponse(
        io.BytesIO(resp.content),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=document.pdf"},
    )
