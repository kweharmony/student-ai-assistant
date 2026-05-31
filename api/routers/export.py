"""
Роутер экспорта: проксирует запросы на генерацию PDF и DOCX в pdf-service.
"""

import io
import os
from urllib.parse import quote

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/export", tags=["export"])

PDF_SERVICE_URL = os.getenv("PDF_SERVICE_URL", "http://pdf-service:3001")


class ExportRequest(BaseModel):
    markdown: str
    filename: str | None = None


# Обратная совместимость: оставляем старый класс как алиас
PdfExportRequest = ExportRequest


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
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Ошибка соединения с pdf-service: {e}")

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


@router.post("/docx")
async def export_docx(request: ExportRequest):
    """
    Принимает Markdown-текст (с LaTeX $$...$$),
    отправляет в pdf-service для конвертации через Pandoc,
    возвращает DOCX с нативными Word-формулами (OMML).
    """
    filename = request.filename or "document.docx"
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{PDF_SERVICE_URL}/render-docx",
                json={"markdown": request.markdown, "filename": filename},
            )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="PDF-сервис недоступен. Проверьте, запущен ли pdf-service.",
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="PDF-сервис не ответил вовремя.")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Ошибка соединения с pdf-service: {e}")

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"PDF-сервис вернул ошибку при генерации DOCX: {resp.text}",
        )

    ascii_name = filename.encode("ascii", errors="replace").decode("ascii")
    encoded_name = quote(filename, safe="")
    return StreamingResponse(
        io.BytesIO(resp.content),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded_name}"},
    )
