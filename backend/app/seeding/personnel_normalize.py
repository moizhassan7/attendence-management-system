"""Belt, name, platoon, and temporary biometric-id helpers."""

from __future__ import annotations

import re

from app.seeding.personnel_config import NAME_RANK_PREFIXES

_BELT_SWAP = re.compile(r"^(\d+)/([A-Z]+)$", re.IGNORECASE)
_BELT_NORMAL = re.compile(r"^([A-Z]+)/(\d+)$", re.IGNORECASE)
_NON_DIGIT = re.compile(r"\D+")


def is_platoon_department(raw: str | None) -> bool:
    return platoon_course_code(raw) is not None


def platoon_course_code(raw: str | None) -> str | None:
    """ZL* → Lower Level Course; other Z* → Basic Training Course."""
    compact = "".join(str(raw or "").split()).upper()
    if compact.startswith("ZL"):
        return "LLC"
    if compact.startswith("Z"):
        return "BTC"
    return None


def canonical_belt(raw: str | None) -> str:
    text = str(raw or "").strip().upper().replace(" ", "")
    if not text:
        return ""
    swapped = _BELT_SWAP.match(text)
    if swapped:
        return f"{swapped.group(2).upper()}/{swapped.group(1)}"
    return text


def belt_variants(raw: str | None) -> set[str]:
    text = str(raw or "").strip().upper().replace(" ", "")
    if not text:
        return set()
    variants = {text, canonical_belt(text)}
    normal = _BELT_NORMAL.match(text)
    if normal:
        variants.add(f"{normal.group(2)}/{normal.group(1).upper()}")
    swapped = _BELT_SWAP.match(text)
    if swapped:
        variants.add(f"{swapped.group(2).upper()}/{swapped.group(1)}")
        variants.add(text)
    return {v for v in variants if v}


def name_tokens(raw: str | None) -> frozenset[str]:
    words = re.findall(r"[A-Za-z]+", str(raw or "").upper())
    tokens: list[str] = []
    for word in words:
        if word in NAME_RANK_PREFIXES:
            continue
        if word in {"M", "MOHD", "MOHD."}:
            tokens.append("MUHAMMAD")
            continue
        tokens.append(word)
    return frozenset(tokens)


def cnic_digits(cnic: str | None) -> str:
    return _NON_DIGIT.sub("", str(cnic or ""))


def unmapped_biometric_id(cnic: str | None, belt: str | None = None) -> str:
    digits = cnic_digits(cnic)
    if digits:
        return f"TEMP-{digits}"
    belt_part = canonical_belt(belt).replace("/", "-")
    if belt_part:
        return f"TEMP-{belt_part}"
    return "TEMP-UNKNOWN"


def biometric_from_ac_no(ac_no: object) -> str:
    if ac_no is None:
        return ""
    if isinstance(ac_no, float) and ac_no.is_integer():
        return str(int(ac_no))
    text = str(ac_no).strip()
    if text.endswith(".0"):
        try:
            return str(int(float(text)))
        except ValueError:
            return text
    return text
