import json
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db import SessionLocal
from app.models.review import Review
from app.models.session import CodeSession
from app.models.user import User
from app.services.runtime_cache import get_or_set, invalidate_prefix

router = APIRouter(prefix="/history", tags=["history"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/")
def get_user_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    def load_history():
        sessions = (
            db.query(CodeSession)
            .filter(CodeSession.user_id == current_user.id)
            .order_by(CodeSession.created_at.desc())
            .all()
        )

        if not sessions:
            return []

        session_ids = [session.id for session in sessions]
        reviews = (
            db.query(Review)
            .filter(Review.session_id.in_(session_ids))
            .order_by(Review.created_at.desc())
            .all()
        )

        reviews_by_session = defaultdict(list)
        for review in reviews:
            try:
                parsed_result = json.loads(review.result_json)
            except Exception:
                parsed_result = {"summary": "Invalid stored result format", "raw": review.result_json}

            reviews_by_session[review.session_id].append({
                "review_id": review.id,
                "action_type": review.action_type,
                "result": parsed_result,
            })

        return [
            {
                "session_id": session.id,
                "language": session.language,
                "question_text": session.question_text,
                "code": session.code,
                "created_at": session.created_at,
                "reviews": reviews_by_session.get(session.id, []),
            }
            for session in sessions
        ]

    return get_or_set(f"history:{current_user.id}", 15, load_history)


@router.delete("/{session_id}")
def delete_history_entry(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(CodeSession).filter(CodeSession.id == session_id, CodeSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="History entry not found")

    db.query(Review).filter(Review.session_id == session.id).delete()
    db.delete(session)
    db.commit()
    invalidate_prefix(f"history:{current_user.id}")
    return {"message": "History entry deleted"}


@router.delete("/")
def clear_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session_ids = [row.id for row in db.query(CodeSession.id).filter(CodeSession.user_id == current_user.id).all()]
    if session_ids:
        db.query(Review).filter(Review.session_id.in_(session_ids)).delete(synchronize_session=False)
        db.query(CodeSession).filter(CodeSession.user_id == current_user.id).delete(synchronize_session=False)
        db.commit()

    invalidate_prefix(f"history:{current_user.id}")
    return {"message": "History cleared"}
