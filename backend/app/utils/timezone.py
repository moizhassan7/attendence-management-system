"""Timezone utilities — all attendance logic uses Asia/Karachi."""

from __future__ import annotations

from datetime import datetime, date, time
from zoneinfo import ZoneInfo

from app.config import get_settings


def get_tz() -> ZoneInfo:
    """Return the configured timezone (default: Asia/Karachi)."""
    return ZoneInfo(get_settings().timezone)


def now() -> datetime:
    """Current datetime in configured timezone."""
    return datetime.now(tz=get_tz())


def today() -> date:
    """Current date in configured timezone."""
    return now().date()


def make_aware(dt: datetime) -> datetime:
    """Attach configured timezone to a naive datetime."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=get_tz())
    return dt.astimezone(get_tz())


def combine_date_time(d: date, t: time) -> datetime:
    """Combine date and time in the configured timezone."""
    return datetime.combine(d, t, tzinfo=get_tz())
