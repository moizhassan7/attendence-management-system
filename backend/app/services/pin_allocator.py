"""Allocate the next free ZKTeco device PIN (User ID) from configured ranges."""

from __future__ import annotations


def parse_numeric_pin(value: object | None) -> int | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text.isdigit():
        return None
    return int(text)


def next_numeric_pin(used: set[int], start: int, end: int | None = None) -> int:
    """Return the smallest unused PIN in [start, end], filling gaps first."""
    candidate = max(1, start)
    limit = end if end is not None else candidate + 100_000
    while candidate <= limit:
        if candidate not in used:
            return candidate
        candidate += 1
    raise ValueError("No free device PIN left in this range")
