from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.security import get_current_user
from app.models.user import User
from app.models.session import CodeSession
from app.models.review import Review
from app.db import SessionLocal

router = APIRouter(prefix="/analytics", tags=["analytics"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/")
def get_user_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    total_sessions = (
        db.query(CodeSession)
        .filter(CodeSession.user_id == current_user.id)
        .count()
    )

    total_reviews = (
        db.query(Review)
        .join(CodeSession)
        .filter(CodeSession.user_id == current_user.id)
        .count()
    )

    scores = (
        db.query(Review.score)
        .join(CodeSession)
        .filter(CodeSession.user_id == current_user.id)
        .all()
    )

    score_list = [s[0] for s in scores if s[0] is not None]

    average_score = round(sum(score_list) / len(score_list), 2) if score_list else 0
    best_score = max(score_list) if score_list else 0
    worst_score = min(score_list) if score_list else 0

    most_used_action = (
        db.query(Review.action_type, func.count(Review.action_type))
        .join(CodeSession)
        .filter(CodeSession.user_id == current_user.id)
        .group_by(Review.action_type)
        .order_by(func.count(Review.action_type).desc())
        .first()
    )

    return {
        "total_sessions": total_sessions,
        "total_reviews": total_reviews,
        "average_score": average_score,
        "best_score": best_score,
        "worst_score": worst_score,
        "most_used_action": most_used_action[0] if most_used_action else None
    }