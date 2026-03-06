from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db import Base


class CodeSession(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        Index("ix_sessions_user_created", "user_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    language = Column(String)
    question_text = Column(Text)
    code = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    reviews = relationship("Review", back_populates="session")
