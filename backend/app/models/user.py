from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    address = Column(String)
    hashed_password = Column(String)
    is_verified = Column(Boolean, default=False, nullable=False)
    auth_provider = Column(String, default="email", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
