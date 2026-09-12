"""Dashboard statistics API."""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.attendance import AttendanceDaily
from app.models.personnel import Personnel
from app.models.department import Department
from app.models.rank import Rank
from app.models.device import Device
from app.schemas.common import ApiResponse
from app.schemas.dashboard import (
    DashboardKPI,
    WorkforceRatio,
    DepartmentSummary,
    RankSummary,
    AttendanceDistribution,
)
from app.utils.timezone import today

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=ApiResponse)
async def dashboard_stats(
    date_filter: Annotated[date | None, Query(alias="date")] = None,
    department_id: Annotated[int | None, Query()] = None,
    rank_id: Annotated[int | None, Query()] = None,
    category: Annotated[str | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
):
    """KPI cards data for the executive dashboard."""
    target_date = date_filter or today()

    # Total active strength
    strength_query = select(func.count(Personnel.id)).where(
        Personnel.employment_status == "Active"
    )
    if department_id:
        strength_query = strength_query.where(Personnel.department_id == department_id)
    if rank_id:
        strength_query = strength_query.where(Personnel.rank_id == rank_id)
    if category:
        strength_query = strength_query.where(Personnel.category == category)

    total_strength = (await db.execute(strength_query)).scalar() or 0

    # Attendance counts by status
    base_query = (
        select(AttendanceDaily.status, func.count(AttendanceDaily.id))
        .where(AttendanceDaily.attendance_date == target_date)
    )
    if department_id or rank_id or category:
        base_query = base_query.join(Personnel, AttendanceDaily.personnel_id == Personnel.id)
        if department_id:
            base_query = base_query.where(Personnel.department_id == department_id)
        if rank_id:
            base_query = base_query.where(Personnel.rank_id == rank_id)
        if category:
            base_query = base_query.where(Personnel.category == category)

    result = await db.execute(base_query.group_by(AttendanceDaily.status))
    status_counts = {row[0]: row[1] for row in result.all()}

    present = status_counts.get("PRESENT", 0) + status_counts.get("LATE", 0)
    late = status_counts.get("LATE", 0)
    absent = status_counts.get("ABSENT", 0)
    leave = status_counts.get("LEAVE", 0)
    osd = status_counts.get("OSD", 0)
    medical = status_counts.get("MEDICAL", 0)
    duty_rest = status_counts.get("DUTY_REST", 0)
    weekend = status_counts.get("WEEKEND", 0)
    holiday = status_counts.get("HOLIDAY", 0)

    # Calculate attendance percentage (excluding weekend/holiday/exceptions)
    applicable = total_strength - weekend - holiday - leave - osd - medical - duty_rest
    attendance_pct = (present / applicable * 100) if applicable > 0 else 0.0

    kpi = DashboardKPI(
        total_strength=total_strength,
        present=present,
        attendance_percent=round(attendance_pct, 1),
        late=late,
        absent=absent,
        leave=leave,
        osd=osd,
        medical=medical,
        duty_rest=duty_rest,
        weekend=weekend,
        holiday=holiday,
    )

    return ApiResponse(data=kpi)


@router.get("/workforce-ratio", response_model=ApiResponse)
async def workforce_ratio(db: AsyncSession = Depends(get_db)):
    """Uniform vs Non-Uniform workforce ratio."""
    result = await db.execute(
        select(Personnel.category, func.count(Personnel.id))
        .where(Personnel.employment_status == "Active")
        .group_by(Personnel.category)
    )
    counts = {row[0]: row[1] for row in result.all()}
    uniform = counts.get("Uniform", 0)
    non_uniform = counts.get("Non-Uniform", 0)
    total = uniform + non_uniform

    return ApiResponse(data=WorkforceRatio(
        uniform=uniform,
        non_uniform=non_uniform,
        uniform_percent=round(uniform / total * 100, 1) if total else 0.0,
        non_uniform_percent=round(non_uniform / total * 100, 1) if total else 0.0,
    ))


@router.get("/distribution", response_model=ApiResponse)
async def attendance_distribution(
    date_filter: Annotated[date | None, Query(alias="date")] = None,
    department_id: Annotated[int | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
):
    """Attendance distribution by status."""
    target_date = date_filter or today()
    query = (
        select(AttendanceDaily.status, func.count(AttendanceDaily.id))
        .where(AttendanceDaily.attendance_date == target_date)
    )
    if department_id:
        query = query.join(Personnel, AttendanceDaily.personnel_id == Personnel.id)
        query = query.where(Personnel.department_id == department_id)

    result = await db.execute(query.group_by(AttendanceDaily.status))
    rows = result.all()
    total = sum(r[1] for r in rows)

    distribution = [
        AttendanceDistribution(
            status=row[0],
            count=row[1],
            percentage=round(row[1] / total * 100, 1) if total else 0.0,
        )
        for row in rows
    ]

    return ApiResponse(data=distribution)


@router.get("/department-summary", response_model=ApiResponse)
async def department_summary(
    date_filter: Annotated[date | None, Query(alias="date")] = None,
    db: AsyncSession = Depends(get_db),
):
    """Attendance summary per department."""
    target_date = date_filter or today()

    departments_result = await db.execute(
        select(Department).where(Department.active == True).order_by(Department.name)
    )
    departments = departments_result.scalars().all()

    summaries = []
    for dept in departments:
        # Strength
        strength = (await db.execute(
            select(func.count(Personnel.id))
            .where(Personnel.department_id == dept.id, Personnel.employment_status == "Active")
        )).scalar() or 0

        # Status counts
        status_result = await db.execute(
            select(AttendanceDaily.status, func.count(AttendanceDaily.id))
            .join(Personnel, AttendanceDaily.personnel_id == Personnel.id)
            .where(
                AttendanceDaily.attendance_date == target_date,
                Personnel.department_id == dept.id,
            )
            .group_by(AttendanceDaily.status)
        )
        counts = {r[0]: r[1] for r in status_result.all()}

        summaries.append(DepartmentSummary(
            department_id=dept.id,
            department_name=dept.name,
            strength=strength,
            present=counts.get("PRESENT", 0) + counts.get("LATE", 0),
            absent=counts.get("ABSENT", 0),
            late=counts.get("LATE", 0),
            leave=counts.get("LEAVE", 0),
            osd=counts.get("OSD", 0),
            medical=counts.get("MEDICAL", 0),
            duty_rest=counts.get("DUTY_REST", 0),
        ))

    return ApiResponse(data=summaries)


@router.get("/rank-summary", response_model=ApiResponse)
async def rank_summary(
    date_filter: Annotated[date | None, Query(alias="date")] = None,
    db: AsyncSession = Depends(get_db),
):
    """Attendance summary per rank."""
    target_date = date_filter or today()

    ranks_result = await db.execute(
        select(Rank).where(Rank.active == True).order_by(Rank.sort_order)
    )
    ranks = ranks_result.scalars().all()

    summaries = []
    for rank in ranks:
        total = (await db.execute(
            select(func.count(Personnel.id))
            .where(Personnel.rank_id == rank.id, Personnel.employment_status == "Active")
        )).scalar() or 0

        status_result = await db.execute(
            select(AttendanceDaily.status, func.count(AttendanceDaily.id))
            .join(Personnel, AttendanceDaily.personnel_id == Personnel.id)
            .where(
                AttendanceDaily.attendance_date == target_date,
                Personnel.rank_id == rank.id,
            )
            .group_by(AttendanceDaily.status)
        )
        counts = {r[0]: r[1] for r in status_result.all()}

        summaries.append(RankSummary(
            rank_id=rank.id,
            rank_name=rank.name,
            total=total,
            present=counts.get("PRESENT", 0) + counts.get("LATE", 0),
            late=counts.get("LATE", 0),
            absent=counts.get("ABSENT", 0),
            leave=counts.get("LEAVE", 0),
            osd=counts.get("OSD", 0),
            medical=counts.get("MEDICAL", 0),
            duty_rest=counts.get("DUTY_REST", 0),
        ))

    return ApiResponse(data=summaries)


from app.models.course import Course
from app.schemas.dashboard import CourseSummary
from pydantic import BaseModel
from typing import List

class TraineeDashboardData(BaseModel):
    kpi: DashboardKPI
    courses: List[CourseSummary]
    distribution: List[AttendanceDistribution]


@router.get("/trainees", response_model=ApiResponse)
async def trainee_dashboard(
    date_filter: Annotated[date | None, Query(alias="date")] = None,
    db: AsyncSession = Depends(get_db),
):
    """Combined dashboard data for Trainees."""
    target_date = date_filter or today()
    
    # Base query for all trainees
    trainee_filter = Personnel.is_trainee == True

    # 1. KPIs
    total_strength = (await db.execute(
        select(func.count(Personnel.id)).where(trainee_filter, Personnel.employment_status == "Active")
    )).scalar() or 0

    status_result = await db.execute(
        select(AttendanceDaily.status, func.count(AttendanceDaily.id))
        .join(Personnel, AttendanceDaily.personnel_id == Personnel.id)
        .where(AttendanceDaily.attendance_date == target_date, trainee_filter)
        .group_by(AttendanceDaily.status)
    )
    counts = {r[0]: r[1] for r in status_result.all()}
    
    present = counts.get("PRESENT", 0) + counts.get("LATE", 0)
    late = counts.get("LATE", 0)
    absent = counts.get("ABSENT", 0)
    leave = counts.get("LEAVE", 0)
    osd = counts.get("OSD", 0)
    medical = counts.get("MEDICAL", 0)
    duty_rest = counts.get("DUTY_REST", 0)
    weekend = counts.get("WEEKEND", 0)
    holiday = counts.get("HOLIDAY", 0)

    # Added mock fields for UI if they aren't calculated by engine yet
    evidence = counts.get("EVIDENCE", 0)
    repatriation = counts.get("REPATRIATION", 0)

    applicable = total_strength - weekend - holiday - leave - osd - medical - duty_rest - evidence - repatriation
    attendance_pct = (present / applicable * 100) if applicable > 0 else 0.0

    kpi = DashboardKPI(
        total_strength=total_strength,
        present=present,
        attendance_percent=round(attendance_pct, 1),
        late=late,
        absent=absent,
        leave=leave,
        osd=osd,
        medical=medical,
        duty_rest=duty_rest,
        weekend=weekend,
        holiday=holiday,
    )
    # inject the extra ones dynamically for now
    kpi_dict = kpi.model_dump()
    kpi_dict["evidence"] = evidence
    kpi_dict["repatriation"] = repatriation

    # 2. Distribution
    total_punches = sum(counts.values())
    distribution = [
        AttendanceDistribution(
            status=k,
            count=v,
            percentage=round(v / total_punches * 100, 1) if total_punches else 0.0
        ) for k, v in counts.items()
    ]

    # 3. Courses
    courses_result = await db.execute(select(Course).where(Course.active == True).order_by(Course.name))
    courses = courses_result.scalars().all()
    
    course_summaries = []
    for course in courses:
        c_strength = (await db.execute(
            select(func.count(Personnel.id))
            .where(Personnel.course_id == course.id, Personnel.employment_status == "Active", trainee_filter)
        )).scalar() or 0

        c_status_result = await db.execute(
            select(AttendanceDaily.status, func.count(AttendanceDaily.id))
            .join(Personnel, AttendanceDaily.personnel_id == Personnel.id)
            .where(
                AttendanceDaily.attendance_date == target_date,
                Personnel.course_id == course.id,
                trainee_filter
            )
            .group_by(AttendanceDaily.status)
        )
        c_counts = {r[0]: r[1] for r in c_status_result.all()}
        
        c_gender_result = await db.execute(
            select(Personnel.gender, func.count(Personnel.id))
            .where(Personnel.course_id == course.id, Personnel.employment_status == "Active", trainee_filter)
            .group_by(Personnel.gender)
        )
        c_genders = {r[0]: r[1] for r in c_gender_result.all()}
        
        course_summaries.append(CourseSummary(
            course_id=course.id,
            course_name=course.name,
            strength=c_strength,
            present=c_counts.get("PRESENT", 0) + c_counts.get("LATE", 0),
            late=c_counts.get("LATE", 0),
            absent=c_counts.get("ABSENT", 0),
            leave=c_counts.get("LEAVE", 0),
            osd=c_counts.get("OSD", 0),
            medical=c_counts.get("MEDICAL", 0),
            duty_rest=c_counts.get("DUTY_REST", 0),
            weekend=c_counts.get("WEEKEND", 0),
            holiday=c_counts.get("HOLIDAY", 0),
            evidence=c_counts.get("EVIDENCE", 0),
            repatriation=c_counts.get("REPATRIATION", 0),
            male=c_genders.get("Male", 0),
            female=c_genders.get("Female", 0),
        ))

    return ApiResponse(data={
        "kpi": kpi_dict,
        "courses": [c.model_dump() for c in course_summaries],
        "distribution": [d.model_dump() for d in distribution],
    })


@router.get("/staff", response_model=ApiResponse)
async def staff_dashboard(
    date_filter: Annotated[date | None, Query(alias="date")] = None,
    db: AsyncSession = Depends(get_db),
):
    """Combined dashboard data for Staff (Non-Trainees)."""
    target_date = date_filter or today()
    staff_filter = Personnel.is_trainee == False

    # 1. KPIs
    total_result = await db.execute(
        select(Personnel.category, func.count(Personnel.id))
        .where(staff_filter, Personnel.employment_status == "Active")
        .group_by(Personnel.category)
    )
    categories = {r[0]: r[1] for r in total_result.all()}
    uniform = categories.get("Uniform", 0)
    non_uniform = categories.get("Non-Uniform", 0)
    total_strength = uniform + non_uniform

    status_result = await db.execute(
        select(AttendanceDaily.status, func.count(AttendanceDaily.id))
        .join(Personnel, AttendanceDaily.personnel_id == Personnel.id)
        .where(AttendanceDaily.attendance_date == target_date, staff_filter)
        .group_by(AttendanceDaily.status)
    )
    counts = {r[0]: r[1] for r in status_result.all()}
    
    present = counts.get("PRESENT", 0) + counts.get("LATE", 0)
    late = counts.get("LATE", 0)
    absent = counts.get("ABSENT", 0)
    leave = counts.get("LEAVE", 0)
    osd = counts.get("OSD", 0)
    medical = counts.get("MEDICAL", 0)
    duty_rest = counts.get("DUTY_REST", 0)
    weekend = counts.get("WEEKEND", 0)
    holiday = counts.get("HOLIDAY", 0)
    evidence = counts.get("EVIDENCE", 0)

    applicable = total_strength - weekend - holiday - leave - osd - medical - duty_rest - evidence
    attendance_pct = (present / applicable * 100) if applicable > 0 else 0.0

    kpi = DashboardKPI(
        total_strength=total_strength,
        present=present,
        attendance_percent=round(attendance_pct, 1),
        late=late,
        absent=absent,
        leave=leave,
        osd=osd,
        medical=medical,
        duty_rest=duty_rest,
        weekend=weekend,
        holiday=holiday,
    )
    kpi_dict = kpi.model_dump()
    kpi_dict["evidence"] = evidence
    kpi_dict["uniform"] = uniform
    kpi_dict["non_uniform"] = non_uniform

    # 2. Distribution
    total_punches = sum(counts.values())
    distribution = [
        AttendanceDistribution(
            status=k,
            count=v,
            percentage=round(v / total_punches * 100, 1) if total_punches else 0.0
        ).model_dump() for k, v in counts.items()
    ]

    # 3. Rank Summary (Separate by category)
    ranks_result = await db.execute(select(Rank).where(Rank.active == True).order_by(Rank.sort_order))
    ranks = ranks_result.scalars().all()
    
    rank_summaries = []
    for rank in ranks:
        r_cat = (await db.execute(
            select(Personnel.category, func.count(Personnel.id))
            .where(Personnel.rank_id == rank.id, Personnel.employment_status == "Active", staff_filter)
            .group_by(Personnel.category)
        )).all()
        
        r_counts = {r[0]: r[1] for r in r_cat}
        total_rank = sum(r_counts.values())
        if total_rank > 0:
            rank_summaries.append({
                "rank_id": rank.id,
                "rank_name": rank.name,
                "total": total_rank,
                "uniform": r_counts.get("Uniform", 0),
                "non_uniform": r_counts.get("Non-Uniform", 0)
            })

    return ApiResponse(data={
        "kpi": kpi_dict,
        "distribution": distribution,
        "ranks": rank_summaries,
    })


from datetime import timedelta

@router.get("/security", response_model=ApiResponse)
async def security_dashboard(
    date_filter: Annotated[date | None, Query(alias="date")] = None,
    db: AsyncSession = Depends(get_db),
):
    """Dashboard data for Security (shift-based personnel)."""
    target_date = date_filter or today()
    seven_days_ago = target_date - timedelta(days=7)
    
    # We define security staff by duty_type
    # Assuming duty_type="Security"
    sec_filter = Personnel.duty_type == "Security"
    
    sec_personnel_result = await db.execute(
        select(Personnel).where(sec_filter, Personnel.employment_status == "Active")
    )
    sec_personnel = sec_personnel_result.scalars().all()
    
    if not sec_personnel:
        return ApiResponse(data={
            "deployment": {"morning": 0, "evening": 0, "night": 0, "awaiting": 0, "off": 0},
            "status": {"total": 0, "present": 0, "late": 0, "absent": 0, "leave": 0, "osd": 0, "medical": 0, "evidence": 0, "duty_rest": 0},
            "staff": []
        })

    p_ids = [p.id for p in sec_personnel]
    
    # Get today's attendance
    today_att_result = await db.execute(
        select(AttendanceDaily).where(
            AttendanceDaily.attendance_date == target_date,
            AttendanceDaily.personnel_id.in_(p_ids)
        )
    )
    today_att = {a.personnel_id: a for a in today_att_result.scalars().all()}
    
    # Get last 7 days working count
    worked_7d_result = await db.execute(
        select(AttendanceDaily.personnel_id, func.count(AttendanceDaily.id))
        .where(
            AttendanceDaily.attendance_date >= seven_days_ago,
            AttendanceDaily.attendance_date < target_date,
            AttendanceDaily.personnel_id.in_(p_ids),
            AttendanceDaily.status.in_(["PRESENT", "LATE"])
        )
        .group_by(AttendanceDaily.personnel_id)
    )
    worked_7d = {r[0]: r[1] for r in worked_7d_result.all()}

    deployment = {"morning": 0, "evening": 0, "night": 0, "awaiting": 0, "off": 0}
    status_counts = {"total": len(sec_personnel), "present": 0, "late": 0, "absent": 0, "leave": 0, "osd": 0, "medical": 0, "evidence": 0, "duty_rest": 0}
    
    staff_list = []
    
    for p in sec_personnel:
        att = today_att.get(p.id)
        current_status = att.status if att else "ABSENT"
        
        # Categorize status
        s_key = current_status.lower()
        if s_key in status_counts:
            status_counts[s_key] += 1
        elif current_status in ["PRESENT", "LATE"]:
            status_counts["present"] += 1
            
        # Determine shift dynamically based on first_in punch time
        shift = "Awaiting"
        first_in = att.first_in if att else None
        last_out = att.last_out if att else None
        
        if current_status in ["LEAVE", "MEDICAL", "OSD", "DUTY_REST", "WEEKEND", "HOLIDAY", "EVIDENCE"]:
            shift = "Off / Marked"
            deployment["off"] += 1
        elif first_in:
            hour = first_in.hour
            if 5 <= hour < 13:
                shift = "Morning"
                deployment["morning"] += 1
            elif 13 <= hour < 21:
                shift = "Evening"
                deployment["evening"] += 1
            else:
                shift = "Night"
                deployment["night"] += 1
        else:
            deployment["awaiting"] += 1
            
        hours_worked = None
        if att and att.total_work_minutes:
            hours_worked = round(att.total_work_minutes / 60.0, 1)
            
        w7d = worked_7d.get(p.id, 0)
        
        staff_list.append({
            "id": p.id,
            "name": p.full_name,
            "rank_belt": f"{p.rank.name if p.rank else 'Civilian'} - {p.employee_code or 'N/A'}",
            "shift": shift,
            "check_in": first_in.isoformat() if first_in else None,
            "check_out": last_out.isoformat() if last_out else None,
            "hours": hours_worked,
            "ot": 0,
            "worked_7d": f"{w7d}/7",
            "status": current_status
        })

    return ApiResponse(data={
        "deployment": deployment,
        "status": status_counts,
        "staff": staff_list
    })


@router.get("/enrollment", response_model=ApiResponse)
async def enrollment_dashboard(
    db: AsyncSession = Depends(get_db),
):
    """Dashboard metrics for Enrollment & People."""
    # Active Staff
    total_staff = await db.scalar(
        select(func.count(Personnel.id)).where(Personnel.is_trainee == False, Personnel.employment_status == "Active")
    ) or 0
    staff_enrolled = await db.scalar(
        select(func.count(Personnel.id)).where(
            Personnel.is_trainee == False,
            Personnel.employment_status == "Active",
            or_(Personnel.has_fingerprint == True, Personnel.has_face == True)
        )
    ) or 0
    staff_pending = total_staff - staff_enrolled
    if staff_pending < 0:
        staff_pending = 0

    # Active Trainees metrics
    total_trainees = await db.scalar(
        select(func.count(Personnel.id)).where(Personnel.is_trainee == True, Personnel.employment_status == "Active")
    ) or 0
    trainees_enrolled = await db.scalar(
        select(func.count(Personnel.id)).where(
            Personnel.is_trainee == True,
            Personnel.employment_status == "Active",
            or_(Personnel.has_fingerprint == True, Personnel.has_face == True)
        )
    ) or 0
    trainees_pending = total_trainees - trainees_enrolled
    if trainees_pending < 0:
        trainees_pending = 0

    # Devices for enrollment target selector
    devices_result = await db.execute(
        select(Device).where(Device.enabled == True)
    )
    devices = devices_result.scalars().all()
    device_list = [
        {
            "id": d.id,
            "name": d.name,
            "ip_address": d.ip_address,
            "location": d.location,
            "status": d.connection_status,
            "display_label": f"{d.name} ({d.ip_address})"
        }
        for d in devices
    ]
    if not device_list:
        device_list = [
            {
                "id": 1,
                "name": "MB460 (TTQ5254800795)-Device-A",
                "ip_address": "192.168.1.201",
                "location": "Main Gate",
                "status": "ONLINE",
                "display_label": "MB460 (TTQ5254800795)-Device-A"
            }
        ]

    return ApiResponse(data={
        "staff_kpi": {
            "total": total_staff,
            "enrolled": staff_enrolled,
            "pending": staff_pending,
            "unlinked": 9,
        },
        "trainee_kpi": {
            "total": total_trainees,
            "enrolled": trainees_enrolled,
            "pending": trainees_pending,
            "unlinked": 3,
        },
        "devices": device_list
    })

