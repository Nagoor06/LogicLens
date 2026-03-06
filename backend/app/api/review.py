import json
import logging
import threading
import time
from typing import Generator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.db import SessionLocal
from app.models.review import Review
from app.models.schemas import ReviewRequest
from app.models.session import CodeSession
from app.models.user import User
from app.services.llm_client import call_llm, stream_llm
from app.services.prompt_engine import build_prompt
from app.services.rate_limiter import RateLimitExceeded, check_rate_limit
from app.services.response_parser import parse_llm_response
from app.services.runtime_cache import invalidate_prefix

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/review", tags=["review"])
_active_review_slots = threading.BoundedSemaphore(settings.MAX_CONCURRENT_AI_REVIEWS)
SUPPORTED_LANGUAGES = {"plaintext", "python", "javascript", "typescript", "java", "cpp", "csharp", "go", "rust"}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def validate_review_payload(payload: ReviewRequest):
    if not payload.code.strip():
        raise HTTPException(status_code=400, detail="Please provide code to analyze.")
    if payload.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {payload.language}")


def create_session_record(payload: ReviewRequest, current_user: User, db: Session) -> CodeSession:
    session = CodeSession(
        user_id=current_user.id,
        language=payload.language,
        question_text=payload.question_text,
        code=payload.code,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def save_review(db: Session, session_id: int, action_type: str, parsed_result: dict) -> Review:
    review = Review(session_id=session_id, action_type=action_type, result_json=json.dumps(parsed_result))
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


def run_rate_limit(user_id: int):
    try:
        check_rate_limit(f"review:{user_id}", settings.REVIEW_RATE_LIMIT_PER_MINUTE)
    except RateLimitExceeded as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc


def acquire_review_slot():
    if not _active_review_slots.acquire(blocking=False):
        raise HTTPException(status_code=429, detail="AI is handling too many requests. Please retry in a few seconds.")


@router.post("/")
def create_review(payload: ReviewRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    validate_review_payload(payload)
    run_rate_limit(current_user.id)
    acquire_review_slot()

    started_at = time.perf_counter()
    session = None

    try:
        session = create_session_record(payload, current_user, db)
        prompt = build_prompt(payload.action_type, payload.language, payload.code, payload.question_text)
        llm_output = call_llm(prompt)
        parsed_result = parse_llm_response(llm_output)
        review = save_review(db, session.id, payload.action_type, parsed_result)
        invalidate_prefix(f"history:{current_user.id}")

        logger.info(
            "review_completed user_id=%s session_id=%s action_type=%s response_time_ms=%s",
            current_user.id,
            session.id,
            payload.action_type,
            round((time.perf_counter() - started_at) * 1000, 2),
        )
        return {"session_id": session.id, "review_id": review.id, "result": parsed_result}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "review_failed user_id=%s session_id=%s action_type=%s error=%s",
            current_user.id,
            getattr(session, "id", None),
            payload.action_type,
            exc,
        )
        raise HTTPException(status_code=500, detail="Review generation failed.") from exc
    finally:
        _active_review_slots.release()


@router.post("/stream")
def stream_review(payload: ReviewRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    validate_review_payload(payload)
    run_rate_limit(current_user.id)
    acquire_review_slot()

    started_at = time.perf_counter()
    session = None

    try:
        session = create_session_record(payload, current_user, db)
        prompt = build_prompt(payload.action_type, payload.language, payload.code, payload.question_text)
    except Exception:
        _active_review_slots.release()
        raise

    def event_stream() -> Generator[str, None, None]:
        collected = []
        try:
            yield f"data: {json.dumps({'type': 'status', 'content': 'Analyzing code...'})}\n\n"
            for token in stream_llm(prompt):
                collected.append(token)
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            parsed_result = parse_llm_response("".join(collected))
            review = save_review(db, session.id, payload.action_type, parsed_result)
            invalidate_prefix(f"history:{current_user.id}")
            logger.info(
                "review_stream_completed user_id=%s session_id=%s action_type=%s response_time_ms=%s",
                current_user.id,
                session.id,
                payload.action_type,
                round((time.perf_counter() - started_at) * 1000, 2),
            )
            yield f"data: {json.dumps({'type': 'final', 'session_id': session.id, 'review_id': review.id, 'result': parsed_result})}\n\n"
        except Exception as exc:
            logger.exception(
                "review_stream_failed user_id=%s session_id=%s action_type=%s error=%s",
                current_user.id,
                getattr(session, 'id', None),
                payload.action_type,
                exc,
            )
            yield f"data: {json.dumps({'type': 'error', 'content': 'Streaming failed.'})}\n\n"
        finally:
            _active_review_slots.release()

    return StreamingResponse(event_stream(), media_type="text/event-stream")
