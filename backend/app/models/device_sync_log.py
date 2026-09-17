"""Device sync log — audit trail for every synchronization attempt."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils.timezone import now


class DeviceSyncLog(Base):
    __tablename__ = "device_sync_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("devices.id"), nullable=False, index=True
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, nullable=False, index=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default="RUNNING", nullable=False
    )  # RUNNING, SUCCESS, FAILED
    logs_found: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    logs_inserted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    logs_skipped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    device = relationship("Device", lazy="selectin")

    def __repr__(self) -> str:
        return f"<SyncLog device={self.device_id} status={self.status}>"
