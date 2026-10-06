from dataclasses import dataclass
import os
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    database: str = os.getenv("DATABASE_PATH", ".runtime/sentinel.db")
    origin: str = os.getenv("APP_ORIGIN", "http://127.0.0.1:5178")
    production: bool = os.getenv("ENVIRONMENT", "development") == "production"
    session_seconds: int = 7 * 86400
    demo_seconds: int = 86400
    auth_limit: int = 40
