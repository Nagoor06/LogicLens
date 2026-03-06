from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.db import Base


class User(Base):

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    email = Column(String, unique=True, index=True)

    name = Column(String)

    address = Column(String)

    hashed_password = Column(String)

    created_at = Column(DateTime(timezone=True), server_default=func.now())