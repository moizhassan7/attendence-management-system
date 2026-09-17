"""SQLAlchemy async engine and session factory."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# Determine connect args for SQLite (allow multi-thread + busy timeout)
_connect_args: dict = {}
if settings.database_url.startswith("sqlite"):
    _connect_args = {"check_same_thread": False, "timeout": 30.0}

import os
from sqlalchemy import event

engine = create_async_engine(
    settings.database_url,
    echo=os.getenv("DB_ECHO", "false").lower() == "true",
    connect_args=_connect_args,
    pool_pre_ping=True,
)

if settings.database_url.startswith("sqlite"):
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency – yields an async DB session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Create all tables (development convenience – use Alembic in production)."""
    import app.models  # noqa: F401 - ensure all models are registered
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_sync_log_retry_count)
        await conn.run_sync(_ensure_device_preferred_transport)


def _ensure_sync_log_retry_count(sync_conn) -> None:
    """Add retry_count to existing databases without requiring a manual migration."""
    from sqlalchemy import inspect, text

    inspector = inspect(sync_conn)
    if "device_sync_logs" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("device_sync_logs")}
    if "retry_count" in columns:
        return
    dialect = sync_conn.dialect.name
    if dialect == "postgresql":
        sync_conn.execute(text(
            "ALTER TABLE device_sync_logs ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0"
        ))
    else:
        sync_conn.execute(text(
            "ALTER TABLE device_sync_logs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0"
        ))


def _ensure_device_preferred_transport(sync_conn) -> None:
    """Add preferred_transport to existing device rows."""
    from sqlalchemy import inspect, text

    inspector = inspect(sync_conn)
    if "devices" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("devices")}
    if "preferred_transport" in columns:
        return
    dialect = sync_conn.dialect.name
    if dialect == "postgresql":
        sync_conn.execute(text(
            "ALTER TABLE devices ADD COLUMN IF NOT EXISTS preferred_transport VARCHAR(10) NOT NULL DEFAULT 'auto'"
        ))
    else:
        sync_conn.execute(text(
            "ALTER TABLE devices ADD COLUMN preferred_transport VARCHAR(10) NOT NULL DEFAULT 'auto'"
        ))


async def reset_db() -> None:
    """Drop and recreate every table."""
    import app.models  # noqa: F401 - ensure all models are registered
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
