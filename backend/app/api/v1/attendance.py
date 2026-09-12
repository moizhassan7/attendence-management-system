"""Attendance API endpoints — raw punches and daily records."""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.attendance import AttendancePunch, AttendanceDaily
from app.models.personnel import Personnel
from app.schemas.common import ApiResponse, PaginatedResponse, PaginationMeta
from app.schemas.attendance import AttendancePunchOut, AttendanceDailyOut
from app.utils.timezone import today

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.get("/punches", response_model=PaginatedResponse)
async def list_punches(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
    date_filter: Annotated[date | None, Query(alias="date")] = None,
    biometric_user_id: Annotated[str | None, Query()] = None,
    device_id: Annotated[int | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
):
    """List raw attendance punches with filters."""
    query = select(AttendancePunch)
    count_query = select(func.count(AttendancePunch.id))

    if date_filter:
        from datetime import datetime, time
        t0 = datetime.combine(date_filter, time.min)
        t1 = datetime.combine(date_filter, time.max)
        query = query.where(AttendancePunch.punch_time >= t0, AttendancePunch.punch_time <= t1)
        count_query = count_query.where(AttendancePunch.punch_time >= t0, AttendancePunch.punch_time <= t1)

    if biometric_user_id:
        query = query.where(AttendancePunch.biometric_user_id == biometric_user_id)
        count_query = count_query.where(AttendancePunch.biometric_user_id == biometric_user_id)

    if device_id:
        query = query.where(AttendancePunch.device_id == device_id)
        count_query = count_query.where(AttendancePunch.device_id == device_id)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(AttendancePunch.punch_time.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    punches = result.scalars().all()

    # Resolve personnel names
    out = []
    for p in punches:
        personnel = await db.execute(
            select(Personnel).where(Personnel.biometric_user_id == p.biometric_user_id)
        )
        person = personnel.scalar_one_or_none()
        out.append(AttendancePunchOut(
            id=p.id,
            device_id=p.device_id,
            biometric_user_id=p.biometric_user_id,
            punch_time=p.punch_time,
            punch_type=p.punch_type,
            verified=p.verified,
            source=p.source,
            created_at=p.created_at,
            personnel_name=person.full_name if person else None,
            device_name=p.device.name if p.device else None,
        ))

    return PaginatedResponse(
        data=out,
        pagination=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@router.get("/daily", response_model=PaginatedResponse)
async def list_daily_attendance(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
    date_filter: Annotated[date | None, Query(alias="date")] = None,
    department_id: Annotated[int | None, Query()] = None,
    rank_id: Annotated[int | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
):
    """List daily attendance records with filters."""
    query = select(AttendanceDaily)
    count_query = select(func.count(AttendanceDaily.id))

    target_date = date_filter or today()
    query = query.where(AttendanceDaily.attendance_date == target_date)
    count_query = count_query.where(AttendanceDaily.attendance_date == target_date)

    if status:
        query = query.where(AttendanceDaily.status == status)
        count_query = count_query.where(AttendanceDaily.status == status)

    # Join with Personnel for filtering by dept/rank
    if department_id or rank_id:
        query = query.join(Personnel, AttendanceDaily.personnel_id == Personnel.id)
        count_query = count_query.join(Personnel, AttendanceDaily.personnel_id == Personnel.id)
        if department_id:
            query = query.where(Personnel.department_id == department_id)
            count_query = count_query.where(Personnel.department_id == department_id)
        if rank_id:
            query = query.where(Personnel.rank_id == rank_id)
            count_query = count_query.where(Personnel.rank_id == rank_id)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(AttendanceDaily.personnel_id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    records = result.scalars().all()

    out = []
    for r in records:
        p = r.personnel
        out.append(AttendanceDailyOut(
            id=r.id,
            personnel_id=r.personnel_id,
            attendance_date=r.attendance_date,
            first_in=r.first_in,
            last_out=r.last_out,
            total_work_minutes=r.total_work_minutes,
            status=r.status,
            late_minutes=r.late_minutes,
            overtime_minutes=r.overtime_minutes,
            source=r.source,
            calculated_at=r.calculated_at,
            personnel_name=p.full_name if p else None,
            employee_code=p.employee_code if p else None,
            biometric_user_id=p.biometric_user_id if p else None,
            department_name=p.department.name if p and p.department else None,
            rank_name=p.rank.name if p and p.rank else None,
            category=p.category if p else None,
            shift_name=p.shift.name if p and p.shift else None,
        ))

    return PaginatedResponse(
        data=out,
        pagination=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@router.get("/recent-punches", response_model=ApiResponse)
async def recent_punches(
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    db: AsyncSession = Depends(get_db),
):
    """Get the most recent punches (for live feed)."""
    result = await db.execute(
        select(AttendancePunch)
        .order_by(AttendancePunch.punch_time.desc())
        .limit(limit)
    )
    punches = result.scalars().all()

    out = []
    for p in punches:
        personnel = await db.execute(
            select(Personnel).where(Personnel.biometric_user_id == p.biometric_user_id)
        )
        person = personnel.scalar_one_or_none()
        out.append(AttendancePunchOut(
            id=p.id,
            device_id=p.device_id,
            biometric_user_id=p.biometric_user_id,
            punch_time=p.punch_time,
            punch_type=p.punch_type,
            verified=p.verified,
            source=p.source,
            created_at=p.created_at,
            personnel_name=person.full_name if person else None,
            device_name=p.device.name if p.device else None,
        ))

    return ApiResponse(data=out)


@router.post("/process", response_model=ApiResponse)
async def process_attendance(
    target_date: Annotated[date | None, Query(alias="date")] = None,
    personnel_id: Annotated[int | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger attendance calculation for a specific date (defaults to today)."""
    from app.services.attendance_engine import AttendanceService
    from app.utils.timezone import today
    
    process_date = target_date or today()
    calc_service = AttendanceService()
    
    try:
        processed = await calc_service.process_daily_attendance(
            db=db, target_date=process_date, personnel_id=personnel_id
        )
        await db.commit()
        return ApiResponse(
            message=f"Processed daily attendance for {processed} personnel on {process_date}",
            data={"processed": processed, "date": process_date}
        )
    except Exception as e:
        await db.rollback()
        return ApiResponse(
            success=False,
            message=f"Failed to process attendance: {str(e)}"
        )


@router.get("/report")
async def get_attendance_report(
    is_trainee: Annotated[bool, Query()] = False,
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
    date_filter: Annotated[date | None, Query(alias="date")] = None,
    quick_filter: Annotated[str, Query()] = "all",
    search: Annotated[str | None, Query()] = None,
    department_id: Annotated[int | None, Query()] = None,
    rank_id: Annotated[int | None, Query()] = None,
    course_id: Annotated[int | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=500)] = 50,
    db: AsyncSession = Depends(get_db),
):
    """Fetch attendance report with rich filters and summaries."""
    from datetime import timedelta
    from sqlalchemy import or_
    from sqlalchemy.orm import selectinload

    target_start = start_date or date_filter or today()
    target_end = end_date or target_start
    if target_end < target_start:
        target_end = target_start

    # Personnel base query
    p_query = (
        select(Personnel)
        .options(
            selectinload(Personnel.rank),
            selectinload(Personnel.department),
            selectinload(Personnel.course),
        )
        .where(Personnel.is_trainee == is_trainee)
    )

    if department_id:
        p_query = p_query.where(Personnel.department_id == department_id)
    if rank_id:
        p_query = p_query.where(Personnel.rank_id == rank_id)
    if course_id:
        p_query = p_query.where(Personnel.course_id == course_id)
    if search:
        s = f"%{search.strip()}%"
        p_query = p_query.where(
            or_(
                Personnel.full_name.ilike(s),
                Personnel.employee_code.ilike(s),
                Personnel.biometric_user_id.ilike(s),
            )
        )

    p_query = p_query.order_by(Personnel.biometric_user_id.asc(), Personnel.id.asc())
    personnel_res = await db.execute(p_query)
    personnel_list = personnel_res.scalars().all()

    if not personnel_list:
        return {
            "data": [],
            "summary": {
                "total": 0, "present": 0, "late": 0, "absent": 0, "leave": 0, "total_hours": 0
            },
            "pagination": {
                "page": page, "page_size": page_size, "total": 0, "total_pages": 0
            }
        }

    personnel_ids = [p.id for p in personnel_list]

    # Fetch daily attendance records in range
    att_query = select(AttendanceDaily).where(
        AttendanceDaily.personnel_id.in_(personnel_ids),
        AttendanceDaily.attendance_date >= target_start,
        AttendanceDaily.attendance_date <= target_end,
    )
    att_res = await db.execute(att_query)
    all_att = att_res.scalars().all()

    att_map = {(a.personnel_id, a.attendance_date): a for a in all_att}

    items = []
    sr = 1
    is_single_day = (target_start == target_end)

    if is_single_day:
        for p in personnel_list:
            a = att_map.get((p.id, target_start))
            raw_status = (a.status if a and a.status else "").upper()
            first_in = a.first_in if a else None
            last_out = a.last_out if a else None
            total_minutes = a.total_work_minutes if a else 0.0

            if first_in:
                if raw_status == "LATE" or (a and a.late_minutes and a.late_minutes > 0):
                    status = "Late"
                else:
                    status = "Present"
            elif raw_status in ("LEAVE", "OSD", "MEDICAL", "DUTY_REST"):
                status = "Leave"
            elif raw_status == "WEEKEND":
                status = "Weekend"
            else:
                status = "Absent"

            if quick_filter == "late" and status != "Late":
                continue
            elif quick_filter == "absent" and status not in ("Absent", "Weekend"):
                continue
            elif quick_filter == "leave" and status != "Leave":
                continue

            rank_title = (p.rank.name if p.rank else None) or p.designation or (p.course.name if p.course else "Trainee" if p.is_trainee else "Staff")
            dept_title = (p.department.name if p.department else "General")

            check_in_str = first_in.strftime("%I:%M %p") if first_in else "—"
            check_out_str = last_out.strftime("%I:%M %p") if last_out else "—"
            hours_str = f"{total_minutes / 60:.2f}" if total_minutes and total_minutes > 0 else "—"

            items.append({
                "sr": sr,
                "id": p.id,
                "personnel_id": p.id,
                "name": p.full_name,
                "belt_no": p.employee_code or "—",
                "pin": p.biometric_user_id,
                "rank": rank_title,
                "department": dept_title,
                "status": status,
                "check_in": check_in_str,
                "check_out": check_out_str,
                "hours": hours_str,
                "late_minutes": a.late_minutes if a else 0,
                "date": target_start.isoformat(),
                "is_trainee": p.is_trainee,
            })
            sr += 1
    else:
        for p in personnel_list:
            if quick_filter == "summary":
                p_atts = [a for a in all_att if a.personnel_id == p.id]
                present_days = sum(1 for a in p_atts if a.first_in and a.status in ("PRESENT", "LATE"))
                late_days = sum(1 for a in p_atts if a.status == "LATE" or (a.late_minutes and a.late_minutes > 0))
                leave_days = sum(1 for a in p_atts if (a.status or "").upper() in ("LEAVE", "OSD", "MEDICAL", "DUTY_REST"))
                total_min = sum(a.total_work_minutes or 0.0 for a in p_atts)
                total_days = (target_end - target_start).days + 1
                absent_days = max(0, total_days - (present_days + leave_days))

                rank_title = (p.rank.name if p.rank else None) or p.designation or (p.course.name if p.course else "Trainee" if p.is_trainee else "Staff")
                dept_title = (p.department.name if p.department else "General")

                items.append({
                    "sr": sr,
                    "id": p.id,
                    "personnel_id": p.id,
                    "name": p.full_name,
                    "belt_no": p.employee_code or "—",
                    "pin": p.biometric_user_id,
                    "rank": rank_title,
                    "department": dept_title,
                    "status": "Summary",
                    "check_in": f"{present_days} Pres",
                    "check_out": f"{absent_days} Abs",
                    "hours": f"{total_min / 60:.2f}",
                    "late_minutes": late_days,
                    "date": f"{target_start} to {target_end}",
                    "is_trainee": p.is_trainee,
                    "summary_data": {
                        "present_days": present_days,
                        "late_days": late_days,
                        "absent_days": absent_days,
                        "leave_days": leave_days,
                    }
                })
                sr += 1
            else:
                cur_d = target_start
                while cur_d <= target_end:
                    a = att_map.get((p.id, cur_d))
                    raw_status = (a.status if a and a.status else "").upper()
                    first_in = a.first_in if a else None
                    last_out = a.last_out if a else None
                    total_minutes = a.total_work_minutes if a else 0.0

                    if first_in:
                        if raw_status == "LATE" or (a and a.late_minutes and a.late_minutes > 0):
                            status = "Late"
                        else:
                            status = "Present"
                    elif raw_status in ("LEAVE", "OSD", "MEDICAL", "DUTY_REST"):
                        status = "Leave"
                    elif raw_status == "WEEKEND":
                        status = "Weekend"
                    else:
                        status = "Absent"

                    if quick_filter == "late" and status != "Late":
                        cur_d += timedelta(days=1)
                        continue
                    elif quick_filter == "absent" and status not in ("Absent", "Weekend"):
                        cur_d += timedelta(days=1)
                        continue
                    elif quick_filter == "leave" and status != "Leave":
                        cur_d += timedelta(days=1)
                        continue

                    rank_title = (p.rank.name if p.rank else None) or p.designation or (p.course.name if p.course else "Trainee" if p.is_trainee else "Staff")
                    dept_title = (p.department.name if p.department else "General")

                    check_in_str = first_in.strftime("%I:%M %p") if first_in else "—"
                    check_out_str = last_out.strftime("%I:%M %p") if last_out else "—"
                    hours_str = f"{total_minutes / 60:.2f}" if total_minutes and total_minutes > 0 else "—"

                    items.append({
                        "sr": sr,
                        "id": p.id,
                        "personnel_id": p.id,
                        "name": p.full_name,
                        "belt_no": p.employee_code or "—",
                        "pin": p.biometric_user_id,
                        "rank": rank_title,
                        "department": dept_title,
                        "status": status,
                        "check_in": check_in_str,
                        "check_out": check_out_str,
                        "hours": hours_str,
                        "late_minutes": a.late_minutes if a else 0,
                        "date": cur_d.isoformat(),
                        "is_trainee": p.is_trainee,
                    })
                    sr += 1
                    cur_d += timedelta(days=1)

    if quick_filter == "by_department":
        items.sort(key=lambda x: (x["department"], x["name"]))
        for idx, item in enumerate(items, 1):
            item["sr"] = idx

    total_matching = len(items)
    present_cnt = sum(1 for it in items if it["status"] == "Present")
    late_cnt = sum(1 for it in items if it["status"] == "Late")
    leave_cnt = sum(1 for it in items if it["status"] == "Leave")
    absent_cnt = sum(1 for it in items if it["status"] in ("Absent", "Weekend"))
    total_hrs = sum(float(it["hours"]) for it in items if it["hours"] != "—")

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    page_data = items[start_idx:end_idx]

    return {
        "data": page_data,
        "summary": {
            "total": total_matching,
            "present": present_cnt,
            "late": late_cnt,
            "absent": absent_cnt,
            "leave": leave_cnt,
            "total_hours": round(total_hrs, 2),
        },
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total_matching,
            "total_pages": (total_matching + page_size - 1) // page_size if page_size > 0 else 1,
        }
    }


@router.get("/report/export")
async def export_attendance_report(
    is_trainee: Annotated[bool, Query()] = False,
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
    date_filter: Annotated[date | None, Query(alias="date")] = None,
    quick_filter: Annotated[str, Query()] = "all",
    search: Annotated[str | None, Query()] = None,
    department_id: Annotated[int | None, Query()] = None,
    rank_id: Annotated[int | None, Query()] = None,
    course_id: Annotated[int | None, Query()] = None,
    format: Annotated[str, Query()] = "xlsx",
    db: AsyncSession = Depends(get_db),
):
    """Export attendance report as Excel (.xlsx) or CSV."""
    import io
    import csv
    from fastapi.responses import Response

    report = await get_attendance_report(
        is_trainee=is_trainee,
        start_date=start_date,
        end_date=end_date,
        date_filter=date_filter,
        quick_filter=quick_filter,
        search=search,
        department_id=department_id,
        rank_id=rank_id,
        course_id=course_id,
        page=1,
        page_size=10000,
        db=db,
    )
    rows = report.get("data", [])
    target_date_str = str(start_date or date_filter or today())
    entity_label = "Trainees" if is_trainee else "Staff"

    if format.lower() == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["SR", "NAME", "BELT NO", "PIN", "RANK / COURSE", "DEPARTMENT", "STATUS", "CHECK-IN", "CHECK-OUT", "HOURS", "DATE"])
        for r in rows:
            writer.writerow([
                r["sr"],
                r["name"],
                r["belt_no"],
                r["pin"],
                r["rank"],
                r["department"],
                r["status"],
                r["check_in"],
                r["check_out"],
                r["hours"],
                r["date"],
            ])
        csv_bytes = output.getvalue().encode("utf-8-sig")
        return Response(
            content=csv_bytes,
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="Attendance_{entity_label}_{target_date_str}.csv"'
            },
        )

    # Excel format
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"{entity_label} Attendance"
    ws.views.sheetView[0].showGridLines = True

    # Title header
    ws.merge_cells("A1:K1")
    ws["A1"] = f"Police Training School Rawat — {entity_label} Attendance Report ({target_date_str})"
    ws["A1"].font = Font(name="Calibri", size=14, bold=True, color="1E293B")
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 30

    headers = ["SR", "NAME", "BELT NO", "PIN", "RANK / COURSE", "DEPARTMENT", "STATUS", "CHECK-IN", "CHECK-OUT", "HOURS", "DATE"]
    ws.append([])
    ws.append(headers)

    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    thin_border = Border(
        left=Side(style="thin", color="E2E8F0"),
        right=Side(style="thin", color="E2E8F0"),
        top=Side(style="thin", color="E2E8F0"),
        bottom=Side(style="thin", color="E2E8F0"),
    )

    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=3, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border
    ws.row_dimensions[3].height = 24

    for r in rows:
        row_data = [
            r["sr"],
            r["name"],
            r["belt_no"],
            r["pin"],
            r["rank"],
            r["department"],
            r["status"],
            r["check_in"],
            r["check_out"],
            r["hours"],
            r["date"],
        ]
        ws.append(row_data)
        cur_row = ws.max_row
        ws.row_dimensions[cur_row].height = 20
        for col_num in range(1, len(row_data) + 1):
            cell = ws.cell(row=cur_row, column=col_num)
            cell.border = thin_border
            cell.font = Font(name="Calibri", size=10)
            if col_num in (1, 3, 4, 7, 8, 9, 10, 11):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

            # Status color highlights
            if col_num == 7:
                st = str(cell.value).upper()
                if "PRESENT" in st:
                    cell.fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
                    cell.font = Font(name="Calibri", size=10, bold=True, color="166534")
                elif "LATE" in st:
                    cell.fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
                    cell.font = Font(name="Calibri", size=10, bold=True, color="92400E")
                elif "LEAVE" in st:
                    cell.fill = PatternFill(start_color="E0F2FE", end_color="E0F2FE", fill_type="solid")
                    cell.font = Font(name="Calibri", size=10, bold=True, color="075985")
                elif "ABSENT" in st:
                    cell.fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
                    cell.font = Font(name="Calibri", size=10, bold=True, color="991B1B")

    # Column width auto-fit
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="Attendance_{entity_label}_{target_date_str}.xlsx"'
        },
    )

