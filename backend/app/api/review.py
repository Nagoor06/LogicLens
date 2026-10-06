import hashlib
import json
import logging
import queue
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
from app.services.review_queue import submit_review_job
from app.services.runtime_cache import get_cached, get_or_set, invalidate_prefix, make_review_cache_key, set_cached

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/review", tags=["review"])
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


def build_rag_context(payload: ReviewRequest, current_user: User, db: Session) -> tuple[str, list[dict]]:
    if not settings.RAG_ENABLED:
        return "", []

    query = "\n".join(
        part for part in [payload.question_text or "", payload.code] if part.strip()
    )

    try:
        from app.services.knowledge_service import retrieve_context

        return retrieve_context(db, current_user.id, query)
    except Exception:
        # RAG is additive; a retrieval-provider/database failure should not
        # take down the underlying code-review workflow.
        logger.exception("rag_retrieval_failed user_id=%s", current_user.id)
        return "", []


def build_review_cache_key(
    payload: ReviewRequest,
    current_user: User,
    retrieved_context: str,
) -> str:
    rag_hash = hashlib.sha256(retrieved_context.encode("utf-8")).hexdigest()[:16] if retrieved_context else "none"
    return make_review_cache_key(
        current_user.id,
        {
            "action_type": payload.action_type,
            "language": payload.language,
            "code": payload.code,
            "question_text": payload.question_text or "",
            "rag_context_hash": rag_hash,
        },
    )


def generate_review_result(
    payload: ReviewRequest,
    retrieved_context: str,
    sources: list[dict],
) -> dict:
    prompt = build_prompt(
        payload.action_type,
        payload.language,
        payload.code,
        payload.question_text,
        retrieved_context,
    )
    result = parse_llm_response(call_llm(prompt))
    result["sources"] = sources
    return result


@router.post("/")
def create_review(
    payload: ReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    validate_review_payload(payload)
    run_rate_limit(current_user.id)

    started_at = time.perf_counter()
    session = create_session_record(payload, current_user, db)
    retrieved_context, sources = build_rag_context(payload, current_user, db)
    cache_key = build_review_cache_key(payload, current_user, retrieved_context)

    try:
        parsed_result = submit_review_job(
            lambda: get_or_set(
                cache_key,
                settings.REVIEW_RESULT_CACHE_SECONDS,
                lambda: generate_review_result(payload, retrieved_context, sources),
            )
        ).result(timeout=settings.GROQ_TIMEOUT_SECONDS + 5)

        review = save_review(db, session.id, payload.action_type, parsed_result)
        invalidate_prefix(f"history:{current_user.id}")

        logger.info(
            "review_completed user_id=%s session_id=%s action_type=%s rag_sources=%s response_time_ms=%s",
            current_user.id,
            session.id,
            payload.action_type,
            len(parsed_result.get("sources", [])),
            round((time.perf_counter() - started_at) * 1000, 2),
        )
        return {"session_id": session.id, "review_id": review.id, "result": parsed_result}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "review_failed user_id=%s session_id=%s action_type=%s error=%s",
            current_user.id,
            session.id,
            payload.action_type,
            exc,
        )
        raise HTTPException(status_code=500, detail="Review generation failed.") from exc


@router.post("/stream")
def stream_review(
    payload: ReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    validate_review_payload(payload)
    run_rate_limit(current_user.id)

    started_at = time.perf_counter()
    session = create_session_record(payload, current_user, db)
    retrieved_context, sources = build_rag_context(payload, current_user, db)
    cache_key = build_review_cache_key(payload, current_user, retrieved_context)
    cached_result = get_cached(cache_key)

    if cached_result is not None:
        review = save_review(db, session.id, payload.action_type, cached_result)
        invalidate_prefix(f"history:{current_user.id}")

        def cached_stream() -> Generator[str, None, None]:
            yield f"data: {json.dumps({'type': 'status', 'content': 'Loaded from cache'})}\n\n"
            yield f"data: {json.dumps({'type': 'final', 'session_id': session.id, 'review_id': review.id, 'result': cached_result})}\n\n"

        return StreamingResponse(cached_stream(), media_type="text/event-stream")

    prompt = build_prompt(
        payload.action_type,
        payload.language,
        payload.code,
        payload.question_text,
        retrieved_context,
    )

    def event_stream() -> Generator[str, None, None]:
        events: queue.Queue[tuple[str, dict]] = queue.Queue()

        def worker():
            collected = []
            try:
                if sources:
                    events.put(("status", {"type": "status", "content": "Retrieved relevant context..."}))
                events.put(("status", {"type": "status", "content": "Analyzing code..."}))

                for token in stream_llm(prompt):
                    collected.append(token)
                    events.put(("token", {"type": "token", "content": token}))

                parsed_result = parse_llm_response("".join(collected))
                parsed_result["sources"] = sources
                events.put(("final_payload", {"result": parsed_result}))
            except Exception as exc:
                logger.exception(
                    "review_stream_failed user_id=%s session_id=%s action_type=%s error=%s",
                    current_user.id,
                    session.id,
                    payload.action_type,
                    exc,
                )
                events.put(("error", {"type": "error", "content": "Streaming failed."}))
            finally:
                events.put(("done", {"type": "done"}))

        submit_review_job(worker)

        while True:
            event_type, payload_data = events.get()
            if event_type == "done":
                break
            if event_type == "final_payload":
                parsed_result = payload_data["result"]
                set_cached(cache_key, settings.REVIEW_RESULT_CACHE_SECONDS, parsed_result)
                review = save_review(db, session.id, payload.action_type, parsed_result)
                invalidate_prefix(f"history:{current_user.id}")
                logger.info(
                    "review_stream_completed user_id=%s session_id=%s action_type=%s rag_sources=%s response_time_ms=%s",
                    current_user.id,
                    session.id,
                    payload.action_type,
                    len(parsed_result.get("sources", [])),
                    round((time.perf_counter() - started_at) * 1000, 2),
                )
                yield f"data: {json.dumps({'type': 'final', 'session_id': session.id, 'review_id': review.id, 'result': parsed_result})}\n\n"
                continue
            yield f"data: {json.dumps(payload_data)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
