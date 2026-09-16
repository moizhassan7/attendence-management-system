"""Match emp_data rows to Nafri master rows and build seed dicts."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.seeding.personnel_config import (
    NAME_TITLE_PREFIXES,
    NON_UNIFORM_DEPARTMENT_CODES,
    category_for_department,
    category_for_record,
    department_for_civil_title,
    designation_label,
    is_civil_title,
)
from app.seeding.personnel_normalize import (
    belt_number,
    belt_variants,
    biometric_from_ac_no,
    name_tokens,
    platoon_course_code,
    unmapped_biometric_id,
)
from app.seeding.personnel_sources import EmpRecord, NafriRecord


@dataclass
class LinkedMatch:
    emp: EmpRecord
    nafri: NafriRecord
    method: str


@dataclass
class MatchReport:
    linked: list[LinkedMatch] = field(default_factory=list)
    unmatched_emp: list[EmpRecord] = field(default_factory=list)
    unmatched_nafri: list[NafriRecord] = field(default_factory=list)
    skipped_platoons: list[EmpRecord] = field(default_factory=list)


def _index_nafri_by_belt(nafri_rows: list[NafriRecord]) -> dict[str, set[int]]:
    index: dict[str, set[int]] = {}
    for i, rec in enumerate(nafri_rows):
        for variant in belt_variants(rec.belt_raw or rec.belt_canonical):
            index.setdefault(variant, set()).add(i)
    return index


def _unique_nafri_for_emp(emp: EmpRecord, belt_index: dict[str, set[int]], nafri_rows: list[NafriRecord]) -> int | None:
    hits: set[int] = set()
    for variant in belt_variants(emp.belt_canonical or emp.belt_raw):
        hits.update(belt_index.get(variant, set()))
    if len(hits) == 1:
        return next(iter(hits))
    emp_num = belt_number(emp.belt_canonical or emp.belt_raw)
    emp_belt = (emp.belt_canonical or emp.belt_raw or "").replace(" ", "")
    if emp_num and emp_belt.isdigit():
        numbered = [i for i, rec in enumerate(nafri_rows) if belt_number(rec.belt_raw) == emp_num]
        if len(numbered) == 1:
            return numbered[0]
    return None


def match_personnel(emp_rows: list[EmpRecord], nafri_rows: list[NafriRecord]) -> MatchReport:
    report = MatchReport()
    staff: list[EmpRecord] = []
    for emp in emp_rows:
        if emp.is_platoon:
            report.skipped_platoons.append(emp)
        else:
            staff.append(emp)

    belt_index = _index_nafri_by_belt(nafri_rows)
    used_emp: set[int] = set()
    linked_nafri: set[int] = set()

    for emp_i, emp in enumerate(staff):
        nafri_i = _unique_nafri_for_emp(emp, belt_index, nafri_rows)
        if nafri_i is None:
            continue
        report.linked.append(LinkedMatch(emp=emp, nafri=nafri_rows[nafri_i], method="belt"))
        used_emp.add(emp_i)
        linked_nafri.add(nafri_i)

    remaining_emp = [emp for i, emp in enumerate(staff) if i not in used_emp]
    remaining_nafri_idx = [i for i in range(len(nafri_rows)) if i not in linked_nafri]

    nafri_by_tokens: dict[frozenset[str], list[int]] = {}
    for i in remaining_nafri_idx:
        tokens = name_tokens(nafri_rows[i].full_name)
        if not tokens:
            continue
        nafri_by_tokens.setdefault(tokens, []).append(i)

    still_unmatched: list[EmpRecord] = []
    for emp in remaining_emp:
        tokens = name_tokens(emp.name)
        candidates = nafri_by_tokens.get(tokens, [])
        if emp.department_code in NON_UNIFORM_DEPARTMENT_CODES:
            candidates = [i for i in candidates if is_civil_title(nafri_rows[i].rank_name)]
        elif emp.department_code:
            candidates = [i for i in candidates if not is_civil_title(nafri_rows[i].rank_name)]
        if len(candidates) == 1:
            nafri_i = candidates[0]
            report.linked.append(LinkedMatch(emp=emp, nafri=nafri_rows[nafri_i], method="name"))
            linked_nafri.add(nafri_i)
            remaining_nafri_idx = [i for i in remaining_nafri_idx if i != nafri_i]
        else:
            still_unmatched.append(emp)

    leftover: list[EmpRecord] = []
    remaining_nafri_idx = [i for i in range(len(nafri_rows)) if i not in linked_nafri]
    for emp in still_unmatched:
        nafri_i = _unique_fuzzy_name_match(emp, remaining_nafri_idx, nafri_rows)
        if nafri_i is None:
            leftover.append(emp)
            continue
        report.linked.append(LinkedMatch(emp=emp, nafri=nafri_rows[nafri_i], method="name_overlap"))
        linked_nafri.add(nafri_i)
        remaining_nafri_idx = [i for i in remaining_nafri_idx if i != nafri_i]

    report.unmatched_emp = leftover
    report.unmatched_nafri = [nafri_rows[i] for i in range(len(nafri_rows)) if i not in linked_nafri]
    return report


def _unique_fuzzy_name_match(emp: EmpRecord, remaining: list[int], nafri_rows: list[NafriRecord]) -> int | None:
    emp_tokens = name_tokens(emp.name)
    if len(emp_tokens) < 2:
        return None
    pool = remaining
    if emp.department_code in NON_UNIFORM_DEPARTMENT_CODES:
        pool = [i for i in remaining if is_civil_title(nafri_rows[i].rank_name)]
    elif emp.department_code:
        pool = [i for i in remaining if not is_civil_title(nafri_rows[i].rank_name)]
    scored: list[tuple[int, int]] = []
    for i in pool:
        other = name_tokens(nafri_rows[i].full_name)
        if not other:
            continue
        if emp_tokens == other:
            scored.append((3, i))
            continue
        if emp_tokens <= other or other <= emp_tokens:
            scored.append((2, i))
            continue
        overlap = emp_tokens & other
        if len(overlap) >= 2:
            scored.append((1, i))
    if not scored:
        return None
    best = max(score for score, _ in scored)
    tops = [i for score, i in scored if score == best]
    if len(tops) == 1:
        return tops[0]
    return None


def _emp_ac_str(emp: EmpRecord) -> str:
    return biometric_from_ac_no(emp.ac_no)


def _emp_preference(emp: EmpRecord, rank_name: str | None = None) -> tuple[int, int]:
    """Prefer the matching wing: civil→ministerial/class-IV, uniform→uniform departments."""
    code = emp.department_code or ""
    civil = is_civil_title(rank_name)
    if code == "SECURITY":
        dept_score = 3
    elif civil and code in NON_UNIFORM_DEPARTMENT_CODES:
        dept_score = 4
    elif not civil and code in NON_UNIFORM_DEPARTMENT_CODES:
        dept_score = 0
    elif code and code != "PTS_SARGODHA":
        dept_score = 2
    elif code:
        dept_score = 1
    else:
        dept_score = 0
    pin = _emp_ac_str(emp)
    pin_sort = int(pin) if pin.isdigit() else 10**9
    return (dept_score, -pin_sort)


def _pick_emp(links: list[LinkedMatch]) -> LinkedMatch:
    return max(links, key=lambda link: _emp_preference(link.emp, link.nafri.rank_name))


def _record_from_nafri(nafri: NafriRecord, emp: EmpRecord | None = None, method: str | None = None) -> dict:
    department_code = emp.department_code if emp else None
    department_name = emp.department_name if emp else None
    civil = is_civil_title(nafri.rank_name)
    if civil:
        inferred = department_for_civil_title(nafri.rank_name)
        if inferred and department_code not in NON_UNIFORM_DEPARTMENT_CODES:
            department_code, department_name = inferred
    elif department_code in NON_UNIFORM_DEPARTMENT_CODES:
        department_code, department_name = None, None
    belt = nafri.belt_raw or (emp.belt_raw if emp else None)
    category = category_for_record(department_code, nafri.rank_name)
    if civil:
        category = "Non-Uniform"
    return {
        "biometric_user_id": unmapped_biometric_id(nafri.cnic, belt),
        "employee_code": belt,
        "full_name": nafri.full_name,
        "rank_name": None if civil else (nafri.rank_name or None),
        "designation": designation_label(nafri.rank_name) if civil else None,
        "cnic": nafri.cnic or None,
        "gender": nafri.gender or "Male",
        "department_code": department_code,
        "department_name": department_name,
        "category": category,
        "duty_type": "Security" if department_code == "SECURITY" else None,
        "match_method": method,
        "temp_biometric": True,
    }


_EMP_RANK_PREFIX = {
    "IP": "Inspector",
    "INSP": "Inspector",
    "SI": "SUB INSPECTOR",
    "ASI": "ASI",
    "HC": "HEAD CONSTABLE",
    "LC": "LADY HC",
    "FC": "Constable",
    "CT": "Constable",
    "BC": "BAND CONSTABLE",
}


def _rank_from_emp_name(name: str) -> str | None:
    words = re.findall(r"[A-Za-z]+", str(name or "").upper())
    if not words:
        return None
    return _EMP_RANK_PREFIX.get(words[0])


def _designation_from_emp_name(name: str) -> str | None:
    text = " ".join(str(name or "").replace("/", " ").replace("-", " ").split())
    upper = text.upper()
    for prefix in NAME_TITLE_PREFIXES:
        p = " ".join(prefix.upper().split())
        if upper == p or upper.startswith(f"{p} "):
            return designation_label(prefix)
    return None


def _record_from_unmatched_emp(emp: EmpRecord) -> dict:
    bio = biometric_from_ac_no(emp.ac_no)
    designation = _designation_from_emp_name(emp.name)
    female = "BIBI" in (emp.name or "").upper() or "LADY" in (emp.name or "").upper()
    category = category_for_department(emp.department_code)
    if designation:
        category = "Non-Uniform"
    return {
        "biometric_user_id": bio,
        "employee_code": emp.belt_raw or None,
        "full_name": emp.name.strip(),
        "rank_name": None if designation else _rank_from_emp_name(emp.name),
        "designation": designation,
        "cnic": None,
        "gender": "Female" if female else "Male",
        "department_code": emp.department_code,
        "department_name": emp.department_name,
        "category": category,
        "duty_type": "Security" if emp.department_code == "SECURITY" else None,
        "match_method": "emp_unmatched",
        "temp_biometric": False,
    }


def build_canonical_records(report: MatchReport) -> list[dict]:
    """One Nafri person per row, plus unmatched ministerial/class-IV device staff."""
    by_nafri: dict[int, list[LinkedMatch]] = {}
    for link in report.linked:
        by_nafri.setdefault(id(link.nafri), []).append(link)

    rows = []
    for links in by_nafri.values():
        link = _pick_emp(links)
        rows.append(_record_from_nafri(link.nafri, emp=link.emp, method=link.method))
    rows.extend(_record_from_nafri(nafri) for nafri in report.unmatched_nafri)
    seen_bios = {row["biometric_user_id"] for row in rows}
    for emp in report.unmatched_emp:
        if not emp.department_code or emp.department_code == "PTS_SARGODHA":
            continue
        extra = _record_from_unmatched_emp(emp)
        if not extra["biometric_user_id"] or extra["biometric_user_id"] in seen_bios:
            continue
        if not extra["full_name"]:
            continue
        seen_bios.add(extra["biometric_user_id"])
        rows.append(extra)
    return [row for row in rows if row["biometric_user_id"] and row["full_name"]]


def build_trainee_records(emp_rows: list[EmpRecord]) -> list[dict]:
    """Z* platoons → Basic Training; ZL* platoons → Lower Level. Device PIN kept."""
    rows: list[dict] = []
    seen: set[str] = set()
    for emp in emp_rows:
        course_code = platoon_course_code(emp.department_raw)
        if not course_code:
            continue
        bio = biometric_from_ac_no(emp.ac_no)
        if not bio or bio in seen or not (emp.name or "").strip():
            continue
        seen.add(bio)
        rows.append(
            {
                "biometric_user_id": bio,
                "employee_code": emp.belt_raw or None,
                "full_name": emp.name.strip(),
                "course_code": course_code,
                "is_trainee": True,
                "category": "Trainee",
            }
        )
    return rows
