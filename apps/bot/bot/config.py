import os
from dataclasses import dataclass, field


def _load_dotenv() -> None:
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()


@dataclass
class BotSettings:
    token: str = field(default_factory=lambda: os.getenv("BOT_TOKEN", ""))
    webapp_url: str = field(default_factory=lambda: os.getenv("WEBAPP_URL", "http://localhost:5173"))
    api_url: str = field(default_factory=lambda: os.getenv("API_URL", "http://localhost:8000"))
    service_key: str = field(default_factory=lambda: os.getenv("SERVICE_KEY", "dev-service-key"))


settings = BotSettings()
