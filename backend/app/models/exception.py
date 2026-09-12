"""Attendance exception model (Leave, OSD, Medical, Duty Rest)."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils.timezone import now


class AttendanceException(Base):
    __tablename__ = "exceptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    personnel_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("personnel.id"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    exception_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # LEAVE, OSD, MEDICAL, DUTY_REST
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, onupdate=now, nullable=False
    )

    # Relationships
    personnel = relationship("Personnel", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Exception person={self.personnel_id} date={self.date} type={self.exception_type}>"
