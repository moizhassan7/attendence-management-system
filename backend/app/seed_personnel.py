"""Seed departments, ranks, and personnel from emp_data.xls + Nafri Excel."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Iterable

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.settings import DEFAULT_SETTINGS
from app.database import async_session_factory, init_db
from app.models.attendance import AttendanceDaily
from app.models.course import Course
from app.models.department import Department
from app.models.exception import AttendanceException
from app.models.personnel import Personnel
from app.models.rank import Rank
from app.models.settings import SystemSetting
from app.models.shift import Shift
from app.seeding.personnel_config import COURSE_BASIC, COURSE_LOWER, RANK_ORDER, designation_label, is_civil_title, make_code
from app.seeding.personnel_match import MatchReport, build_canonical_records, build_trainee_records, match_personnel
from app.seeding.personnel_normalize import cnic_digits
from app.seeding.personnel_sources import EmpRecord, NafriRecord, load_emp_data, load_nafri_master
from app.services.pin_allocator import is_temp_pin, next_numeric_pin, parse_numeric_pin

logger = logging.getLogger(__name__)


def departments_from_emp(emp_rows: Iterable[EmpRecord]) -> list[tuple[str, str]]:
    seen: dict[str, str] = {
        "MINISTERIAL": "Ministerial Staff",
        "CLASS_IV": "Class IV",
    }
    for emp in emp_rows:
        if emp.is_platoon:
            continue
        code = emp.department_code
        name = emp.department_name
        if not code and emp.department_raw:
            name = emp.department_raw.strip()
            code = make_code(name)
        if not code or not name:
            continue
        seen.setdefault(code, name)
    return sorted(seen.items(), key=lambda item: item[0])


def ranks_from_nafri(nafri_rows: Iterable[NafriRecord]) -> list[tuple[str, str, int]]:
    order_index = {name.upper(): i for i, name in enumerate(RANK_ORDER)}
    canonical_name = {name.upper(): name for name in RANK_ORDER}
    by_name: dict[str, str] = {}
    used_codes: set[str] = set()
    for rec in nafri_rows:
        name = (rec.rank_name or "").strip()
        if not name:
            continue
        key = name.upper()
        if is_civil_title(name):
            continue
        if key in by_name:
            continue
        code = make_code(name)
        base = code
        suffix = 2
        while code in used_codes:
            tail = f"_{suffix}"
            code = f"{base[: 20 - len(tail)]}{tail}"
            suffix += 1
        used_codes.add(code)
        by_name[key] = code
    rows: list[tuple[str, str, int]] = []
    for display_name, code in by_name.items():
        # display_name is uppercased key; recover original from first matching row
        original = next(r.rank_name.strip() for r in nafri_rows if (r.rank_name or "").strip().upper() == display_name)
        name = canonical_name.get(display_name, original)
        sort_order = order_index.get(display_name, 100)
        rows.append((name, code, sort_order))
    rows.sort(key=lambda item: (item[2], item[0]))
    return rows


async def _upsert_departments(db: AsyncSession, departments: list[tuple[str, str]]) -> dict[str, int]:
    existing = {row.code: row for row in (await db.execute(select(Department))).scalars()}
    ids: dict[str, int] = {}
    for code, name in departments:
        row = existing.get(code)
        if row is None:
            row = Department(code=code, name=name, active=True)
            db.add(row)
            await db.flush()
            existing[code] = row
            logger.info("Created department %s (%s)", code, name)
        else:
            if row.name != name:
                row.name = name
            row.active = True
        ids[code] = row.id
    return ids


async def _upsert_ranks(db: AsyncSession, ranks: list[tuple[str, str, int]]) -> dict[str, int]:
    existing_by_code = {row.code: row for row in (await db.execute(select(Rank))).scalars()}
    existing_by_name = {row.name.strip().upper(): row for row in existing_by_code.values()}
    ids: dict[str, int] = {}
    for name, code, sort_order in ranks:
        row = existing_by_name.get(name.strip().upper()) or existing_by_code.get(code)
        if row is None:
            row = Rank(name=name, code=code, sort_order=sort_order, active=True)
            db.add(row)
            await db.flush()
            existing_by_code[row.code] = row
            existing_by_name[name.strip().upper()] = row
            logger.info("Created rank %s (%s)", code, name)
        else:
            row.name = name
            row.sort_order = sort_order
            row.active = True
        ids[name.strip().upper()] = row.id
    return ids


async def _upsert_personnel(
    db: AsyncSession,
    records: list[dict],
    department_ids: dict[str, int],
    rank_ids: dict[str, int],
) -> tuple[int, int, set[str]]:
    existing_rows = list((await db.execute(select(Personnel))).scalars())
    existing = {row.biometric_user_id: row for row in existing_rows}
    by_cnic: dict[str, Personnel] = {}
    for row in existing_rows:
        digits = cnic_digits(row.cnic)
        if digits:
            by_cnic.setdefault(digits, row)
    used_pins = {
        pin
        for row in existing_rows
        if (pin := parse_numeric_pin(row.biometric_user_id)) is not None
    }
    created = 0
    updated = 0
    seen_bio: set[str] = set()
    for rec in records:
        bio = rec["biometric_user_id"]
        cnic_key = cnic_digits(rec.get("cnic"))
        row = existing.get(bio) if bio else None
        if row is None and cnic_key:
            row = by_cnic.get(cnic_key)
        if row is None:
            if not bio or is_temp_pin(bio) or parse_numeric_pin(bio) is None:
                bio = str(next_numeric_pin(used_pins, 2001))
            pin_n = parse_numeric_pin(bio)
            if pin_n is not None:
                used_pins.add(pin_n)
            if bio in seen_bio:
                continue
            seen_bio.add(bio)
        else:
            bio = row.biometric_user_id
            if is_temp_pin(bio) or parse_numeric_pin(bio) is None:
                bio = str(next_numeric_pin(used_pins, 2001))
                row.biometric_user_id = bio
            pin_n = parse_numeric_pin(bio)
            if pin_n is not None:
                used_pins.add(pin_n)
            if bio in seen_bio:
                continue
            seen_bio.add(bio)
        rank_key = (rec.get("rank_name") or "").strip().upper()
        dept_code = rec.get("department_code")
        designation = rec.get("designation")
        payload = {
            "employee_code": rec.get("employee_code"),
            "full_name": rec["full_name"],
            "rank_id": None if designation else rank_ids.get(rank_key),
            "designation": designation,
            "department_id": department_ids.get(dept_code) if dept_code else None,
            "category": rec.get("category") or "Uniform",
            "employment_status": "Active",
            "gender": rec.get("gender") or "Male",
            "cnic": rec.get("cnic"),
            "duty_type": rec.get("duty_type"),
            "is_trainee": False,
        }
        if row is None:
            person = Personnel(biometric_user_id=bio, **payload)
            db.add(person)
            existing[bio] = person
            if cnic_key:
                by_cnic.setdefault(cnic_key, person)
            created += 1
        else:
            for key, value in payload.items():
                setattr(row, key, value)
            updated += 1
    return created, updated, seen_bio


async def _remove_non_nafri_personnel(db: AsyncSession, keep_bios: set[str]) -> int:
    extras = (
        await db.execute(
            select(Personnel).where(
                Personnel.is_trainee.is_(False),
                Personnel.biometric_user_id.not_in(keep_bios),
            )
        )
    ).scalars().all()
    if not extras:
        return 0
    ids = [row.id for row in extras]
    await db.execute(delete(AttendanceDaily).where(AttendanceDaily.personnel_id.in_(ids)))
    await db.execute(delete(AttendanceException).where(AttendanceException.personnel_id.in_(ids)))
    await db.execute(delete(Personnel).where(Personnel.id.in_(ids)))
    logger.info("Removed %s personnel rows that are not on the Nafri 288 roster", len(ids))
    return len(ids)


def _merge_designation_names(*groups: Iterable[str]) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for group in groups:
        for raw in group:
            name = (raw or "").strip()
            if not name:
                continue
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)
            merged.append(name)
    return merged


async def _upsert_designations(db: AsyncSession, extra_names: Iterable[str]) -> list[str]:
    default_raw, _, desc = DEFAULT_SETTINGS["civil_designations"]
    defaults = json.loads(default_raw)
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == "civil_designations"))
    setting = result.scalar_one_or_none()
    existing: list[str] = []
    if setting and setting.value:
        try:
            existing = json.loads(setting.value)
        except json.JSONDecodeError:
            existing = []
    merged = _merge_designation_names(defaults, extra_names, existing)
    payload = json.dumps(merged)
    if setting is None:
        db.add(
            SystemSetting(
                key="civil_designations",
                value=payload,
                value_type="json",
                description=desc,
            )
        )
    else:
        setting.value = payload
        setting.value_type = "json"
    logger.info("Saved %s civil designations", len(merged))
    return merged


async def _delete_non_uniform_ranks(db: AsyncSession, keep_rank_ids: set[int]) -> int:
    all_ranks = (await db.execute(select(Rank))).scalars().all()
    extras = [row for row in all_ranks if row.id not in keep_rank_ids]
    if not extras:
        return 0
    extra_ids = [row.id for row in extras]
    extra_by_id = {row.id: row for row in extras}
    personnel_rows = (
        await db.execute(select(Personnel).where(Personnel.rank_id.in_(extra_ids)))
    ).scalars().all()
    for person in personnel_rows:
        rank = extra_by_id.get(person.rank_id) if person.rank_id else None
        if not person.designation and rank:
            person.designation = designation_label(rank.name)
            person.category = "Non-Uniform"
        person.rank_id = None
    await db.flush()
    await db.execute(delete(Rank).where(Rank.id.in_(extra_ids)))
    logger.info("Deleted %s non-uniform / leftover ranks", len(extra_ids))
    return len(extra_ids)


async def _upsert_courses(db: AsyncSession) -> dict[str, int]:
    ids: dict[str, int] = {}
    for code, name in (COURSE_BASIC, COURSE_LOWER):
        row = (await db.execute(select(Course).where(Course.code == code))).scalar_one_or_none()
        if row is None:
            row = (await db.execute(select(Course).where(Course.name == name))).scalar_one_or_none()
        if row is None:
            row = Course(name=name, code=code, active=True)
            db.add(row)
            await db.flush()
            logger.info("Created course %s (%s)", code, name)
        else:
            row.name = name
            row.code = code
            row.active = True
        ids[code] = row.id
    return ids


async def _trainee_shift_id(db: AsyncSession) -> int | None:
    row = (await db.execute(select(Shift).where(Shift.name == "Trainee Shift"))).scalar_one_or_none()
    return row.id if row else None


async def _upsert_trainees(
    db: AsyncSession,
    records: list[dict],
    course_ids: dict[str, int],
    shift_id: int | None,
) -> tuple[int, int, set[str]]:
    existing = {row.biometric_user_id: row for row in (await db.execute(select(Personnel))).scalars()}
    created = 0
    updated = 0
    seen: set[str] = set()
    for rec in records:
        bio = rec["biometric_user_id"]
        if is_temp_pin(bio) or parse_numeric_pin(bio) is None:
            continue
        if not bio or bio in seen:
            continue
        seen.add(bio)
        payload = {
            "employee_code": rec.get("employee_code"),
            "full_name": rec["full_name"],
            "rank_id": None,
            "designation": None,
            "department_id": None,
            "category": "Trainee",
            "duty_type": None,
            "employment_status": "Active",
            "is_trainee": True,
            "course_id": course_ids.get(rec["course_code"]),
            "shift_id": shift_id,
        }
        row = existing.get(bio)
        if row is None:
            db.add(Personnel(biometric_user_id=bio, **payload))
            created += 1
        else:
            for key, value in payload.items():
                setattr(row, key, value)
            updated += 1
    return created, updated, seen


async def _remove_extra_trainees(db: AsyncSession, keep_bios: set[str]) -> int:
    extras = [
        row
        for row in (await db.execute(select(Personnel).where(Personnel.is_trainee.is_(True)))).scalars().all()
        if row.biometric_user_id not in keep_bios
    ]
    if not extras:
        return 0
    ids = [row.id for row in extras]
    await db.execute(delete(AttendanceDaily).where(AttendanceDaily.personnel_id.in_(ids)))
    await db.execute(delete(AttendanceException).where(AttendanceException.personnel_id.in_(ids)))
    await db.execute(delete(Personnel).where(Personnel.id.in_(ids)))
    logger.info("Removed %s trainee rows not in emp_data platoons", len(ids))
    return len(ids)


async def seed_personnel() -> MatchReport:
    await init_db()
    emp_rows = load_emp_data()
    nafri_rows = load_nafri_master()
    report = match_personnel(emp_rows, nafri_rows)
    records = build_canonical_records(report)
    trainee_records = build_trainee_records(emp_rows)

    async with async_session_factory() as db:
        department_ids = await _upsert_departments(db, departments_from_emp(emp_rows))
        rank_ids = await _upsert_ranks(db, ranks_from_nafri(nafri_rows))
        designations = await _upsert_designations(
            db,
            [rec["designation"] for rec in records if rec.get("designation")],
        )
        created, updated, keep_bios = await _upsert_personnel(db, records, department_ids, rank_ids)
        removed = await _remove_non_nafri_personnel(db, keep_bios)
        await _delete_non_uniform_ranks(db, set(rank_ids.values()))
        course_ids = await _upsert_courses(db)
        t_created, t_updated, trainee_bios = await _upsert_trainees(
            db, trainee_records, course_ids, await _trainee_shift_id(db)
        )
        t_removed = await _remove_extra_trainees(db, trainee_bios)
        await db.commit()

    logger.info(
        "Personnel seed complete: staff=%s trainees=%s (created=%s updated=%s) "
        "basic=%s lower=%s",
        len(records),
        len(trainee_records),
        t_created,
        t_updated,
        sum(1 for rec in trainee_records if rec["course_code"] == "BTC"),
        sum(1 for rec in trainee_records if rec["course_code"] == "LLC"),
    )
    return report


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    report = asyncio.run(seed_personnel())
    records = build_canonical_records(report)
    trainees = build_trainee_records(report.skipped_platoons)
    print(
        "\n".join(
            [
                "Personnel seed finished.",
                f"  Nafri staff: {len(records)}",
                f"  Trainees: {len(trainees)}",
                f"  Basic Training Course: {sum(1 for rec in trainees if rec['course_code'] == 'BTC')}",
                f"  Lower Level Course: {sum(1 for rec in trainees if rec['course_code'] == 'LLC')}",
                f"  Uniform staff: {sum(1 for rec in records if rec['category'] == 'Uniform')}",
                f"  Non-Uniform staff: {sum(1 for rec in records if rec['category'] == 'Non-Uniform')}",
            ]
        )
    )


if __name__ == "__main__":
    main()
