from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./data/dev.db"
    redis_url: str = "redis://localhost:6379/0"
    bot_token: str = ""
    web_origin: str = "http://localhost:5173"
    data_dir: Path = Path("./data")
    seed_on_start: bool = True

    auto_confirm_hours: int = 72
    payment_timeout_minutes: int = 30
    commission_rate: float = 0.10
    service_key: str = "dev-service-key"
    quiz_pass_score: int = 7


@lru_cache
def get_settings() -> Settings:
    return Settings()
