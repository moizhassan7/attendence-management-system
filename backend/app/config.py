"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration – all values from .env or OS environment."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──
    app_name: str = "Local Attendance System"
    app_env: Literal["development", "production", "testing"] = "development"

    # ── Server ──
    host: str = "0.0.0.0"
    port: int = 8000

    # ── Database ──
    database_url: str = "sqlite+aiosqlite:///./attendance.db"

    # ── Timezone ──
    timezone: str = "Asia/Karachi"

    # ── ZKTeco sync ──
    sync_interval_seconds: int = 30
    debounce_seconds: int = 60
    use_mock_device: bool = True
    device_timeout_seconds: int = 10

    # ── Authentication ──
    jwt_secret: str = "CHANGE_ME"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 480
    jwt_refresh_token_expire_days: int = 7

    # ── Default shift ──
    default_shift_start: str = "08:30"
    default_shift_end: str = "17:00"
    default_late_grace_minutes: int = 10

    # ── Business days ──
    weekend_days: str = "5,6"  # comma-separated, 0=Mon..6=Sun

    # ── Frontend ──
    frontend_url: str = "http://localhost:5173"

    # ── Admin seed ──
    admin_username: str = "admin"
    admin_password: str = "admin123"
    admin_email: str = "admin@local.attendance"

    # ── Logging ──
    log_level: str = "INFO"

    # ── Derived helpers ──

    @property
    def weekend_day_numbers(self) -> list[int]:
        """Return weekend day numbers as list of ints (0=Mon..6=Sun)."""
        return [int(d.strip()) for d in self.weekend_days.split(",") if d.strip()]

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def secret_key(self) -> str:
        return self.jwt_secret

    @property
    def algorithm(self) -> str:
        return self.jwt_algorithm

    @property
    def access_token_expire_minutes(self) -> int:
        return self.jwt_access_token_expire_minutes


@lru_cache
def get_settings() -> Settings:
    """Cached singleton – import this where needed."""
    return Settings()
