import io
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pypdf import PdfReader
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.db import SessionLocal
from app.models.user import User
from app.services.knowledge_service import create_document, delete_document, list_documents

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def extract_text(filename: str, content: bytes) -> str:
    extension = Path(filename).suffix.lower()

    if extension == ".pdf":
        reader = PdfReader(io.BytesIO(content))
        return "

".join(page.extract_text() or "" for page in reader.pages)

    if extension in {".txt", ".md"}:
        return content.decode("utf-8", errors="replace")

    raise HTTPException(status_code=400, detail="Supported files: PDF, Markdown, or TXT.")


@router.get("/")
def get_knowledge(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"documents": list_documents(db, current_user.id)}


@router.post("/upload")
async def upload_knowledge(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not settings.RAG_ENABLED:
        raise HTTPException(status_code=503, detail="RAG is not enabled on this deployment.")

    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="RAG embeddings are not configured.")

    content = await file.read()
    if len(content) > settings.RAG_MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=413, detail="Document exceeds the 5 MB limit.")

    filename = file.filename or "knowledge.txt"
    text = extract_text(filename, content)

    try:
        document = create_document(
            db,
            current_user.id,
            Path(filename).stem,
            text,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to index the document.") from exc

    return document


@router.delete("/{document_id}")
def remove_knowledge(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not delete_document(db, current_user.id, document_id):
        raise HTTPException(status_code=404, detail="Document not found.")

    return {"deleted": True, "document_id": document_id}
