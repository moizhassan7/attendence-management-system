"""Personnel management API endpoints."""

from __future__ import annotations

import asyncio
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.device import Device
from app.models.personnel import Personnel
from app.models.settings import SystemSetting
from app.models.shift import Shift
from app.schemas.common import ApiResponse, PaginatedResponse, PaginationMeta
from app.schemas.personnel import (
    PersonnelCreate,
    PersonnelOut,
    PersonnelUpdate,
    PersonnelBulkShiftUpdate,
)
from app.services.pin_allocator import (
    is_temp_pin,
    next_numeric_pin,
    parse_numeric_pin,
    require_numeric_device_pin,
    used_numeric_pins,
)
from app.services.pin_match import device_enroll_pin
from app.zk.device_manager import DeviceManager, create_device_adapter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/personnel", tags=["personnel"])


async def _load_pin_ranges(db: AsyncSession) -> tuple[int, int, int]:
    result = await db.execute(
        select(SystemSetting).where(
            SystemSetting.key.in_(("trainee_pin_min", "trainee_pin_max", "staff_pin_min"))
        )
    )
    rows = {row.key: row.value for row in result.scalars().all()}
    trainee_min = int(rows.get("trainee_pin_min") or 1)
    trainee_max = int(rows.get("trainee_pin_max") or 2000)
    staff_min = int(rows.get("staff_pin_min") or 2001)
    return trainee_min, trainee_max, staff_min


async def allocate_next_pin(db: AsyncSession, *, is_trainee: bool) -> str:
    trainee_min, trainee_max, staff_min = await _load_pin_ranges(db)
    result = await db.execute(select(Personnel.biometric_user_id))
    used = used_numeric_pins(raw for (raw,) in result.all())
    try:
        if is_trainee:
            next_pin = next_numeric_pin(used, trainee_min, trainee_max)
        else:
            next_pin = next_numeric_pin(used, staff_min)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    pin = str(next_pin)
    return pin


async def _unique_numeric_pin(
    db: AsyncSession,
    *,
    is_trainee: bool,
    requested: str | None,
    exclude_person_id: int | None = None,
) -> str:
    wanted = (requested or "").strip()
    if wanted and (is_temp_pin(wanted) or parse_numeric_pin(wanted) is None):
        wanted = ""
    if wanted:
        try:
            wanted = require_numeric_device_pin(wanted)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        taken_query = select(Personnel.id).where(Personnel.biometric_user_id == wanted)
        if exclude_person_id is not None:
            taken_query = taken_query.where(Personnel.id != exclude_person_id)
        if await db.scalar(taken_query):
            raise HTTPException(status_code=409, detail="Biometric user ID already exists")
        return wanted
    for _ in range(8):
        pin = await allocate_next_pin(db, is_trainee=is_trainee)
        taken_query = select(Personnel.id).where(Personnel.biometric_user_id == pin)
        if exclude_person_id is not None:
            taken_query = taken_query.where(Personnel.id != exclude_person_id)
        if not await db.scalar(taken_query):
            return pin
    raise HTTPException(status_code=409, detail="No free device PIN left in this range")


def resolve_re_enroll_pin(current_pin: str, new_pin: str | None) -> str | None:
    """Return a different PIN to switch to, or None to keep the current Device PIN."""
    candidate = (new_pin or "").strip()
    if not candidate or candidate == (current_pin or "").strip():
        return None
    return candidate


def is_trainee_terminal(device: Device) -> bool:
    return str(getattr(device, "name", "") or "").strip().upper().startswith("TR")


def terminals_for_person(person: Personnel, devices: list[Device]) -> list[Device]:
    """Staff → PTS terminals. Trainees → TR units even when attendance ingest is disabled."""
    listed = [item for item in devices if item is not None]
    if not listed:
        return []
    if person.is_trainee:
        tr_units = [item for item in listed if is_trainee_terminal(item)]
        return tr_units or listed
    staff_units = [item for item in listed if not is_trainee_terminal(item)]
    enabled = [item for item in staff_units if item.enabled]
    return enabled or staff_units or listed


async def _push_person_to_devices(person: Personnel, devices: list[Device]) -> tuple[list[str], list[str]]:
    loop = asyncio.get_running_loop()
    pushed: list[str] = []
    errors: list[str] = []
    for dev in devices:
        try:
            device_pin = require_numeric_device_pin(person.biometric_user_id)
            manager = DeviceManager(_adapter_for(dev, pin=device_pin), name=dev.name)
            await loop.run_in_executor(
                None,
                lambda m=manager, pin=device_pin, p=person: m.push_user(
                    user_id=pin, name=p.full_name
                ),
            )
            pushed.append(dev.name)
        except Exception as exc:
            logger.warning(
                "Could not push person %s to device %s: %s",
                person.biometric_user_id,
                getattr(dev, "name", "?"),
                exc,
            )
            errors.append(f"{dev.name}: {exc}")
    return pushed, errors


async def _delete_pin_from_devices(pin: str, devices: list[Device]) -> None:
    """Remove an old Device PIN from terminals so a re-enroll can use a new ID."""
    if not pin or not devices:
        return
    loop = asyncio.get_running_loop()
    pins = {pin, device_enroll_pin(pin)}
    for dev in devices:
        try:
            manager = DeviceManager(_adapter_for(dev, pin=pin), name=dev.name)
            for old_pin in pins:
                await loop.run_in_executor(
                    None, lambda m=manager, p=old_pin: m.delete_user(p)
                )
        except Exception as exc:
            logger.warning("Could not remove PIN %s from device %s: %s", pin, getattr(dev, "name", "?"), exc)


def _adapter_for(device: Device, *, pin: str | None = None, force_tcp: bool = False):
    transport = getattr(device, "preferred_transport", None) or "auto"
    # UDP enroll packs user_id as int(); TEMP- PINs and templates need TCP.
    if force_tcp or (pin and not str(pin).strip().isdigit()):
        transport = "tcp"
    return create_device_adapter(
        ip=device.ip_address,
        port=device.port,
        password=device.communication_password,
        name=device.name,
        transport=transport,
    )


def _fingerprint_on_device(manager: DeviceManager, personnel_pin: str) -> bool:
    from app.services.pin_match import personnel_has_device_fingerprint

    users, template_uids = manager.fetch_enrollment_state()
    return personnel_has_device_fingerprint(personnel_pin, users, template_uids)


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
        if p.is_trainee:
            rank_name = None
        else:
            rank_name = p.designation

    course_name = None
    try:
        course_name = p.course.name if p.course else None
    except Exception:
        course_name = None

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
        department_name=dept_name if not p.is_trainee else None,
        rank_name=rank_name if not p.is_trainee else None,
        shift_name=shift_name,
        course_name=course_name,
    )


@router.get("", response_model=PaginatedResponse)
async def list_personnel(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=1000)] = 50,
    search: Annotated[str | None, Query()] = None,
    department_id: Annotated[int | None, Query()] = None,
    rank_id: Annotated[int | None, Query()] = None,
    course_id: Annotated[int | None, Query()] = None,
    category: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    is_trainee: Annotated[bool | None, Query()] = None,
    include_attendance: Annotated[bool, Query()] = False,
    db: AsyncSession = Depends(get_db),
):
    """List personnel with search and filters."""
    query = select(Personnel).options(
        selectinload(Personnel.department),
        selectinload(Personnel.rank),
        selectinload(Personnel.course),
    )
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

    if course_id:
        query = query.where(Personnel.course_id == course_id)
        count_query = count_query.where(Personnel.course_id == course_id)

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
        from app.utils.timezone import today, to_local
        
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
                    "first_in": to_local(att.first_in).isoformat() if att.first_in else None,
                    "last_out": to_local(att.last_out).isoformat() if att.last_out else None,
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


@router.get("/next-pin", response_model=ApiResponse)
async def get_next_pin(
    db: AsyncSession = Depends(get_db),
    is_trainee: Annotated[bool, Query()] = False,
):
    """Return the next free device PIN for staff or trainee range."""
    trainee_min, trainee_max, staff_min = await _load_pin_ranges(db)
    pin = await allocate_next_pin(db, is_trainee=is_trainee)
    return ApiResponse(
        data={
            "pin": pin,
            "is_trainee": is_trainee,
            "range_start": trainee_min if is_trainee else staff_min,
            "range_end": trainee_max if is_trainee else None,
        }
    )


@router.post("/bulk-shift", response_model=ApiResponse)
async def bulk_update_shift(
    payload: PersonnelBulkShiftUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Bulk update shift assignment for multiple personnel."""
    if not payload.personnel_ids:
        raise HTTPException(status_code=400, detail="No personnel selected")

    shift_name = "Unassigned"
    if payload.shift_id is not None:
        shift_res = await db.execute(select(Shift).where(Shift.id == payload.shift_id))
        shift = shift_res.scalar_one_or_none()
        if not shift:
            raise HTTPException(status_code=404, detail="Selected shift not found")
        shift_name = shift.name

    stmt = (
        update(Personnel)
        .where(Personnel.id.in_(payload.personnel_ids))
        .values(shift_id=payload.shift_id)
    )
    result = await db.execute(stmt)
    await db.flush()

    return ApiResponse(
        data={"updated_count": result.rowcount, "shift_id": payload.shift_id, "shift_name": shift_name},
        message=f"Successfully changed shift to {shift_name} for {result.rowcount} personnel."
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
    pin = await _unique_numeric_pin(
        db, is_trainee=bool(payload.is_trainee), requested=payload.biometric_user_id
    )
    payload = payload.model_copy(update={"biometric_user_id": pin})
    person = Personnel(**payload.model_dump())
    db.add(person)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Biometric user ID already exists") from exc

    res = await db.execute(
        select(Personnel)
        .options(selectinload(Personnel.department), selectinload(Personnel.rank))
        .where(Personnel.id == person.id)
    )
    person = res.scalar_one()

    # Staff → PTS Staff. Trainees → TR-1/TR-2/TR-3 even if those units are disabled for attendance ingest.
    try:
        devices = list((await db.execute(select(Device))).scalars().all())
        pushed, errors = await _push_person_to_devices(person, terminals_for_person(person, devices))
        if person.is_trainee:
            message = (
                f"Trainee created and written to {', '.join(pushed)}"
                if pushed
                else "Trainee created. Could not write to a TR terminal yet."
            )
        else:
            message = (
                f"Personnel created and pushed to {', '.join(pushed)}"
                if pushed
                else "Personnel created and pushed to terminal(s)"
            )
        if errors:
            logger.warning("Auto-push partial failure for %s: %s", person.biometric_user_id, errors)
        return ApiResponse(data=_to_out(person), message=message)
    except Exception as err:
        logger.warning("Auto-push to devices encountered an error: %s", err)

    return ApiResponse(data=_to_out(person), message="Personnel created and pushed to terminal(s)")


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
    re_enroll: Annotated[bool, Query()] = False,
    new_pin: Annotated[str | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
):
    """Enroll fingerprint or face for a personnel on the physical terminal."""
    result = await db.execute(select(Personnel).where(Personnel.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Personnel not found")

    if biometric_type == "finger":
        from app.services.enrollment_sync import remap_truncated_punches

        # Determine target device. TR units stay selectable even when attendance ingest is disabled.
        devices = list((await db.execute(select(Device).order_by(Device.name))).scalars().all())
        target_device = None
        if device_id:
            target_device = next((item for item in devices if item.id == device_id), None)
        elif person.is_trainee:
            target_device = next(
                (item for item in devices if str(item.name).upper().startswith("TR")),
                None,
            )
        if target_device is None:
            target_device = next((item for item in devices if item.enabled), None)
            if target_device is None and devices:
                target_device = devices[0]

        if not target_device:
            raise HTTPException(
                status_code=400,
                detail="No active attendance terminal available. Please ensure the terminal is enabled."
            )

        old_pin = person.biometric_user_id
        switched_pin = resolve_re_enroll_pin(old_pin, new_pin) if re_enroll else None
        if switched_pin:
            switched_pin = await _unique_numeric_pin(
                db,
                is_trainee=bool(person.is_trainee),
                requested=switched_pin,
                exclude_person_id=person.id,
            )
            person.biometric_user_id = switched_pin
            person.has_fingerprint = False
            await remap_truncated_punches(db, old_pin, switched_pin)
            await db.flush()
            await _delete_pin_from_devices(old_pin, terminals_for_person(person, devices))
        elif re_enroll:
            person.has_fingerprint = False
            await db.flush()

        loop = asyncio.get_running_loop()
        try:
            device_pin = require_numeric_device_pin(person.biometric_user_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        manager = DeviceManager(_adapter_for(target_device, pin=device_pin), name=target_device.name)
        enroll_error: Exception | None = None
        enrolled = False
        replace_existing = bool(re_enroll and not switched_pin)
        try:
            enrolled = await loop.run_in_executor(
                None,
                lambda: manager.push_and_enroll_fingerprint(
                    user_id=device_pin,
                    name=person.full_name,
                    replace=replace_existing,
                ),
            )
        except Exception as exc:
            enroll_error = exc
            logger.warning(
                "Enrollment command failed for %s on %s: %s",
                person.full_name,
                target_device.name,
                exc,
            )

        has_fp = False
        verify_error: Exception | None = None
        for attempt in range(1, 4):
            try:
                await asyncio.sleep(0.8 if attempt == 1 else 2.0)
                has_fp = await loop.run_in_executor(
                    None,
                    lambda: _fingerprint_on_device(manager, person.biometric_user_id),
                )
                if has_fp:
                    break
            except Exception as exc:
                verify_error = exc
                logger.warning(
                    "Fingerprint verify attempt %d failed for %s: %s",
                    attempt,
                    person.full_name,
                    exc,
                )

        if has_fp or enrolled:
            person.has_fingerprint = True
            await db.flush()
            if switched_pin:
                message = (
                    f"Re-enrolled {person.full_name} on new PIN {person.biometric_user_id} "
                    f"at {target_device.name}."
                )
            elif re_enroll:
                message = f"Fingerprint re-enrolled for {person.full_name} on {target_device.name}."
            else:
                message = f"Fingerprint enrolled successfully for {person.full_name} on {target_device.name}!"
            return ApiResponse(data=_to_out(person), message=message)

        if enroll_error or verify_error:
            detail = enroll_error or verify_error
            raise HTTPException(
                status_code=500,
                detail=f"Device communication error: {detail}",
            )
        raise HTTPException(
            status_code=408,
            detail=(
                "Terminal did not capture a fingerprint. Confirm the selected device showed "
                "the scan prompt, then place the finger 3 times."
            ),
        )

    elif biometric_type == "face":
        # Remote face capture isn't supported over network on these units
        person.has_face = True
        await db.flush()
        return ApiResponse(
            data=_to_out(person),
            message=f"Face registration flag activated for {person.full_name}. Complete facial scan via terminal menu."
        )


@router.post("/{person_id}/push-to-terminal", response_model=ApiResponse)
async def push_personnel_to_terminal(
    person_id: int,
    device_id: Annotated[int | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
):
    """Push a personnel record to the matching terminals (TR for trainees, PTS for staff)."""
    result = await db.execute(select(Personnel).where(Personnel.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Personnel not found")

    if device_id:
        dev_res = await db.execute(select(Device).where(Device.id == device_id))
        dev = dev_res.scalar_one_or_none()
        devices = [dev] if dev else []
    else:
        all_devices = list((await db.execute(select(Device))).scalars().all())
        devices = terminals_for_person(person, all_devices)

    if not devices:
        raise HTTPException(status_code=400, detail="No matching terminal found")

    pushed, errors = await _push_person_to_devices(person, devices)

    if pushed:
        return ApiResponse(
            data={"pushed_to": pushed, "errors": errors},
            message=f"Pushed {person.full_name} (PIN: {person.biometric_user_id}) to {', '.join(pushed)}"
        )
    raise HTTPException(status_code=500, detail=f"Failed to push to terminal: {'; '.join(errors)}")


@router.post("/sync-biometrics", response_model=ApiResponse)
async def sync_biometrics_from_devices(
    device_id: Annotated[int | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
):
    """Sync enrolled fingerprint status from every terminal, including disabled TR units."""
    from app.zk.sync_service import SyncService

    sync_service = SyncService()
    if device_id:
        row = await sync_service._sync_enrollments_isolated(device_id)
        row.pop("confirmed_person_ids", None)
        updated = int(row.get("fingerprints_updated") or 0)
        remapped = int(row.get("punches_remapped") or 0)
        cleared = 0
        if row.get("status") != "SUCCESS":
            raise HTTPException(status_code=500, detail=row.get("error") or "Enrollment sync failed")
        summary = {"updated": updated, "punches_remapped": remapped, "details": [row]}
    else:
        result = await sync_service.sync_enrollments_all_devices()
        updated = int(result.get("fingerprints_updated") or 0)
        cleared = int(result.get("fingerprints_cleared") or 0)
        remapped = sum(int(item.get("punches_remapped") or 0) for item in result.get("details") or [])
        summary = {
            "updated": updated,
            "cleared": cleared,
            "punches_remapped": remapped,
            "devices_ok": result.get("success"),
            "devices_failed": result.get("failed"),
            "details": result.get("details"),
        }
    message = f"Biometrics synced successfully. Updated {updated} profiles."
    if cleared:
        message += f" Cleared {cleared} profiles with no fingerprint on any terminal."
    if remapped:
        message += f" Linked {remapped} punches from truncated device PINs."
    return ApiResponse(data=summary, message=message)


@router.delete("/{person_id}", response_model=ApiResponse)
async def delete_personnel(person_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a personnel record and its associated daily attendance and punches."""
    result = await db.execute(select(Personnel).where(Personnel.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Personnel not found")

    from app.models.attendance import AttendanceDaily, AttendancePunch
    from app.models.exception import AttendanceException

    # Remove daily records & exceptions
    await db.execute(select(AttendanceDaily).where(AttendanceDaily.personnel_id == person_id))
    from sqlalchemy import delete
    await db.execute(delete(AttendanceDaily).where(AttendanceDaily.personnel_id == person_id))
    await db.execute(delete(AttendanceException).where(AttendanceException.personnel_id == person_id))

    # Also remove from connected devices
    try:
        dev_res = await db.execute(select(Device).where(Device.enabled == True))
        devices = dev_res.scalars().all()
        loop = asyncio.get_running_loop()
        for dev in devices:
            try:
                adapter = _adapter_for(dev, pin=person.biometric_user_id)
                manager = DeviceManager(adapter, name=dev.name)
                pins = {person.biometric_user_id, device_enroll_pin(person.biometric_user_id)}
                for pin in pins:
                    await loop.run_in_executor(
                        None, lambda m=manager, p=pin: m.delete_user(p)
                    )
            except Exception as dev_err:
                logger.warning("Could not delete user %s from device %s: %s", person.biometric_user_id, dev.name, dev_err)
    except Exception:
        pass

    await db.delete(person)
    await db.commit()

    return ApiResponse(message=f"Personnel '{person.full_name}' deleted successfully")


@router.get("/export/file")
async def export_personnel(
    is_trainee: Annotated[bool, Query()] = False,
    format: Annotated[str, Query()] = "xlsx",
    search: Annotated[str | None, Query()] = None,
    department_id: Annotated[int | None, Query()] = None,
    rank_id: Annotated[int | None, Query()] = None,
    course_id: Annotated[int | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
):
    """Export personnel directory as Excel (.xlsx) or CSV."""
    import io
    import csv
    from fastapi.responses import Response

    query = select(Personnel).options(
        selectinload(Personnel.department),
        selectinload(Personnel.rank),
        selectinload(Personnel.course),
    ).where(Personnel.is_trainee == is_trainee)

    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            or_(
                Personnel.full_name.ilike(s),
                Personnel.employee_code.ilike(s),
                Personnel.biometric_user_id.ilike(s),
                Personnel.cnic.ilike(s),
            )
        )
    if department_id:
        query = query.where(Personnel.department_id == department_id)
    if rank_id:
        query = query.where(Personnel.rank_id == rank_id)
    if course_id:
        query = query.where(Personnel.course_id == course_id)
    if status:
        query = query.where(Personnel.employment_status == status)

    result = await db.execute(query.order_by(Personnel.biometric_user_id.asc()))
    records = result.scalars().all()

    # Get today's attendance map
    from app.models.attendance import AttendanceDaily
    from app.utils.timezone import today
    t_date = today()
    att_res = await db.execute(
        select(AttendanceDaily).where(
            AttendanceDaily.attendance_date == t_date,
            AttendanceDaily.personnel_id.in_([p.id for p in records]) if records else False
        )
    )
    att_map = {a.personnel_id: a.status for a in att_res.scalars().all()}

    entity_label = "Trainees" if is_trainee else "Staff"

    if format.lower() == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["SR", "PIN", "BELT / CODE", "NAME", "FATHER NAME", "CNIC", "DOB", "RANK / COURSE", "DEPARTMENT", "GENDER", "STATUS", "ATTENDANCE TODAY"])
        for idx, p in enumerate(records, 1):
            rank_course = p.course.name if (p.is_trainee and p.course) else (p.rank.name if p.rank else p.designation)
            writer.writerow([
                idx,
                p.biometric_user_id,
                p.employee_code or "",
                p.full_name,
                p.father_name or "",
                p.cnic or "",
                p.dob.strftime("%d/%m/%Y") if p.dob else "",
                rank_course or "",
                p.department.name if p.department else "",
                p.gender or "Male",
                p.employment_status,
                att_map.get(p.id, "ABSENT"),
            ])
        return Response(
            content=output.getvalue().encode("utf-8-sig"),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{entity_label}_Directory_{t_date}.csv"'},
        )

    # Excel format
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"{entity_label} Directory"
    ws.views.sheetView[0].showGridLines = True

    # Title header
    setting_res = await db.execute(select(SystemSetting.value).where(SystemSetting.key == "org_display_name"))
    org_display_name = setting_res.scalar_one_or_none() or "Police Training School Rawat"

    ws.merge_cells("A1:L1")
    ws["A1"] = f"{org_display_name} — {entity_label} Directory ({t_date})"
    ws["A1"].font = Font(name="Calibri", size=14, bold=True, color="1E293B")
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 30

    headers = ["SR", "PIN", "BELT / CODE", "NAME", "FATHER NAME", "CNIC", "DOB", "RANK / COURSE", "DEPARTMENT", "GENDER", "STATUS", "ATTENDANCE TODAY"]
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
        c = ws.cell(row=3, column=col_num)
        c.fill = header_fill
        c.font = header_font
        c.alignment = Alignment(horizontal="center", vertical="center")

    ws.row_dimensions[3].height = 24

    for idx, p in enumerate(records, 1):
        rank_course = p.course.name if (p.is_trainee and p.course) else (p.rank.name if p.rank else p.designation)
        row_data = [
            idx,
            p.biometric_user_id,
            p.employee_code or "-",
            p.full_name,
            p.father_name or "-",
            p.cnic or "-",
            p.dob.strftime("%d/%m/%Y") if p.dob else "-",
            rank_course or "-",
            p.department.name if p.department else "-",
            p.gender or "Male",
            p.employment_status,
            att_map.get(p.id, "ABSENT"),
        ]
        ws.append(row_data)
        cur_row = ws.max_row
        ws.row_dimensions[cur_row].height = 20
        for col_num in range(1, len(row_data) + 1):
            cell = ws.cell(row=cur_row, column=col_num)
            cell.border = thin_border
            cell.font = Font(name="Calibri", size=10)
            if col_num in (1, 2, 3, 6, 7, 10, 11, 12):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

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
        headers={"Content-Disposition": f'attachment; filename="{entity_label}_Directory_{t_date}.xlsx"'},
    )

