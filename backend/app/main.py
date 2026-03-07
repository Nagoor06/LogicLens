import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api import analytics, auth, history, review as review_api
from app.core.config import settings
from app.core.security import get_current_user
from app.db import Base, engine
from app.models import review, session, user
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
    description="AI-powered code review platform with structured LLM feedback, analytics, and user-specific history.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=5)
Base.metadata.create_all(bind=engine)
for index in CodeSession.__table__.indexes.union(Review.__table__.indexes):
    index.create(bind=engine, checkfirst=True)

app.include_router(auth.router)
app.include_router(review_api.router)
app.include_router(history.router)
app.include_router(analytics.router)


@app.get("/")
def root():
    return {"message": "LogicLens backend running"}


@app.get("/me")
def read_current_user(current_user: User = Depends(get_current_user)):
    return get_or_set(
        f"me:{current_user.id}",
        15,
        lambda: {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
        },
    )
