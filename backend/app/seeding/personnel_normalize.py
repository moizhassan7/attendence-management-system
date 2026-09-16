"""Belt, name, platoon, and temporary biometric-id helpers."""

from __future__ import annotations

import re

from app.seeding.personnel_config import (
    NAME_NOISE_TOKENS,
    NAME_PARTICLE_TOKENS,
    NAME_RANK_PREFIXES,
    NAME_TITLE_PREFIXES,
    NAME_TOKEN_ALIASES,
)

_BELT_SWAP = re.compile(r"^(\d+)/([A-Z]+)$", re.IGNORECASE)
_BELT_NORMAL = re.compile(r"^([A-Z]+)/(\d+)$", re.IGNORECASE)
_BELT_LETTER_NUM = re.compile(r"([A-Z]{1,4})\s*/\s*(\d+)", re.IGNORECASE)
_BELT_NUM_LETTER = re.compile(r"(\d+)\s*/\s*([A-Z]{1,4})", re.IGNORECASE)
_BELT_LETTER_SPACE_NUM = re.compile(r"^([A-Z]{1,4})\s+(\d+)$", re.IGNORECASE)
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


def extract_primary_belt(raw: str | None) -> str:
    """First real belt in messy device values like 'S/29 C/791' or 'F 261'."""
    text = str(raw or "").strip().upper()
    if not text or text in {"-", "N/A", "NA", "NONE", "NIL"}:
        return ""
    compact = re.sub(r"\s+", " ", text)
    letter_num = _BELT_LETTER_NUM.search(compact)
    if letter_num:
        return f"{letter_num.group(1).upper()}/{letter_num.group(2)}"
    num_letter = _BELT_NUM_LETTER.search(compact)
    if num_letter:
        return f"{num_letter.group(1)}/{num_letter.group(2).upper()}"
    spaced = _BELT_LETTER_SPACE_NUM.match(compact)
    if spaced:
        return f"{spaced.group(1).upper()}/{spaced.group(2)}"
    digits = re.sub(r"\s+", "", compact)
    if digits.isdigit():
        return digits
    return compact.replace(" ", "")


def canonical_belt(raw: str | None) -> str:
    text = extract_primary_belt(raw)
    if not text:
        return ""
    swapped = _BELT_SWAP.match(text)
    if swapped:
        return f"{swapped.group(2).upper()}/{swapped.group(1)}"
    return text


def belt_number(raw: str | None) -> str:
    belt = extract_primary_belt(raw)
    if belt.isdigit():
        return belt
    normal = _BELT_NORMAL.match(belt)
    if normal:
        return normal.group(2)
    swapped = _BELT_SWAP.match(belt)
    if swapped:
        return swapped.group(1)
    return ""


def belt_variants(raw: str | None) -> set[str]:
    text = extract_primary_belt(raw)
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


def strip_title_prefix(raw: str | None) -> str:
    text = re.sub(r"[/\-]+", " ", str(raw or ""))
    text = " ".join(text.split())
    upper = text.upper()
    for prefix in NAME_TITLE_PREFIXES:
        p = " ".join(prefix.upper().replace("/", " ").split())
        if upper == p:
            return ""
        if upper.startswith(f"{p} "):
            return text[len(p) :].strip()
    return text


def name_tokens(raw: str | None) -> frozenset[str]:
    words = re.findall(r"[A-Za-z]+", strip_title_prefix(raw).upper())
    tokens: list[str] = []
    for word in words:
        if word in NAME_NOISE_TOKENS or word in NAME_RANK_PREFIXES or word in NAME_PARTICLE_TOKENS:
            continue
        if word in {"M", "MOHD", "MOHD."}:
            tokens.append("MUHAMMAD")
            continue
        tokens.append(NAME_TOKEN_ALIASES.get(word, word))
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
