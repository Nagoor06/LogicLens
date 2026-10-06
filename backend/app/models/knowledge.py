from sqlalchemy import Column, DateTime, Integer, String, Text, Index
from sqlalchemy.sql import func
from pgvector.sqlalchemy import VECTOR

from app.db import Base
from app.core.config import settings


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"
    __table_args__ = (
        Index("ix_knowledge_chunks_user_document", "user_id", "document_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(String(36), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(VECTOR(settings.EMBEDDING_DIMENSIONS), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
