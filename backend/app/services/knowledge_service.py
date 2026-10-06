import re
import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.knowledge import KnowledgeChunk
from app.services.embedding_service import embed_query, embed_texts


def chunk_text(text: str, chunk_size: int | None = None, overlap: int | None = None) -> list[str]:
    size = chunk_size or settings.RAG_CHUNK_SIZE
    overlap_size = overlap if overlap is not None else settings.RAG_CHUNK_OVERLAP
    cleaned = re.sub(r"\r\n?", "\n", text).strip()

    if not cleaned:
        return []

    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", cleaned) if part.strip()]
    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs:
        if len(paragraph) <= size and len(current) + len(paragraph) + 2 <= size:
            current = f"{current}\n\n{paragraph}".strip()
            continue

        if current:
            chunks.append(current)
            current = ""

        if len(paragraph) <= size:
            current = paragraph
            continue

        start = 0
        while start < len(paragraph):
            end = min(start + size, len(paragraph))
            piece = paragraph[start:end].strip()
            if piece:
                chunks.append(piece)
            if end >= len(paragraph):
                break
            start = max(0, end - overlap_size)

    if current:
        chunks.append(current)

    return chunks


def create_document(db: Session, user_id: int, title: str, content: str) -> dict:
    chunks = chunk_text(content)
    if not chunks:
        raise ValueError("Document contains no usable text.")

    document_id = str(uuid.uuid4())
    embeddings = embed_texts(chunks)

    rows = [
        KnowledgeChunk(
            document_id=document_id,
            user_id=user_id,
            title=title.strip(),
            chunk_index=index,
            content=chunk,
            embedding=embedding,
        )
        for index, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]
    db.add_all(rows)
    db.commit()

    return {
        "document_id": document_id,
        "title": title.strip(),
        "chunks": len(rows),
    }


def list_documents(db: Session, user_id: int) -> list[dict]:
    rows = db.execute(
        select(
            KnowledgeChunk.document_id,
            KnowledgeChunk.title,
            KnowledgeChunk.created_at,
        )
        .where(KnowledgeChunk.user_id == user_id)
        .distinct(KnowledgeChunk.document_id)
        .order_by(KnowledgeChunk.created_at.desc())
    ).all()

    counts = db.execute(
        select(KnowledgeChunk.document_id, KnowledgeChunk.id)
        .where(KnowledgeChunk.user_id == user_id)
    ).all()

    count_map: dict[str, int] = {}
    for document_id, _ in counts:
        count_map[document_id] = count_map.get(document_id, 0) + 1

    return [
        {
            "document_id": document_id,
            "title": title,
            "created_at": created_at,
            "chunks": count_map.get(document_id, 0),
        }
        for document_id, title, created_at in rows
    ]


def delete_document(db: Session, user_id: int, document_id: str) -> bool:
    result = db.execute(
        delete(KnowledgeChunk).where(
            KnowledgeChunk.user_id == user_id,
            KnowledgeChunk.document_id == document_id,
        )
    )
    db.commit()
    return result.rowcount > 0


def retrieve_context(db: Session, user_id: int, query: str) -> tuple[str, list[dict]]:
    if not settings.RAG_ENABLED or not settings.OPENAI_API_KEY or not query.strip():
        return "", []

    query_embedding = embed_query(query[: settings.RAG_MAX_QUERY_CHARS])

    stmt = (
        select(KnowledgeChunk)
        .where(KnowledgeChunk.user_id == user_id)
        .order_by(KnowledgeChunk.embedding.cosine_distance(query_embedding))
        .limit(settings.RAG_TOP_K)
    )
    rows = db.scalars(stmt).all()

    if not rows:
        return "", []

    context_blocks = []
    sources = []
    for row in rows:
        context_blocks.append(
            f"[Source: {row.title} | Chunk {row.chunk_index + 1}]\n{row.content}"
        )
        sources.append(
            {
                "title": row.title,
                "chunk": row.chunk_index + 1,
            }
        )

    return "\n\n".join(context_blocks), sources
