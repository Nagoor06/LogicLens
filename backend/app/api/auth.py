import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, get_current_user, get_db, hash_password, verify_password
from app.models.email_verification import EmailVerificationToken
from app.models.pending_registration import PendingRegistration
from app.models.schemas import (
    EmailVerificationRequest,
    GoogleAuthRequest,
    PasswordChangeRequest,
    ProfileUpdateRequest,
    ResendVerificationRequest,
    Token,
    UserCreate,
    UserLogin,
)
from app.models.user import User
from app.services.email_service import send_verification_email
from app.services.runtime_cache import invalidate_prefix

router = APIRouter(prefix="/auth", tags=["auth"])


def build_token_response(user: User):
    access_token = create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "is_verified": bool(user.is_verified),
            "auth_provider": user.auth_provider or "email",
        },
    }


def create_pending_registration(db: Session, payload: UserCreate) -> tuple[PendingRegistration, str]:
    normalized_email = payload.email.strip().lower()
    db.query(PendingRegistration).filter(
        func.lower(PendingRegistration.email) == normalized_email,
        PendingRegistration.used.is_(False),
    ).update({"used": True}, synchronize_session=False)

    raw_token = secrets.token_urlsafe(32)
    pending = PendingRegistration(
        email=normalized_email,
        name=payload.name.strip(),
        hashed_password=hash_password(payload.password),
        token=raw_token,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES),
        used=False,
    )
    db.add(pending)
    db.flush()
    verification_url = f"{settings.FRONTEND_APP_URL.rstrip('/')}/verify-email?token={raw_token}"
    return pending, verification_url


def create_email_verification_token(db: Session, user: User) -> tuple[EmailVerificationToken, str]:
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user.id,
        EmailVerificationToken.used.is_(False),
    ).update({"used": True}, synchronize_session=False)

    raw_token = secrets.token_urlsafe(32)
    token_record = EmailVerificationToken(
        user_id=user.id,
        token=raw_token,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES),
        used=False,
    )
    db.add(token_record)
    db.flush()
    verification_url = f"{settings.FRONTEND_APP_URL.rstrip('/')}/verify-email?token={raw_token}"
    return token_record, verification_url


def resolve_google_identity(payload: GoogleAuthRequest):
    try:
        import requests
    except (ModuleNotFoundError, ImportError) as exc:
        raise HTTPException(
            status_code=503,
            detail="Google sign-in dependency is not installed on the server.",
        ) from exc

    if payload.access_token:
        try:
            response = requests.get(
                "https://openidconnect.googleapis.com/v1/userinfo",
                headers={"Authorization": f"Bearer {payload.access_token}"},
                timeout=10,
            )
        except requests.RequestException as exc:
            raise HTTPException(status_code=502, detail="Unable to verify Google account right now.") from exc

        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google credential.")
        token_info = response.json()
    else:
        try:
            from google.auth.transport import requests as google_requests
            from google.oauth2 import id_token
        except (ModuleNotFoundError, ImportError) as exc:
            raise HTTPException(
                status_code=503,
                detail="Google sign-in dependency is not installed on the server.",
            ) from exc

        try:
            token_info = id_token.verify_oauth2_token(
                payload.credential,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except Exception as exc:
            raise HTTPException(status_code=401, detail="Invalid Google credential.") from exc

    verified_email = str(token_info.get("email") or "").strip().lower()
    email_verified = bool(token_info.get("email_verified"))
    name = str(token_info.get("name") or "").strip()

    if not verified_email or not email_verified:
        raise HTTPException(status_code=400, detail="Google account email is not verified.")

    return verified_email, name


@router.post("/register")
def register(payload: UserCreate, db: Session = Depends(get_db)):
    normalized_email = payload.email.strip().lower()
    existing_user = db.query(User).filter(func.lower(User.email) == normalized_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    pending, verification_url = create_pending_registration(db, payload)
    db.commit()
    delivery_sent = send_verification_email(pending.email, pending.name, verification_url)

    return {
        "message": "Verification email sent. Click the link in your email to complete registration.",
        "email_sent": delivery_sent,
        "verification_token": pending.token if not delivery_sent else None,
    }


@router.post("/login", response_model=Token)
async def login(request: Request, db: Session = Depends(get_db)):
    content_type = request.headers.get("content-type", "").lower()

    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form = await request.form()
        raw_email = str(form.get("username") or form.get("email") or "").strip()
        password = str(form.get("password") or "")
    else:
        body = await request.json()
        payload = UserLogin(**body)
        raw_email = payload.email.strip()
        password = payload.password

    normalized_email = raw_email.lower()
    pending = (
        db.query(PendingRegistration)
        .filter(func.lower(PendingRegistration.email) == normalized_email, PendingRegistration.used.is_(False))
        .order_by(PendingRegistration.created_at.desc())
        .first()
    )
    if pending and pending.expires_at >= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email from the link we sent before logging in.")

    db_user = db.query(User).filter(func.lower(User.email) == normalized_email).first()

    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found. Please register first.")

    if (db_user.auth_provider or "email") == "email" and not bool(db_user.is_verified):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email before logging in.")

    if not verify_password(password, db_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password.")

    return build_token_response(db_user)


@router.post("/google", response_model=Token)
def google_login(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured.")

    verified_email, name = resolve_google_identity(payload)
    user = db.query(User).filter(func.lower(User.email) == verified_email).first()

    if payload.intent == "login":
        if user is None:
            raise HTTPException(status_code=404, detail="No account found for this Google email. Please register first.")

        updates_made = False
        if name and user.name != name:
            user.name = name
            updates_made = True
        if not user.is_verified:
            user.is_verified = True
            updates_made = True
        if updates_made:
            db.commit()
            db.refresh(user)
            invalidate_prefix(f"me:{user.id}")
        return build_token_response(user)

    if user is not None:
        raise HTTPException(status_code=400, detail="Account already registered. Please proceed via login.")

    user = User(
        email=verified_email,
        name=name or verified_email.split("@")[0],
        hashed_password=hash_password(secrets.token_urlsafe(32)),
        is_verified=True,
        auth_provider="google",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return build_token_response(user)


@router.post("/verify-email")
def verify_email(payload: EmailVerificationRequest, db: Session = Depends(get_db)):
    pending = db.query(PendingRegistration).filter(PendingRegistration.token == payload.token).first()
    if pending is not None:
        if pending.used:
            raise HTTPException(status_code=400, detail="Verification link has already been used.")
        if pending.expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Verification link has expired.")

        existing_user = db.query(User).filter(func.lower(User.email) == pending.email).first()
        if existing_user is not None:
            pending.used = True
            db.commit()
            raise HTTPException(status_code=400, detail="Email already registered. Please log in.")

        user = User(
            email=pending.email,
            name=pending.name,
            hashed_password=pending.hashed_password,
            is_verified=True,
            auth_provider="email",
        )
        db.add(user)
        pending.used = True
        db.commit()
        db.refresh(user)
        return {"message": "Email verified successfully. Your account is now active. You can log in."}

    token_record = db.query(EmailVerificationToken).filter(EmailVerificationToken.token == payload.token).first()
    if token_record is None:
        raise HTTPException(status_code=404, detail="Verification link is invalid.")
    if token_record.used:
        raise HTTPException(status_code=400, detail="Verification link has already been used.")
    if token_record.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification link has expired.")

    user = db.query(User).filter(User.id == token_record.user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User for this verification link was not found.")

    user.is_verified = True
    token_record.used = True
    db.commit()
    invalidate_prefix(f"me:{user.id}")
    return {"message": "Email verified successfully. You can now log in."}


@router.post("/resend-verification")
def resend_verification(payload: ResendVerificationRequest, db: Session = Depends(get_db)):
    pending = (
        db.query(PendingRegistration)
        .filter(func.lower(PendingRegistration.email) == payload.email, PendingRegistration.used.is_(False))
        .order_by(PendingRegistration.created_at.desc())
        .first()
    )
    if pending is not None and pending.expires_at >= datetime.now(timezone.utc):
        db.query(PendingRegistration).filter(
            func.lower(PendingRegistration.email) == payload.email,
            PendingRegistration.used.is_(False),
        ).update({"used": True}, synchronize_session=False)
        raw_token = secrets.token_urlsafe(32)
        pending = PendingRegistration(
            email=payload.email,
            name=pending.name,
            hashed_password=pending.hashed_password,
            token=raw_token,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES),
            used=False,
        )
        db.add(pending)
        db.flush()
        verification_url = f"{settings.FRONTEND_APP_URL.rstrip('/')}/verify-email?token={raw_token}"
        db.commit()
        delivery_sent = send_verification_email(pending.email, pending.name, verification_url)
        return {
            "message": "Verification email sent. Please check your inbox.",
            "email_sent": delivery_sent,
            "verification_token": pending.token if not delivery_sent else None,
        }

    user = db.query(User).filter(func.lower(User.email) == payload.email).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found. Please register first.")
    if (user.auth_provider or "email") != "email":
        raise HTTPException(status_code=400, detail="This account uses Google sign-in.")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="Email is already verified. Please log in.")

    token_record, verification_url = create_email_verification_token(db, user)
    db.commit()
    delivery_sent = send_verification_email(user.email, user.name, verification_url)
    return {
        "message": "Verification email sent. Please check your inbox.",
        "email_sent": delivery_sent,
        "verification_token": token_record.token if not delivery_sent else None,
    }


@router.post("/change-password")
def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if payload.new_password != payload.confirm_new_password:
        raise HTTPException(status_code=400, detail="New password and confirm new password do not match")

    if verify_password(payload.new_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    invalidate_prefix(f"me:{current_user.id}")

    return {"message": "Password updated successfully"}


@router.put("/profile")
def update_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.name = payload.name.strip()
    db.commit()
    db.refresh(current_user)
    invalidate_prefix(f"me:{current_user.id}")
    return {"message": "Profile updated successfully", "name": current_user.name}


