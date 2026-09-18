"""Match ZKTeco device PINs to personnel biometric IDs.

These terminals have a PIN width (commonly 9–14 characters). Pushing a longer
ID such as TEMP-{13-digit CNIC} (18 chars) creates a truncated twin on the
device. Fingerprints and punches land on that truncated PIN, so exact-string
matching misses them.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence

# Prefixes like TEMP-38 must not match a full PIN.
MIN_TRUNCATED_PIN_LEN = 9
# CMD_USER_WRQ packs user_id into a 24-byte field, and the ZLM60 terminals store
# the full 18-char TEMP-<CNIC> PIN intact.
DEVICE_PIN_WIDTH = 24
# Earlier releases truncated to 14, so those twin records still sit on the
# terminals and own historical punches. Keep matching them.
LEGACY_DEVICE_PIN_WIDTH = 14
DEFAULT_DEVICE_PIN_WIDTH = DEVICE_PIN_WIDTH


def normalize_pin(value: object | None) -> str:
    return str(value or "").strip()


def device_enroll_pin(personnel_pin: str, pin_width: int = DEVICE_PIN_WIDTH) -> str:
    """PIN actually stored on the terminal (only over-width IDs are truncated)."""
    pin = normalize_pin(personnel_pin)
    width = max(1, pin_width)
    if len(pin) > width:
        return pin[:width]
    return pin


def candidate_device_pins(personnel_pin: str) -> list[str]:
    """Personnel PIN plus the truncated forms the terminal may punch under."""
    pin = normalize_pin(personnel_pin)
    if not pin:
        return []
    pins = [pin]
    for width in (DEVICE_PIN_WIDTH, LEGACY_DEVICE_PIN_WIDTH):
        truncated = device_enroll_pin(pin, width)
        if truncated and truncated not in pins:
            pins.append(truncated)
    return pins


def pins_equivalent(device_pin: str, personnel_pin: str) -> bool:
    """True when the device user_id is the personnel PIN or a truncation of it."""
    device = normalize_pin(device_pin)
    person = normalize_pin(personnel_pin)
    if not device or not person:
        return False
    if device == person:
        return True
    return (
        len(device) >= MIN_TRUNCATED_PIN_LEN
        and len(device) < len(person)
        and person.startswith(device)
    )


def resolve_personnel_pin(device_pin: str, personnel_pins: Iterable[str]) -> str | None:
    """Return the unique personnel PIN for a device user_id, if any."""
    device = normalize_pin(device_pin)
    if not device:
        return None
    pins = [normalize_pin(pin) for pin in personnel_pins if normalize_pin(pin)]
    exact = next((pin for pin in pins if pin == device), None)
    if exact is not None:
        return exact
    truncated = [pin for pin in pins if pins_equivalent(device, pin)]
    if len(truncated) == 1:
        return truncated[0]
    return None


def personnel_has_device_fingerprint(
    personnel_pin: str,
    device_users: Sequence[object],
    template_uids: set[int],
) -> bool:
    pin = normalize_pin(personnel_pin)
    if not pin or not template_uids:
        return False
    for user in device_users:
        uid = getattr(user, "uid", None)
        user_id = normalize_pin(getattr(user, "user_id", ""))
        if uid in template_uids and pins_equivalent(user_id, pin):
            return True
    return False
