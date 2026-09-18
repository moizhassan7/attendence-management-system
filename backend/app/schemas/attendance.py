"""Attendance schemas."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class AttendancePunchOut(BaseModel):
    id: int
    device_id: int
    biometric_user_id: str
    punch_time: datetime
    punch_type: str | None
    verified: int | None
    source: str
    created_at: datetime
    # Resolved
    personnel_name: str | None = None
    rank_name: str | None = None
    department_name: str | None = None
    employee_code: str | None = None
    device_name: str | None = None
    model_config = {"from_attributes": True}


class AttendanceDailyOut(BaseModel):
    id: int
    personnel_id: int
    attendance_date: date
    first_in: datetime | None
    last_out: datetime | None
    total_work_minutes: float | None
    status: str
    late_minutes: int
    overtime_minutes: int
    source: str
    calculated_at: datetime
    # Resolved
    personnel_name: str | None = None
    employee_code: str | None = None
    biometric_user_id: str | None = None
    department_name: str | None = None
    rank_name: str | None = None
    category: str | None = None
    shift_name: str | None = None
    course_name: str | None = None
    designation: str | None = None
    gender: str | None = None
    is_trainee: bool | None = None
    cnic: str | None = None
    father_name: str | None = None
    model_config = {"from_attributes": True}
