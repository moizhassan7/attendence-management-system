"""Personnel (employee) model."""

from __future__ import annotations

from datetime import datetime, date

from sqlalchemy import DateTime, ForeignKey, Integer, String, Boolean, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils.timezone import now


class Personnel(Base):
    __tablename__ = "personnel"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    biometric_user_id: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    employee_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    rank_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("ranks.id"), nullable=True, index=True
    )
    designation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    department_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("departments.id"), nullable=True, index=True
    )
    category: Mapped[str] = mapped_column(
        String(20), default="Uniform", nullable=False
    )  # Uniform, Non-Uniform
    duty_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    shift_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("shifts.id"), nullable=True
    )
    sanctioned_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    employment_status: Mapped[str] = mapped_column(
        String(20), default="Active", nullable=False
    )  # Active, Inactive, Suspended, Retired
    photo_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    cnic: Mapped[str | None] = mapped_column(String(20), nullable=True)
    father_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dob: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Biometrics
    has_fingerprint: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default='0')
    has_face: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default='0')

    gender: Mapped[str] = mapped_column(String(10), default="Male", server_default="Male", nullable=False)

    is_trainee: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    course_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("courses.id"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, onupdate=now, nullable=False
    )

    # Relationships
    department = relationship("Department", lazy="selectin")
    rank = relationship("Rank", lazy="selectin")
    shift = relationship("Shift", lazy="selectin")
    course = relationship("Course", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Personnel {self.biometric_user_id}: {self.full_name}>"
