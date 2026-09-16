"""Load emp_data.xls and Punjab Police Nafri Excel rows."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, time
from pathlib import Path

import pandas as pd

from app.seeding.personnel_config import EMP_DATA_PATH, NAFRI_PATH, resolve_department
from app.seeding.personnel_normalize import biometric_from_ac_no, canonical_belt, is_platoon_department


@dataclass(frozen=True)
class EmpRecord:
    row_index: int
    ac_no: int | str
    belt_raw: str
    belt_canonical: str
    name: str
    on_duty_raw: str | None
    on_duty: time | None
    department_raw: str
    department_code: str | None
    department_name: str | None
    is_platoon: bool


@dataclass(frozen=True)
class NafriRecord:
    row_index: int
    full_name: str
    gender: str
    rank_name: str
    cnic: str
    belt_raw: str
    belt_canonical: str
    dob: date | None
    status: str | None
    posted_as: str | None
    ps_unit: str | None


def _cell(value: object) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    text = str(value).strip()
    if text.lower() == "nan":
        return ""
    return text


def _ac_no_value(value: object) -> int | str:
    text = biometric_from_ac_no(value)
    if text.isdigit():
        return int(text)
    return text


def load_emp_data(path: Path | None = None) -> list[EmpRecord]:
    file_path = path or EMP_DATA_PATH
    df = pd.read_excel(file_path, engine="xlrd")
    records: list[EmpRecord] = []
    for idx, row in df.iterrows():
        dept_raw = _cell(row.get("Department"))
        resolved = resolve_department(dept_raw)
        belt_raw = _cell(row.get("No."))
        records.append(
            EmpRecord(
                row_index=int(idx),
                ac_no=_ac_no_value(row.get("AC-No.")),
                belt_raw=belt_raw,
                belt_canonical=canonical_belt(belt_raw),
                name=_cell(row.get("Name")),
                on_duty_raw=_cell(row.get("On duty")) or None,
                on_duty=None,
                department_raw=dept_raw,
                department_code=resolved[0] if resolved else None,
                department_name=resolved[1] if resolved else (dept_raw or None),
                is_platoon=is_platoon_department(dept_raw),
            )
        )
    return records


def load_nafri_master(path: Path | None = None) -> list[NafriRecord]:
    file_path = path or NAFRI_PATH
    df = pd.read_excel(file_path, engine="openpyxl")
    belt_col = "Belt/ Emp No" if "Belt/ Emp No" in df.columns else "Belt"
    nic_col = "NIC" if "NIC" in df.columns else "CNIC"
    records: list[NafriRecord] = []
    for idx, row in df.iterrows():
        name = _cell(row.get("Name"))
        if not name:
            continue
        belt_raw = _cell(row.get(belt_col))
        records.append(
            NafriRecord(
                row_index=int(idx),
                full_name=name,
                gender=_cell(row.get("Gender")) or "Male",
                rank_name=_cell(row.get("Rank")),
                cnic=_cell(row.get(nic_col)),
                belt_raw=belt_raw,
                belt_canonical=canonical_belt(belt_raw),
                dob=None,
                status=_cell(row.get("Status")) or None,
                posted_as=_cell(row.get("Posted As")) or None,
                ps_unit=_cell(row.get("PS/Unit")) or None,
            )
        )
    return records
