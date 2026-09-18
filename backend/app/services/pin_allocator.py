"""Allocate unique numeric ZKTeco device PINs (User IDs)."""

from __future__ import annotations

from collections.abc import Iterable

# Terminal keypad / User ID field. TEMP-<CNIC> exceeded this and created twins.
MAX_DEVICE_PIN_DIGITS = 14


def is_temp_pin(value: object | None) -> bool:
    return str(value or "").strip().upper().startswith("TEMP")


def parse_numeric_pin(value: object | None) -> int | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text.isdigit():
        return None
    return int(text)


def require_numeric_device_pin(value: object | None, *, max_digits: int = MAX_DEVICE_PIN_DIGITS) -> str:
    """Return a digits-only PIN or raise. TEMP / text / over-width IDs are rejected."""
    if is_temp_pin(value):
        raise ValueError("Device PIN must be numeric; TEMP IDs are not allowed")
    pin = parse_numeric_pin(value)
    if pin is None:
        raise ValueError("Device PIN must be numeric")
    text = str(pin)
    if len(text) > max_digits:
        raise ValueError(f"Device PIN cannot exceed {max_digits} digits")
    return text


def used_numeric_pins(raw_pins: Iterable[object]) -> set[int]:
    used: set[int] = set()
    for raw in raw_pins:
        pin = parse_numeric_pin(raw)
        if pin is not None:
            used.add(pin)
    return used


def next_numeric_pin(used: set[int], start: int, end: int | None = None) -> int:
    """Return the smallest unused PIN in [start, end], filling gaps first."""
    candidate = max(1, start)
    limit = end if end is not None else candidate + 100_000
    while candidate <= limit:
        if candidate not in used:
            return candidate
        candidate += 1
    raise ValueError("No free device PIN left in this range")
