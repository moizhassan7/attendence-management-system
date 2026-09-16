"""Attendance processing engine."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import AttendanceDaily, AttendancePunch
from app.models.exception import AttendanceException
from app.models.holiday import Holiday
from app.models.personnel import Personnel
from app.models.shift import Shift
from app.utils.timezone import get_tz, now, to_local

logger = logging.getLogger(__name__)

SECURITY_SHIFT_KEYWORDS = ("morning", "evening", "night")


def is_security_staff(duty_type: str | None) -> bool:
    return (duty_type or "").strip().lower() == "security"


def status_for_security_without_punch(exception_type: str | None) -> str:
    """No biometric punch: duty rest unless staff marked an exception (including ABSENT)."""
    if exception_type:
        return exception_type.upper()
    return "DUTY_REST"


def infer_shift_for_punch(punch_local: datetime, shifts: Sequence) -> Shift | None:
    """Pick the shift that started most recently before the punch (rotation, not assigned roster)."""
    named = [s for s in shifts if any(k in (s.name or "").lower() for k in SECURITY_SHIFT_KEYWORDS)]
    pool = named or list(shifts)
    if not pool:
        return None
    punch_m = punch_local.hour * 60 + punch_local.minute
    best = None
    best_delta = 24 * 60
    for s in pool:
        start = s.start_time
        start_m = start.hour * 60 + start.minute
        delta = (punch_m - start_m) % (24 * 60)
        if delta < best_delta:
            best_delta = delta
            best = s
    return best


class AttendanceService:
    """Core logic for calculating daily attendance from raw punches."""

    def __init__(self) -> None:
        self._active_shifts: list[Shift] | None = None

    async def _get_active_shifts(self, db: AsyncSession) -> list[Shift]:
        if self._active_shifts is None:
            self._active_shifts = list((await db.execute(select(Shift).where(Shift.active == True))).scalars().all())
        return self._active_shifts

    async def process_daily_attendance(
        self, db: AsyncSession, target_date: date, personnel_id: int | None = None
    ) -> int:
        """Process attendance for a given date. Returns number of records processed."""
        self._active_shifts = None
        personnel_query = (
            select(Personnel)
            .options(selectinload(Personnel.shift))
            .where(Personnel.employment_status == "Active")
        )
        if personnel_id:
            personnel_query = personnel_query.where(Personnel.id == personnel_id)

        result = await db.execute(personnel_query)
        personnel_list = result.scalars().all()

        processed_count = 0
        for p in personnel_list:
            await self._process_single(db, p, target_date)
            processed_count += 1

        return processed_count

    async def _process_single(
        self, db: AsyncSession, personnel: Personnel, target_date: date
    ) -> None:
        """Process attendance for one person on one day."""
        # 1. Check if weekend (e.g. Sat/Sun)
        # We will handle weekends dynamically inside the default block based on duty_type

        # 2. Check if holiday
        holiday = (await db.execute(
            select(Holiday).where(Holiday.holiday_date == target_date)
        )).scalar_one_or_none()
        is_holiday = holiday is not None

        # 3. Check sanctioned exception
        exc = (await db.execute(
            select(AttendanceException).where(
                AttendanceException.personnel_id == personnel.id,
                AttendanceException.date == target_date,
            )
        )).scalar_one_or_none()

        # 4. Get Punches for the day
        from datetime import time
        tz = get_tz()
        t0 = datetime.combine(target_date, time.min, tzinfo=tz)
        t1 = datetime.combine(target_date, time.max, tzinfo=tz)
        punches = (await db.execute(
            select(AttendancePunch).where(
                AttendancePunch.biometric_user_id == personnel.biometric_user_id,
                AttendancePunch.punch_time >= t0,
                AttendancePunch.punch_time <= t1,
            ).order_by(AttendancePunch.punch_time)
        )).scalars().all()

        first_in: datetime | None = None
        last_out: datetime | None = None
        total_minutes = 0.0

        if punches:
            first_in = punches[0].punch_time
            last_out = punches[-1].punch_time if len(punches) > 1 else None

            if first_in and last_out and first_in != last_out:
                diff = last_out - first_in
                total_minutes = diff.total_seconds() / 60.0

        # 5. Determine Status
        status = "ABSENT"
        late_minutes = 0
        overtime_minutes = 0
        security = is_security_staff(personnel.duty_type)

        if first_in:
            first_in_local = to_local(first_in)
            if security:
                # Punch counts as present on whatever rotation they actually worked.
                status = "PRESENT"
                all_shifts = await self._get_active_shifts(db)
                shift = infer_shift_for_punch(first_in_local, all_shifts) if first_in_local else None
            else:
                shift = personnel.shift
                if not shift:
                    shift = (await db.execute(select(Shift).limit(1))).scalar_one_or_none()
                status = "PRESENT"

            if shift and not security:
                expected_start = datetime.combine(target_date, shift.start_time, tzinfo=tz)
                grace_period = timedelta(minutes=shift.late_grace_minutes if shift.late_grace_minutes is not None else 10)

                if first_in_local and first_in_local > expected_start + grace_period:
                    status = "LATE"
                    late_delta = first_in_local - expected_start
                    late_minutes = max(0, int(late_delta.total_seconds() / 60))

                if last_out:
                    last_out_local = to_local(last_out)
                    expected_end = datetime.combine(target_date, shift.end_time, tzinfo=tz)
                    if last_out_local and last_out_local > expected_end:
                        ot_delta = last_out_local - expected_end
                        overtime_minutes = max(0, int(ot_delta.total_seconds() / 60))
        else:
            if security:
                status = status_for_security_without_punch(exc.exception_type if exc else None)
            elif exc:
                status = exc.exception_type
            elif is_holiday:
                status = "HOLIDAY"
            else:
                shift = personnel.shift
                current_time = now().time()
                is_today = target_date == now().date()

                if target_date.weekday() == 6:
                    status = "WEEKEND"
                elif shift and is_today and current_time < shift.start_time:
                    status = "AWAITING"
                else:
                    status = "ABSENT"

        # 6. Upsert Daily Record
        existing_daily = (await db.execute(
            select(AttendanceDaily).where(
                AttendanceDaily.personnel_id == personnel.id,
                AttendanceDaily.attendance_date == target_date
            )
        )).scalar_one_or_none()

        if existing_daily:
            existing_daily.first_in = first_in
            existing_daily.last_out = last_out
            existing_daily.total_work_minutes = total_minutes
            existing_daily.status = status
            existing_daily.late_minutes = late_minutes
            existing_daily.overtime_minutes = overtime_minutes
            existing_daily.calculated_at = now()
        else:
            daily = AttendanceDaily(
                personnel_id=personnel.id,
                attendance_date=target_date,
                first_in=first_in,
                last_out=last_out,
                total_work_minutes=total_minutes,
                status=status,
                late_minutes=late_minutes,
                overtime_minutes=overtime_minutes,
                source="SYSTEM_CALC",
            )
            db.add(daily)
