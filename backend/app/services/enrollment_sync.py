"""Apply device user/fingerprint state onto personnel and punches."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import AttendancePunch
from app.models.personnel import Personnel
from app.services.pin_match import resolve_personnel_pin


async def remap_truncated_punches(db: AsyncSession, from_pin: str, to_pin: str) -> int:
    """Attach punches stored under a truncated device PIN to the personnel PIN."""
    if not from_pin or from_pin == to_pin:
        return 0
    punches = (
        await db.execute(select(AttendancePunch).where(AttendancePunch.biometric_user_id == from_pin))
    ).scalars().all()
    moved = 0
    for punch in punches:
        duplicate = await db.scalar(
            select(AttendancePunch.id).where(
                AttendancePunch.device_id == punch.device_id,
                AttendancePunch.biometric_user_id == to_pin,
                AttendancePunch.punch_time == punch.punch_time,
            )
        )
        if duplicate:
            await db.delete(punch)
            continue
        punch.biometric_user_id = to_pin
        moved += 1
    return moved


async def apply_device_enrollment_state(
    db: AsyncSession,
    *,
    personnel: Sequence[Personnel],
    device_users: Sequence[object],
    template_uids: set[int],
) -> dict[str, int]:
    """Mark fingerprints and relink truncated punches. Runs on every device sync."""
    person_by_pin = {str(person.biometric_user_id): person for person in personnel}
    pins = list(person_by_pin)
    fingerprints_updated = 0
    punches_remapped = 0
    confirmed: set[int] = set()
    for user in device_users:
        pin = str(getattr(user, "user_id", "") or "")
        resolved = resolve_personnel_pin(pin, pins)
        if not resolved:
            continue
        person = person_by_pin[resolved]
        uid = getattr(user, "uid", None)
        if uid in template_uids:
            confirmed.add(person.id)
            if not person.has_fingerprint:
                person.has_fingerprint = True
                fingerprints_updated += 1
        if pin != resolved:
            punches_remapped += await remap_truncated_punches(db, pin, resolved)
    return {
        "fingerprints_updated": fingerprints_updated,
        "punches_remapped": punches_remapped,
        "confirmed_person_ids": confirmed,
    }


async def clear_stale_fingerprint_flags(db: AsyncSession, confirmed_person_ids: set[int]) -> int:
    """Drop has_fingerprint for people no terminal actually holds a template for.

    Only valid once every terminal has been read in the same pass: somebody
    enrolled on TR-1 looks unenrolled when judged from TR-2's data alone.
    """
    flagged = (
        await db.execute(select(Personnel).where(Personnel.has_fingerprint.is_(True)))
    ).scalars().all()
    cleared = 0
    for person in flagged:
        if person.id in confirmed_person_ids:
            continue
        person.has_fingerprint = False
        cleared += 1
    return cleared
