import logging
from sqlalchemy import inspect, text

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api import auth, history, review as review_api
from app.core.config import settings
from app.core.security import get_current_user
from app.db import Base, engine
from app.models.email_verification import EmailVerificationToken
from app.models.pending_registration import PendingRegistration
from app.models.review import Review
from app.models.session import CodeSession
from app.models.user import User
from app.services.runtime_cache import get_or_set

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(
    title="LogicLens API",
    description="AI-powered code review platform with structured LLM feedback and optional retrieval-augmented grounding.",
    version="1.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=5)


def ensure_auth_schema():
    inspector = inspect(engine)
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    with engine.begin() as connection:
        if "is_verified" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE"))
            connection.execute(text("UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL"))
        if "auth_provider" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) DEFAULT 'email'"))
            connection.execute(text("UPDATE users SET auth_provider = 'email' WHERE auth_provider IS NULL OR auth_provider = ''"))


# Core tables are always created.
Base.metadata.create_all(bind=engine)
ensure_auth_schema()

for index in CodeSession.__table__.indexes.union(Review.__table__.indexes):
    index.create(bind=engine, checkfirst=True)

# Vector/RAG storage is opt-in so existing deployments do not require pgvector
# until RAG is enabled and the Postgres instance supports the extension.
if settings.RAG_ENABLED:
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

    from app.models.knowledge import KnowledgeChunk

    Base.metadata.create_all(bind=engine)
    for index in KnowledgeChunk.__table__.indexes:
        index.create(bind=engine, checkfirst=True)

app.include_router(auth.router)
app.include_router(review_api.router)
app.include_router(history.router)

if settings.RAG_ENABLED:
    from app.api import knowledge

    app.include_router(knowledge.router)


@app.get("/")
def root():
    return {"message": "LogicLens backend running", "rag_enabled": settings.RAG_ENABLED}


@app.get("/me")
def read_current_user(current_user: User = Depends(get_current_user)):
    return get_or_set(
        f"me:{current_user.id}",
        15,
        lambda: {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "is_verified": bool(current_user.is_verified),
            "auth_provider": current_user.auth_provider or "email",
        },
    )
