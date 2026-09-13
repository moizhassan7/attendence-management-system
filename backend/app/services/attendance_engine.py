"""Attendance processing engine."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import AttendanceDaily, AttendancePunch
from app.models.exception import AttendanceException
from app.models.holiday import Holiday
from app.models.personnel import Personnel
from app.models.shift import Shift
from app.utils.timezone import get_tz, now, to_local

logger = logging.getLogger(__name__)


class AttendanceService:
    """Core logic for calculating daily attendance from raw punches."""

    async def process_daily_attendance(
        self, db: AsyncSession, target_date: date, personnel_id: int | None = None
    ) -> int:
        """Process attendance for a given date. Returns number of records processed."""
        # 1. Get all active personnel
        personnel_query = select(Personnel).where(Personnel.employment_status == "Active")
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
        # Assuming weekend_days setting (e.g., "5,6" for Sat/Sun). Hardcoded 5,6 for simplicity if settings missing
        is_weekend = target_date.weekday() in (5, 6)

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

        if first_in:
            shift = personnel.shift
            if not shift:
                # Default shift lookup if not assigned
                shift = (await db.execute(select(Shift).limit(1))).scalar_one_or_none()

            status = "PRESENT"

            if shift:
                # Calculate expected start time in local timezone
                first_in_local = to_local(first_in)
                expected_start = datetime.combine(target_date, shift.start_time, tzinfo=tz)
                grace_period = timedelta(minutes=shift.late_grace_minutes if shift.late_grace_minutes is not None else 10)

                # Check late
                if first_in_local and first_in_local > expected_start + grace_period:
                    status = "LATE"
                    late_delta = first_in_local - expected_start
                    late_minutes = max(0, int(late_delta.total_seconds() / 60))

                # Check overtime
                if last_out:
                    last_out_local = to_local(last_out)
                    expected_end = datetime.combine(target_date, shift.end_time, tzinfo=tz)
                    if last_out_local and last_out_local > expected_end:
                        ot_delta = last_out_local - expected_end
                        overtime_minutes = max(0, int(ot_delta.total_seconds() / 60))
        else:
            # Base default cases when no punch was registered
            if exc:
                status = exc.exception_type  # LEAVE, OSD, MEDICAL, DUTY_REST
            elif is_holiday:
                status = "HOLIDAY"
            elif is_weekend:
                status = "WEEKEND"
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
