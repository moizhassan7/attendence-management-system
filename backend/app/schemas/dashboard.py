"""Dashboard-specific schemas."""

from __future__ import annotations

from pydantic import BaseModel


class DashboardKPI(BaseModel):
    total_strength: int = 0
    present: int = 0
    attendance_percent: float = 0.0
    late: int = 0
    absent: int = 0
    leave: int = 0
    osd: int = 0
    medical: int = 0
    duty_rest: int = 0
    weekend: int = 0
    holiday: int = 0


class WorkforceRatio(BaseModel):
    uniform: int = 0
    non_uniform: int = 0
    uniform_percent: float = 0.0
    non_uniform_percent: float = 0.0


class DepartmentSummary(BaseModel):
    department_id: int
    department_name: str
    strength: int = 0
    present: int = 0
    absent: int = 0
    late: int = 0
    leave: int = 0
    osd: int = 0
    medical: int = 0
    duty_rest: int = 0


class RankSummary(BaseModel):
    rank_id: int
    rank_name: str
    total: int = 0
    present: int = 0
    late: int = 0
    absent: int = 0
    leave: int = 0
    osd: int = 0
    medical: int = 0
    duty_rest: int = 0


class CourseSummary(BaseModel):
    course_id: int
    course_name: str
    strength: int = 0
    present: int = 0
    absent: int = 0
    late: int = 0
    leave: int = 0
    osd: int = 0
    medical: int = 0
    duty_rest: int = 0
    weekend: int = 0
    holiday: int = 0
    evidence: int = 0
    repatriation: int = 0
    male: int = 0
    female: int = 0


class AttendanceDistribution(BaseModel):
    status: str
    count: int
    percentage: float = 0.0
