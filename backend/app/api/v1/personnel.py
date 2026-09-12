"""Personnel management API endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.personnel import Personnel
from app.schemas.common import ApiResponse, PaginatedResponse, PaginationMeta
from app.schemas.personnel import PersonnelCreate, PersonnelOut, PersonnelUpdate

router = APIRouter(prefix="/personnel", tags=["personnel"])


def _to_out(p: Personnel) -> PersonnelOut:
    """Convert Personnel ORM to output schema with resolved names."""
    dept_name = None
    rank_name = None
    shift_name = None
    try:
        dept_name = p.department.name if p.department else None
    except Exception:
        pass
    try:
        rank_name = p.rank.name if p.rank else None
    except Exception:
        pass
    try:
        shift_name = p.shift.name if p.shift else None
    except Exception:
        pass

    if not rank_name:
        rank_name = p.designation or ("Trainee" if p.is_trainee else None)

    return PersonnelOut(
        id=p.id,
        biometric_user_id=p.biometric_user_id,
        employee_code=p.employee_code,
        full_name=p.full_name,
        rank_id=p.rank_id,
        designation=p.designation,
        department_id=p.department_id,
        category=p.category,
        duty_type=p.duty_type,
        shift_id=p.shift_id,
        sanctioned_status=p.sanctioned_status,
        employment_status=p.employment_status,
        is_trainee=p.is_trainee,
        course_id=p.course_id,
        gender=p.gender,
        cnic=p.cnic,
        father_name=p.father_name,
        dob=p.dob,
        has_fingerprint=p.has_fingerprint,
        has_face=p.has_face,
        created_at=p.created_at,
        updated_at=p.updated_at,
        department_name=dept_name,
        rank_name=rank_name,
        shift_name=shift_name,
    )


@router.get("", response_model=PaginatedResponse)
async def list_personnel(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
    search: Annotated[str | None, Query()] = None,
    department_id: Annotated[int | None, Query()] = None,
    rank_id: Annotated[int | None, Query()] = None,
    category: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    is_trainee: Annotated[bool | None, Query()] = None,
    include_attendance: Annotated[bool, Query()] = False,
    db: AsyncSession = Depends(get_db),
):
    """List personnel with search and filters."""
    query = select(Personnel).options(selectinload(Personnel.department), selectinload(Personnel.rank))
    count_query = select(func.count(Personnel.id))

    # Filters
    if search:
        search_filter = or_(
            Personnel.full_name.ilike(f"%{search}%"),
            Personnel.employee_code.ilike(f"%{search}%"),
            Personnel.biometric_user_id.ilike(f"%{search}%"),
            Personnel.cnic.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if department_id:
        query = query.where(Personnel.department_id == department_id)
        count_query = count_query.where(Personnel.department_id == department_id)

    if rank_id:
        query = query.where(Personnel.rank_id == rank_id)
        count_query = count_query.where(Personnel.rank_id == rank_id)

    if category:
        query = query.where(Personnel.category == category)
        count_query = count_query.where(Personnel.category == category)

    if status:
        query = query.where(Personnel.employment_status == status)
        count_query = count_query.where(Personnel.employment_status == status)

    if is_trainee is not None:
        query = query.where(Personnel.is_trainee == is_trainee)
        count_query = count_query.where(Personnel.is_trainee == is_trainee)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(Personnel.full_name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    personnel = result.scalars().all()
    
    out_data = []
    
    if include_attendance and personnel:
        from app.models.attendance import AttendanceDaily
        from app.utils.timezone import today
        
        t = today()
        p_ids = [p.id for p in personnel]
        att_result = await db.execute(
            select(AttendanceDaily).where(
                AttendanceDaily.personnel_id.in_(p_ids),
                AttendanceDaily.attendance_date == t
            )
        )
        att_records = {att.personnel_id: att for att in att_result.scalars().all()}
        
        for p in personnel:
            out = _to_out(p)
            att = att_records.get(p.id)
            if att:
                out.attendance_today = {
                    "status": att.status,
                    "first_in": att.first_in.isoformat() if att.first_in else None,
                    "last_out": att.last_out.isoformat() if att.last_out else None,
                    "total_work_minutes": att.total_work_minutes
                }
            else:
                out.attendance_today = {"status": "ABSENT"}
            out_data.append(out)
    else:
        out_data = [_to_out(p) for p in personnel]

    return PaginatedResponse(
        data=out_data,
        pagination=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@router.get("/{person_id}", response_model=ApiResponse)
async def get_personnel(person_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Personnel).where(Personnel.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Personnel not found")
    return ApiResponse(data=_to_out(person))


@router.post("", response_model=ApiResponse, status_code=201)
async def create_personnel(payload: PersonnelCreate, db: AsyncSession = Depends(get_db)):
    # Prevent duplicate biometric_user_id
    existing = await db.execute(
        select(Personnel).where(Personnel.biometric_user_id == payload.biometric_user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Biometric user ID already exists")

    person = Personnel(**payload.model_dump())
    db.add(person)
    await db.flush()

    res = await db.execute(
        select(Personnel)
        .options(selectinload(Personnel.department), selectinload(Personnel.rank))
        .where(Personnel.id == person.id)
    )
    person = res.scalar_one()
    return ApiResponse(data=_to_out(person), message="Personnel created")


@router.put("/{person_id}", response_model=ApiResponse)
async def update_personnel(
    person_id: int, payload: PersonnelUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Personnel).where(Personnel.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Personnel not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(person, key, value)

    await db.flush()
    return ApiResponse(data=_to_out(person), message="Personnel updated")


@router.patch("/{person_id}/status", response_model=ApiResponse)
async def update_personnel_status(
    person_id: int,
    status: Annotated[str, Query()],
    db: AsyncSession = Depends(get_db),
):
    """Activate/deactivate personnel."""
    valid = {"Active", "Inactive", "Suspended", "Retired"}
    if status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")

    result = await db.execute(select(Personnel).where(Personnel.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Personnel not found")

    person.employment_status = status
    return ApiResponse(message=f"Status updated to {status}")


@router.post("/{person_id}/enroll-biometric", response_model=ApiResponse)
async def enroll_biometric(
    person_id: int,
    biometric_type: Annotated[str, Query(pattern="^(finger|face)$")],
    device_id: Annotated[int | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
):
    """Enroll fingerprint or face for a personnel."""
    result = await db.execute(select(Personnel).where(Personnel.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Personnel not found")

    if biometric_type == "finger":
        person.has_fingerprint = True
    elif biometric_type == "face":
        person.has_face = True

    await db.flush()
    return ApiResponse(
        data=_to_out(person),
        message=f"{biometric_type.capitalize()} enrollment registered successfully on device"
    )

