import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


APP_ACCESS_TOKEN = (os.getenv("APP_ACCESS_TOKEN") or "").strip()
DEMO_MODE = env_bool("DEMO_MODE", not APP_ACCESS_TOKEN)

if not APP_ACCESS_TOKEN and not DEMO_MODE:
    raise RuntimeError("Set APP_ACCESS_TOKEN or DEMO_MODE=true. Never run an unprotected production instance.")

DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip()
SQLITE_PATH = os.getenv("SQLITE_PATH") or str(BASE_DIR / "data" / "followupflow.db")

CLIENT_ORIGINS = [origin.strip() for origin in (
    os.getenv("CLIENT_ORIGIN") or "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if origin.strip()]

MCP_ALLOWED_HOSTS = [host.strip() for host in (os.getenv("MCP_ALLOWED_HOSTS") or "").split(",") if host.strip()]
MCP_ALLOWED_ORIGINS = [origin.strip() for origin in (os.getenv("MCP_ALLOWED_ORIGINS") or "").split(",") if origin.strip()]

PORT = int(os.getenv("PORT") or "5000")
