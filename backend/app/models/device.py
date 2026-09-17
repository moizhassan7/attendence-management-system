"""ZKTeco biometric device model."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.utils.timezone import now


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    ip_address: Mapped[str] = mapped_column(String(45), unique=True, nullable=False)
    port: Mapped[int] = mapped_column(Integer, default=4370, nullable=False)
    communication_password: Mapped[str | None] = mapped_column(String(100), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)

    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    preferred_transport: Mapped[str] = mapped_column(
        String(10), default="auto", nullable=False
    )  # auto, tcp, udp
    connection_status: Mapped[str] = mapped_column(
        String(20), default="UNKNOWN", nullable=False
    )  # ONLINE, OFFLINE, UNKNOWN, ERROR, SYNCING, DEGRADED
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, onupdate=now, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Device {self.name} ({self.ip_address}:{self.port})>"
