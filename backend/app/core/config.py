try:
    from pydantic_settings import BaseSettings

    SETTINGS_STYLE = "v2"
except ModuleNotFoundError:
    from pydantic.v1 import BaseSettings

    SETTINGS_STYLE = "v1"


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
    MAX_CONCURRENT_AI_REVIEWS: int = 16
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    if SETTINGS_STYLE == "v2":
        model_config = {
            "env_file": ".env",
            "extra": "ignore",
        }
    else:
        class Config:
            env_file = ".env"
            extra = "ignore"


settings = Settings()
