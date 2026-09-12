"""Personnel schemas."""

from __future__ import annotations

from datetime import datetime, date

from pydantic import BaseModel


class PersonnelCreate(BaseModel):
    biometric_user_id: str
    employee_code: str | None = None
    full_name: str
    rank_id: int | None = None
    designation: str | None = None
    department_id: int | None = None
    category: str = "Uniform"
    duty_type: str | None = None
    shift_id: int | None = None
    sanctioned_status: str | None = None
    employment_status: str = "Active"
    photo_path: str | None = None
    is_trainee: bool = False
    course_id: int | None = None
    gender: str = "Male"
    cnic: str | None = None
    father_name: str | None = None
    dob: date | None = None
    has_fingerprint: bool = False
    has_face: bool = False


class PersonnelUpdate(BaseModel):
    employee_code: str | None = None
    full_name: str | None = None
    rank_id: int | None = None
    designation: str | None = None
    department_id: int | None = None
    category: str | None = None
    duty_type: str | None = None
    shift_id: int | None = None
    sanctioned_status: str | None = None
    employment_status: str | None = None
    cnic: str | None = None
    father_name: str | None = None
    dob: date | None = None
    has_fingerprint: bool | None = None
    has_face: bool | None = None


class PersonnelOut(BaseModel):
    id: int
    biometric_user_id: str
    employee_code: str | None
    full_name: str
    rank_id: int | None
    designation: str | None
    department_id: int | None
    category: str
    duty_type: str | None
    shift_id: int | None
    sanctioned_status: str | None
    employment_status: str
    is_trainee: bool = False
    course_id: int | None = None
    gender: str = "Male"
    cnic: str | None = None
    father_name: str | None = None
    dob: date | None = None
    has_fingerprint: bool = False
    has_face: bool = False
    created_at: datetime
    updated_at: datetime

    # Resolved names
    department_name: str | None = None
    rank_name: str | None = None
    shift_name: str | None = None
    
    # Optional attendance data
    attendance_today: dict | None = None

    model_config = {"from_attributes": True}
