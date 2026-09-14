"""
Uniform Staff Data Preprocessor & Seeder
=========================================
Reads Punjab Police Nafri (288 persons) + emp_data.xls (device enrollments),
matches them by Belt/Badge number, then seeds:
  - Departments
  - Ranks
  - Personnel (Uniform staff only, no trainees)

And DELETES all existing Personnel, Rank, Department, Attendance data first.
"""

from __future__ import annotations

import asyncio
import logging
import re
import pandas as pd
from datetime import date
from typing import Optional

from sqlalchemy import delete, select

from app.database import async_session_factory, init_db
from app.models.attendance import AttendanceRecord
from app.models.personnel import Personnel
from app.models.rank import Rank
from app.models.department import Department
from app.models.exception import ExceptionRequest

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------------------
# STEP 1: Load and Preprocess Excel Data
# ------------------------------------------------------------------------------

def normalize_belt(b) -> Optional[str]:
    """Normalize belt/badge number for matching."""
    if pd.isna(b) or str(b).strip() in ('', 'nan', 'NaN'):
        return None
    return str(b).strip().upper().replace(' ', '')


def load_and_preprocess():
    """
    Loads both Excel files, matches by Belt number, builds final personnel list.
    Returns a list of dicts ready for DB seeding.
    """
    logger.info("Loading Punjab Police Nafri (288) data...")
    nafri = pd.read_excel(
        r'd:\attendence-zkt\Punjab Police Nafri total 288.xlsx',
        engine='calamine'
    )

    logger.info("Loading emp_data (device enrollments) ...")
    emp = pd.read_excel(
        r'd:\attendence-zkt\emp_data.xls',
        engine='xlrd'
    )

    # Normalize belt/badge numbers for joining
    nafri['belt_norm'] = nafri['Belt'].apply(normalize_belt)
    emp['no_norm'] = emp['No.'].apply(normalize_belt)

    # Build lookup: belt_norm -> AC-No (device ID)
    # AC-No is unique in emp_data (verified). Take first match per belt.
    belt_to_device = {}
    for _, row in emp.iterrows():
        bn = row['no_norm']
        if bn and bn not in belt_to_device:
            belt_to_device[bn] = int(row['AC-No.'])

    logger.info(f"Nafri total rows: {len(nafri)}")
    logger.info(f"emp_data unique belts with device IDs: {len(belt_to_device)}")

    personnel_list = []
    no_device_id = []

    for _, row in nafri.iterrows():
        belt = row['belt_norm']
        name = str(row['Name']).strip() if pd.notna(row['Name']) else None
        rank = str(row['Rank']).strip() if pd.notna(row['Rank']) else None
        dept = str(row['PS/Unit']).strip() if pd.notna(row['PS/Unit']) else None
        nic  = str(row['NIC']).strip() if pd.notna(row['NIC']) else None
        gender = str(row['Gender']).strip() if pd.notna(row['Gender']) else 'Male'
        status = str(row['Status']).strip() if pd.notna(row['Status']) else 'POSTED'
        dob_raw = row.get('DOB')

        # Parse DOB
        dob_val: Optional[date] = None
        if pd.notna(dob_raw):
            try:
                dob_val = pd.to_datetime(dob_raw).date()
            except Exception:
                pass

        # Map status to employment_status
        status_map = {
            'POSTED': 'Active',
            'LEAVE': 'Active',
            'DEPUTATION IN': 'Active',
            'TRANSFERRED OUT': 'Inactive',
            'SUSPENDED': 'Suspended',
        }
        employment_status = status_map.get(status.upper() if status else '', 'Active')

        # Device ID from emp_data via belt match
        device_id = belt_to_device.get(belt) if belt else None
        if device_id is None:
            no_device_id.append(name)

        personnel_list.append({
            'name': name,
            'rank': rank,
            'department': dept,
            'belt': str(row['Belt']) if pd.notna(row.get('Belt')) else None,
            'belt_norm': belt,
            'nic': nic,
            'gender': gender,
            'dob': dob_val,
            'employment_status': employment_status,
            'device_id': device_id,
        })

    logger.info(f"Total personnel to seed: {len(personnel_list)}")
    logger.info(f"Personnel WITH device ID: {len([p for p in personnel_list if p['device_id']])}")
    logger.info(f"Personnel WITHOUT device ID: {len(no_device_id)}")
    if no_device_id:
        logger.warning(f"No device ID for: {no_device_id}")

    return personnel_list


# ------------------------------------------------------------------------------
# Rank hierarchy for Punjab Police
# ------------------------------------------------------------------------------

RANK_ORDER = {
    'Inspector': 1,
    'INSPECTOR LEGAL': 2,
    'SUB INSPECTOR': 3,
    'ASI': 4,
    'HEAD CONSTABLE': 5,
    'HEAD CONSTABLE DRIVER': 6,
    'LADY HC': 7,
    'CONSTABLE': 8,
    'Constable': 8,
    'CONSTABLE DRIVER': 9,
    'CONSTABLE (EX-ARMY)': 10,
    'BAND CONSTABLE': 11,
    'OFFICE SUPERINTENDENT': 20,
    'SENIOR CLERK': 21,
    'JUNIOR CLERK': 22,
    'ASSISTANT': 23,
    'PSYCHOLOGIST': 24,
    'MEDICAL OFFICER (DOCTOR) BPS': 25,
    'NAIB QASID': 30,
    'DAFTRI': 31,
    'ELECTRICIAN': 40,
    'CARPENTER': 41,
    'PAINTER': 42,
    'MASON': 43,
    'MALI': 50,
    'LANGRI': 51,
    'BARBER': 52,
    'COBBLER': 53,
    'WASHER MAN': 54,
    'WATER CARRIER': 55,
    'SWEEPER': 56,
    'SANITARY WORKER': 57,
}


def make_code(name: str) -> str:
    """Generate short unique code from name."""
    code = re.sub(r'[^A-Za-z0-9 ]', '', name)
    code = '_'.join(code.upper().split())[:20]
    return code


def build_rank_list(personnel_list: list) -> list:
    seen = {}
    for p in personnel_list:
        r = p['rank']
        if r and r not in seen:
            seen[r] = {
                'name': r,
                'code': make_code(r),
                'sort_order': RANK_ORDER.get(r, 99),
            }
    # Resolve duplicate codes
    codes: dict[str, int] = {}
    for r in seen.values():
        base = r['code']
        if base in codes:
            codes[base] += 1
            r['code'] = base[:17] + f'_{codes[base]}'
        else:
            codes[base] = 0
    return sorted(seen.values(), key=lambda x: x['sort_order'])


def build_department_list(personnel_list: list) -> list:
    seen = {}
    for p in personnel_list:
        d = p['department']
        if d and d not in seen:
            seen[d] = {'name': d, 'code': make_code(d)}
    # Resolve duplicate codes
    codes: dict[str, int] = {}
    for d in seen.values():
        base = d['code']
        if base in codes:
            codes[base] += 1
            d['code'] = base[:17] + f'_{codes[base]}'
        else:
            codes[base] = 0
    return list(seen.values())


# ------------------------------------------------------------------------------
# STEP 2: Seed Database
# ------------------------------------------------------------------------------

async def seed_uniform_staff():
    """Delete old data and seed fresh uniform staff."""
    await init_db()

    personnel_list = load_and_preprocess()
    ranks_data = build_rank_list(personnel_list)
    depts_data = build_department_list(personnel_list)

    async with async_session_factory() as db:
        # -- DELETE EXISTING DATA --
        logger.info("Deleting existing exception requests...")
        await db.execute(delete(ExceptionRequest))
        logger.info("Deleting existing attendance records...")
        await db.execute(delete(AttendanceRecord))
        logger.info("Deleting existing personnel...")
        await db.execute(delete(Personnel))
        logger.info("Deleting existing ranks...")
        await db.execute(delete(Rank))
        logger.info("Deleting existing departments...")
        await db.execute(delete(Department))
        await db.commit()
        logger.info("All existing personnel/rank/dept data cleared.")

        # -- SEED DEPARTMENTS --
        logger.info(f"Seeding {len(depts_data)} departments...")
        dept_map: dict[str, int] = {}
        for d in depts_data:
            dept = Department(name=d['name'], code=d['code'], active=True)
            db.add(dept)
            await db.flush()
            dept_map[d['name']] = dept.id
        await db.commit()
        logger.info("Departments seeded.")

        # -- SEED RANKS --
        logger.info(f"Seeding {len(ranks_data)} ranks...")
        rank_map: dict[str, int] = {}
        for r in ranks_data:
            rank = Rank(name=r['name'], code=r['code'], sort_order=r['sort_order'], active=True)
            db.add(rank)
            await db.flush()
            rank_map[r['name']] = rank.id
        await db.commit()
        logger.info("Ranks seeded.")

        # -- SEED PERSONNEL --
        logger.info(f"Seeding {len(personnel_list)} personnel...")
        seeded = 0
        skipped = 0

        for p in personnel_list:
            if not p['name']:
                skipped += 1
                continue

            dept_id = dept_map.get(p['department']) if p['department'] else None
            rank_id = rank_map.get(p['rank']) if p['rank'] else None

            # biometric_user_id = AC-No from device if matched, else placeholder
            if p['device_id'] is not None:
                bio_uid = str(p['device_id'])
            else:
                # Placeholder: guaranteed not to clash with real device IDs
                safe_belt = (p['belt_norm'] or p['name'][:15].replace(' ', '_')).replace('/', '_')
                bio_uid = f"NOENROLL_{safe_belt}"

            personnel = Personnel(
                biometric_user_id=bio_uid,
                employee_code=p['belt'],
                full_name=p['name'],
                rank_id=rank_id,
                department_id=dept_id,
                category='Uniform',
                cnic=p['nic'],
                gender=p['gender'] if p['gender'] in ('Male', 'Female') else 'Male',
                dob=p['dob'],
                employment_status=p['employment_status'],
                is_trainee=False,
                has_fingerprint=p['device_id'] is not None,
            )
            db.add(personnel)
            seeded += 1

        await db.commit()

    logger.info("=" * 60)
    logger.info("UNIFORM STAFF SEEDING COMPLETE")
    logger.info(f"  Departments : {len(depts_data)}")
    logger.info(f"  Ranks       : {len(ranks_data)}")
    logger.info(f"  Personnel   : {seeded}  (skipped: {skipped})")
    logger.info("=" * 60)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s"
    )
    asyncio.run(seed_uniform_staff())
