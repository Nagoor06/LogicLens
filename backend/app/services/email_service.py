import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_verification_email(recipient_email: str, recipient_name: str, verification_url: str) -> bool:
    if not settings.SMTP_HOST or not settings.EMAIL_FROM or not settings.FRONTEND_APP_URL:
        logger.info("Email delivery not configured. Verification link for %s: %s", recipient_email, verification_url)
        return False

    message = EmailMessage()
    message["Subject"] = "Verify your LogicLens account"
    message["From"] = settings.EMAIL_FROM
    message["To"] = recipient_email
    message.set_content(
        f"Hi {recipient_name or 'there'},\n\n"
        f"Verify your LogicLens account by opening this link:\n{verification_url}\n\n"
        f"This link expires in {settings.EMAIL_VERIFICATION_EXPIRE_MINUTES} minutes.\n"
    )

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)
        return True
    except Exception:
        logger.exception("Failed to send verification email to %s", recipient_email)
        return False
