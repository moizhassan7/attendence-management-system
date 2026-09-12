"""Department, Rank, Shift, Holiday, Exception schemas."""

from __future__ import annotations

from datetime import date, time, datetime

from pydantic import BaseModel


# ── Department ──

class DepartmentCreate(BaseModel):
    name: str
    code: str
    active: bool = True

class DepartmentUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    active: bool | None = None

class DepartmentOut(BaseModel):
    id: int
    name: str
    code: str
    active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Rank ──

class RankCreate(BaseModel):
    name: str
    code: str
    sort_order: int = 0
    active: bool = True

class RankUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    sort_order: int | None = None
    active: bool | None = None

class RankOut(BaseModel):
    id: int
    name: str
    code: str
    sort_order: int
    active: bool
    model_config = {"from_attributes": True}


# ── Shift ──

class ShiftCreate(BaseModel):
    name: str
    start_time: time
    end_time: time
    late_grace_minutes: int = 10
    early_leave_minutes: int = 0
    active: bool = True

class ShiftUpdate(BaseModel):
    name: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    late_grace_minutes: int | None = None
    early_leave_minutes: int | None = None
    active: bool | None = None

class ShiftOut(BaseModel):
    id: int
    name: str
    start_time: time
    end_time: time
    late_grace_minutes: int
    early_leave_minutes: int
    active: bool
    model_config = {"from_attributes": True}


# ── Holiday ──

class HolidayCreate(BaseModel):
    holiday_date: date
    name: str
    description: str | None = None

class HolidayUpdate(BaseModel):
    holiday_date: date | None = None
    name: str | None = None
    description: str | None = None

class HolidayOut(BaseModel):
    id: int
    holiday_date: date
    name: str
    description: str | None
    model_config = {"from_attributes": True}


# ── Attendance Exception ──

class ExceptionCreate(BaseModel):
    personnel_id: int
    date: date
    exception_type: str  # LEAVE, OSD, MEDICAL, DUTY_REST
    reason: str | None = None
    approved_by: str | None = None
    remarks: str | None = None

class ExceptionUpdate(BaseModel):
    exception_type: str | None = None
    reason: str | None = None
    approved_by: str | None = None
    remarks: str | None = None

class ExceptionOut(BaseModel):
    id: int
    personnel_id: int
    date: date
    exception_type: str
    reason: str | None
    approved_by: str | None
    remarks: str | None
    created_at: datetime
    updated_at: datetime
    personnel_name: str | None = None
    model_config = {"from_attributes": True}
