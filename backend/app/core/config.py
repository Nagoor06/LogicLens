from pathlib import Path

try:
    from pydantic_settings import BaseSettings

    SETTINGS_STYLE = "v2"
except ModuleNotFoundError:
    from pydantic.v1 import BaseSettings

    SETTINGS_STYLE = "v1"

BASE_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REDIS_URL: str = ""
    GROQ_API_KEY: str
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    GROQ_TIMEOUT_SECONDS: int = 60
    REVIEW_RATE_LIMIT_PER_MINUTE: int = 5
    HISTORY_RATE_LIMIT_PER_MINUTE: int = 20
    MAX_CONCURRENT_AI_REVIEWS: int = 16
    MAX_QUEUED_AI_REVIEWS: int = 32
    REVIEW_RESULT_CACHE_SECONDS: int = 300
    HISTORY_CACHE_SECONDS: int = 45
    GOOGLE_CLIENT_ID: str = ""
    FRONTEND_ORIGINS: str = "http://localhost:5173"

    if SETTINGS_STYLE == "v2":
        model_config = {
            "env_file": str(ENV_FILE),
            "extra": "ignore",
        }
    else:
        class Config:
            env_file = str(ENV_FILE)
            extra = "ignore"

    @property
    def frontend_origins_list(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.FRONTEND_ORIGINS.split(",") if origin.strip()]


settings = Settings()

