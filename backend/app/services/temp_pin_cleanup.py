"""Convert TEMP-* device PINs to numeric IDs without dropping fingerprints."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.personnel import Personnel
from app.models.settings import SystemSetting
from app.services.enrollment_sync import remap_truncated_punches
from app.services.pin_allocator import is_temp_pin, next_numeric_pin, parse_numeric_pin
from app.services.pin_match import LEGACY_DEVICE_PIN_WIDTH, normalize_pin


def temp_truncations(pin: str) -> list[str]:
    """Legacy device twins created when TEMP-<CNIC> was cut at 14 characters."""
    pin = normalize_pin(pin)
    if not pin:
        return []
    trunc = pin[:LEGACY_DEVICE_PIN_WIDTH]
    if trunc and trunc != pin:
        return [trunc]
    return []


async def _staff_pin_min(db: AsyncSession) -> int:
    row = await db.scalar(select(SystemSetting.value).where(SystemSetting.key == "staff_pin_min"))
    return int(row or 2001)


async def reassign_temp_staff_pins(db: AsyncSession) -> dict[str, int]:
    """Give TEMP-* staff a numeric PIN and move their punches with them.

    People with a fingerprint flag are left untouched. Personnel rows are
    never deleted.
    """
    people = (await db.execute(select(Personnel).order_by(Personnel.id))).scalars().all()
    used = {
        pin
        for person in people
        if (pin := parse_numeric_pin(person.biometric_user_id)) is not None
    }
    staff_min = await _staff_pin_min(db)
    remaining_temp = {
        normalize_pin(person.biometric_user_id)
        for person in people
        if is_temp_pin(person.biometric_user_id)
    }
    converted = 0
    skipped_fingerprint = 0
    punches_moved = 0
    for person in people:
        old = normalize_pin(person.biometric_user_id)
        if not is_temp_pin(old):
            continue
        if person.has_fingerprint:
            skipped_fingerprint += 1
            continue
        new_pin = str(next_numeric_pin(used, staff_min))
        used.add(int(new_pin))
        remaining_temp.discard(old)
        person.biometric_user_id = new_pin
        punches_moved += await remap_truncated_punches(db, old, new_pin)
        for trunc in temp_truncations(old):
            collision = any(
                other == trunc or other.startswith(trunc)
                for other in remaining_temp
            )
            if collision:
                continue
            punches_moved += await remap_truncated_punches(db, trunc, new_pin)
        converted += 1
    return {
        "converted": converted,
        "skipped_fingerprint": skipped_fingerprint,
        "punches_moved": punches_moved,
    }


def build_legacy_temp_pin_map(people: Sequence[object]) -> dict[str, str]:
    """Map old TEMP-* / truncated twins onto the current numeric Device PIN.

    Ambiguous aliases (two people sharing a 14-char twin) are dropped.
    """
    from app.seeding.personnel_normalize import cnic_digits

    grouped: dict[str, set[str]] = {}
    for person in people:
        current = normalize_pin(getattr(person, "biometric_user_id", ""))
        if not current or is_temp_pin(current):
            continue
        aliases: list[str] = []
        digits = cnic_digits(getattr(person, "cnic", None))
        if digits:
            full = f"TEMP-{digits}"
            aliases.append(full)
            aliases.extend(temp_truncations(full))
        belt = normalize_pin(getattr(person, "employee_code", "")).replace("/", "-")
        if belt:
            aliases.append(f"TEMP-{belt}")
        for alias in aliases:
            grouped.setdefault(alias, set()).add(current)
    return {alias: next(iter(pins)) for alias, pins in grouped.items() if len(pins) == 1}


def temp_users_safe_to_delete(
    device_users: Sequence[object],
    template_uids: set[int],
) -> list[object]:
    """TEMP-* device records that do not own a fingerprint template."""
    doomed: list[object] = []
    for user in device_users:
        pin = normalize_pin(getattr(user, "user_id", ""))
        uid = getattr(user, "uid", None)
        if not is_temp_pin(pin):
            continue
        if uid in template_uids:
            continue
        doomed.append(user)
    return doomed
