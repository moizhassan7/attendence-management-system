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
    device_timeout_seconds: int = 10  # legacy alias for connection timeout
    device_connection_timeout: int = 10
    device_command_timeout: int = 30
    device_read_timeout: int = 60
    device_max_retries: int = 3
    device_retry_backoff: int = 2
    device_persist_batch_size: int = 500
    device_sync_concurrency: int = 4
    device_sync_lookback_minutes: int = 120
    # After a successful persist, wipe the terminal attendance log (CMD_CLEAR_ATTLOG).
    # pyzk cannot filter downloads, so this is what keeps later 90s cycles small.
    device_clear_log_after_sync: bool = True
    device_clear_log_min_records: int = 5000

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

    # ── Frontend / CORS ──
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = ""

    # ── Admin seed ──
    seed_on_start: bool = True
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
    def cors_origin_list(self) -> list[str]:
        origins: list[str] = []
        seen: set[str] = set()
        extras = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        for origin in [
            self.frontend_url,
            *extras,
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://182.176.174.69",
            "http://182.176.174.69:5173",
            "https://182.176.174.69.sslip.io",
            "http://182.176.174.69.sslip.io",
            "http://192.168.1.3",
            "http://192.168.1.3:5173",
        ]:
            if origin and origin not in seen:
                seen.add(origin)
                origins.append(origin)
        return origins

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
