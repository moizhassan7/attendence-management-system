"""Master data CRUD — Departments, Ranks, Shifts, Holidays."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.department import Department
from app.models.rank import Rank
from app.models.shift import Shift
from app.models.holiday import Holiday
from app.schemas.common import ApiResponse, PaginatedResponse, PaginationMeta
from app.schemas.master_data import (
    DepartmentCreate, DepartmentOut, DepartmentUpdate,
    RankCreate, RankOut, RankUpdate,
    ShiftCreate, ShiftOut, ShiftUpdate,
    HolidayCreate, HolidayOut, HolidayUpdate,
)

# ════════════════════════════════════════════════════════════════
# Departments
# ════════════════════════════════════════════════════════════════

dept_router = APIRouter(prefix="/departments", tags=["departments"])


@dept_router.get("", response_model=PaginatedResponse)
async def list_departments(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count(Department.id)))).scalar() or 0
    result = await db.execute(
        select(Department).order_by(Department.name).offset((page - 1) * page_size).limit(page_size)
    )
    return PaginatedResponse(
        data=[DepartmentOut.model_validate(d) for d in result.scalars().all()],
        pagination=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@dept_router.get("/{dept_id}", response_model=ApiResponse)
async def get_department(dept_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return ApiResponse(data=DepartmentOut.model_validate(dept))


@dept_router.post("", response_model=ApiResponse, status_code=201)
async def create_department(payload: DepartmentCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Department).where(Department.code == payload.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Department code already exists")
    dept = Department(**payload.model_dump())
    db.add(dept)
    await db.flush()
    return ApiResponse(data=DepartmentOut.model_validate(dept), message="Department created")


@dept_router.put("/{dept_id}", response_model=ApiResponse)
async def update_department(dept_id: int, payload: DepartmentUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(dept, k, v)
    await db.flush()
    return ApiResponse(data=DepartmentOut.model_validate(dept), message="Department updated")


@dept_router.delete("/{dept_id}", response_model=ApiResponse)
async def delete_department(dept_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    await db.delete(dept)
    return ApiResponse(message="Department deleted")


# ════════════════════════════════════════════════════════════════
# Ranks
# ════════════════════════════════════════════════════════════════

rank_router = APIRouter(prefix="/ranks", tags=["ranks"])


@rank_router.get("", response_model=PaginatedResponse)
async def list_ranks(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count(Rank.id)))).scalar() or 0
    result = await db.execute(
        select(Rank).order_by(Rank.sort_order).offset((page - 1) * page_size).limit(page_size)
    )
    return PaginatedResponse(
        data=[RankOut.model_validate(r) for r in result.scalars().all()],
        pagination=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@rank_router.get("/{rank_id}", response_model=ApiResponse)
async def get_rank(rank_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Rank).where(Rank.id == rank_id))
    rank = result.scalar_one_or_none()
    if not rank:
        raise HTTPException(status_code=404, detail="Rank not found")
    return ApiResponse(data=RankOut.model_validate(rank))


@rank_router.post("", response_model=ApiResponse, status_code=201)
async def create_rank(payload: RankCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Rank).where(Rank.code == payload.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Rank code already exists")
    rank = Rank(**payload.model_dump())
    db.add(rank)
    await db.flush()
    return ApiResponse(data=RankOut.model_validate(rank), message="Rank created")


@rank_router.put("/{rank_id}", response_model=ApiResponse)
async def update_rank(rank_id: int, payload: RankUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Rank).where(Rank.id == rank_id))
    rank = result.scalar_one_or_none()
    if not rank:
        raise HTTPException(status_code=404, detail="Rank not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(rank, k, v)
    await db.flush()
    return ApiResponse(data=RankOut.model_validate(rank), message="Rank updated")


@rank_router.delete("/{rank_id}", response_model=ApiResponse)
async def delete_rank(rank_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Rank).where(Rank.id == rank_id))
    rank = result.scalar_one_or_none()
    if not rank:
        raise HTTPException(status_code=404, detail="Rank not found")
    await db.delete(rank)
    return ApiResponse(message="Rank deleted")


# ════════════════════════════════════════════════════════════════
# Shifts
# ════════════════════════════════════════════════════════════════

shift_router = APIRouter(prefix="/shifts", tags=["shifts"])


@shift_router.get("", response_model=PaginatedResponse)
async def list_shifts(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count(Shift.id)))).scalar() or 0
    result = await db.execute(
        select(Shift).order_by(Shift.name).offset((page - 1) * page_size).limit(page_size)
    )
    return PaginatedResponse(
        data=[ShiftOut.model_validate(s) for s in result.scalars().all()],
        pagination=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@shift_router.post("", response_model=ApiResponse, status_code=201)
async def create_shift(payload: ShiftCreate, db: AsyncSession = Depends(get_db)):
    shift = Shift(**payload.model_dump())
    db.add(shift)
    await db.flush()
    return ApiResponse(data=ShiftOut.model_validate(shift), message="Shift created")


@shift_router.put("/{shift_id}", response_model=ApiResponse)
async def update_shift(shift_id: int, payload: ShiftUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Shift).where(Shift.id == shift_id))
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(shift, k, v)
    await db.flush()
    return ApiResponse(data=ShiftOut.model_validate(shift), message="Shift updated")


@shift_router.delete("/{shift_id}", response_model=ApiResponse)
async def delete_shift(shift_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Shift).where(Shift.id == shift_id))
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    await db.delete(shift)
    return ApiResponse(message="Shift deleted")


# ════════════════════════════════════════════════════════════════
# Holidays
# ════════════════════════════════════════════════════════════════

holiday_router = APIRouter(prefix="/holidays", tags=["holidays"])


@holiday_router.get("", response_model=PaginatedResponse)
async def list_holidays(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count(Holiday.id)))).scalar() or 0
    result = await db.execute(
        select(Holiday).order_by(Holiday.holiday_date.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    return PaginatedResponse(
        data=[HolidayOut.model_validate(h) for h in result.scalars().all()],
        pagination=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@holiday_router.post("", response_model=ApiResponse, status_code=201)
async def create_holiday(payload: HolidayCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Holiday).where(Holiday.holiday_date == payload.holiday_date))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Holiday already exists for this date")
    holiday = Holiday(**payload.model_dump())
    db.add(holiday)
    await db.flush()
    return ApiResponse(data=HolidayOut.model_validate(holiday), message="Holiday created")


@holiday_router.put("/{holiday_id}", response_model=ApiResponse)
async def update_holiday(holiday_id: int, payload: HolidayUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Holiday).where(Holiday.id == holiday_id))
    holiday = result.scalar_one_or_none()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(holiday, k, v)
    await db.flush()
    return ApiResponse(data=HolidayOut.model_validate(holiday), message="Holiday updated")


@holiday_router.delete("/{holiday_id}", response_model=ApiResponse)
async def delete_holiday(holiday_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Holiday).where(Holiday.id == holiday_id))
    holiday = result.scalar_one_or_none()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    await db.delete(holiday)
    return ApiResponse(message="Holiday deleted")


# ════════════════════════════════════════════════════════════════
# Courses (Trainees)
# ════════════════════════════════════════════════════════════════
from app.models.course import Course
from app.schemas.course import CourseCreate, CourseResponse as CourseOut, CourseUpdate

course_router = APIRouter(prefix="/courses", tags=["courses"])

@course_router.get("", response_model=PaginatedResponse)
async def list_courses(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count(Course.id)))).scalar() or 0
    result = await db.execute(
        select(Course).order_by(Course.name).offset((page - 1) * page_size).limit(page_size)
    )
    return PaginatedResponse(
        data=[CourseOut.model_validate(c) for c in result.scalars().all()],
        pagination=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@course_router.post("", response_model=ApiResponse, status_code=201)
async def create_course(payload: CourseCreate, db: AsyncSession = Depends(get_db)):
    course = Course(**payload.model_dump())
    db.add(course)
    await db.flush()
    return ApiResponse(data=CourseOut.model_validate(course), message="Course created")


@course_router.put("/{course_id}", response_model=ApiResponse)
async def update_course(course_id: int, payload: CourseUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(course, k, v)
    await db.flush()
    return ApiResponse(data=CourseOut.model_validate(course), message="Course updated")


@course_router.delete("/{course_id}", response_model=ApiResponse)
async def delete_course(course_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    await db.delete(course)
    return ApiResponse(message="Course deleted")
