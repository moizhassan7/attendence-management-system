"""Match emp_data rows to Nafri master rows and build seed dicts."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.seeding.personnel_config import (
    category_for_record,
    designation_label,
    is_civil_title,
)
from app.seeding.personnel_normalize import (
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


def _unique_nafri_for_emp(emp: EmpRecord, belt_index: dict[str, set[int]]) -> int | None:
    hits: set[int] = set()
    for variant in belt_variants(emp.belt_raw or emp.belt_canonical):
        hits.update(belt_index.get(variant, set()))
    if len(hits) == 1:
        return next(iter(hits))
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
        nafri_i = _unique_nafri_for_emp(emp, belt_index)
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
        if len(candidates) == 1:
            nafri_i = candidates[0]
            report.linked.append(LinkedMatch(emp=emp, nafri=nafri_rows[nafri_i], method="name"))
            linked_nafri.add(nafri_i)
        else:
            still_unmatched.append(emp)

    report.unmatched_emp = still_unmatched
    report.unmatched_nafri = [nafri_rows[i] for i in range(len(nafri_rows)) if i not in linked_nafri]
    return report


def _emp_ac_str(emp: EmpRecord) -> str:
    return biometric_from_ac_no(emp.ac_no)


def _emp_preference(emp: EmpRecord) -> tuple[int, int]:
    """Prefer a real staff department over PTS; then a lower device PIN."""
    code = emp.department_code or ""
    dept_score = 2 if code and code != "PTS_SARGODHA" else (1 if code else 0)
    pin = _emp_ac_str(emp)
    pin_sort = int(pin) if pin.isdigit() else 10**9
    return (dept_score, -pin_sort)


def _pick_emp(links: list[LinkedMatch]) -> LinkedMatch:
    return max(links, key=lambda link: _emp_preference(link.emp))


def _record_from_nafri(nafri: NafriRecord, emp: EmpRecord | None = None, method: str | None = None) -> dict:
    department_code = emp.department_code if emp else None
    department_name = emp.department_name if emp else None
    belt = nafri.belt_raw or (emp.belt_raw if emp else None)
    category = category_for_record(department_code, nafri.rank_name)
    civil = is_civil_title(nafri.rank_name)
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


def build_canonical_records(report: MatchReport) -> list[dict]:
    """One Nafri person per row. Device PINs (AC-No.) are never stored."""
    by_nafri: dict[int, list[LinkedMatch]] = {}
    for link in report.linked:
        by_nafri.setdefault(id(link.nafri), []).append(link)

    rows = []
    for links in by_nafri.values():
        link = _pick_emp(links)
        rows.append(_record_from_nafri(link.nafri, emp=link.emp, method=link.method))
    rows.extend(_record_from_nafri(nafri) for nafri in report.unmatched_nafri)
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
