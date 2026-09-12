"""Attendance models — raw punches (immutable) and daily summary (derived)."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils.timezone import now


class AttendancePunch(Base):
    """Raw biometric device log — NEVER modified after insertion."""

    __tablename__ = "attendance_punches"

    __table_args__ = (
        UniqueConstraint(
            "device_id", "biometric_user_id", "punch_time",
            name="uq_punch_identity",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("devices.id"), nullable=False, index=True
    )
    biometric_user_id: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    punch_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    punch_type: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )  # IN, OUT, or None if device doesn't distinguish
    verified: Mapped[int | None] = mapped_column(Integer, nullable=True)
    raw_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    raw_work_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str] = mapped_column(
        String(20), default="DEVICE", nullable=False
    )  # DEVICE, MANUAL, IMPORT

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, nullable=False
    )

    # Relationships
    device = relationship("Device", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Punch user={self.biometric_user_id} time={self.punch_time}>"


class AttendanceDaily(Base):
    """Derived daily attendance state — recalculated when data changes."""

    __tablename__ = "attendance_daily"

    __table_args__ = (
        UniqueConstraint(
            "personnel_id", "attendance_date",
            name="uq_daily_attendance",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    personnel_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("personnel.id"), nullable=False, index=True
    )
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    first_in: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_out: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    total_work_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="ABSENT", nullable=False
    )  # PRESENT, LATE, ABSENT, LEAVE, OSD, MEDICAL, DUTY_REST, WEEKEND, HOLIDAY, OFF_DAY
    late_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    overtime_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    source: Mapped[str] = mapped_column(
        String(20), default="SYSTEM", nullable=False
    )  # SYSTEM, MANUAL
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, nullable=False
    )

    # Relationships
    personnel = relationship("Personnel", lazy="selectin")

    def __repr__(self) -> str:
        return f"<DailyAttendance person={self.personnel_id} date={self.attendance_date} status={self.status}>"
