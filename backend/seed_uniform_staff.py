import asyncio
import logging
import re
import uuid
import pandas as pd
from datetime import time
from sqlalchemy import select, delete

from app.database import async_session_factory, init_db
from app.models.personnel import Personnel
from app.models.department import Department
from app.models.rank import Rank
from app.models.course import Course
from app.models.shift import Shift
from app.models.attendance import AttendancePunch, AttendanceDaily
from app.models.exception import AttendanceException
from app.models.settings import SystemSetting
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RANK_PREFIXES = ['IP', 'SI', 'ASI', 'HC', 'FC', 'BC', 'DSP', 'SP', 'INSP']

def clean_emp_name(name):
    if not isinstance(name, str):
        return ""
    name = name.strip()
    for p in RANK_PREFIXES:
        if name.upper().startswith(f"{p} "):
            name = name[len(p)+1:].strip()
            break
    return name

def parse_trainee_info(emp_row):
    name = str(emp_row['Name']).strip()
    dept = str(emp_row['Department']).strip()
    
    cap_match = re.search(r'Cap\s*(\d+)$', name, re.IGNORECASE)
    cap_no = int(cap_match.group(1)) if cap_match else None
    
    course = None
    if 'ZL' in dept.upper() or 'LOW' in dept.upper():
        course = "Low Level"
    elif 'Z' in dept.upper() or 'BASIC' in dept.upper():
        course = "Basic"
        
    return {
        'biometric_user_id': str(emp_row['AC-No.']).strip(),
        'full_name': name,
        'department': dept,
        'course': course,
        'employee_code': f"CAP-{cap_no}" if cap_no else None
    }

def get_unique_ac_no(ac_no, used_ac_nos):
    if not ac_no or ac_no == 'nan' or ac_no in used_ac_nos:
        return f"NODEV-{uuid.uuid4().hex[:8].upper()}"
    used_ac_nos.add(ac_no)
    return ac_no

def preprocess_and_seed():
    logger.info("Reading Excel files...")
    df_emp = pd.read_excel(r'd:\attendence-zkt\emp_data.xls', engine='xlrd')
    df_nafri = pd.read_excel(r'd:\attendence-zkt\Punjab Police Nafri total 288.xlsx', engine='calamine')
    
    df_emp = df_emp.fillna('')
    df_nafri = df_nafri.fillna('')
    
    # 1. Map emp_data staff names (cleaned) to AC-No.
    emp_staff_map = {}
    trainees_list = []
    
    for _, row in df_emp.iterrows():
        emp_name = str(row['Name']).strip()
        dept = str(row['Department']).strip()
        
        ac_no = row['AC-No.']
        if pd.isna(ac_no) or ac_no == '':
            ac_no = ''
        elif isinstance(ac_no, float):
            ac_no = str(int(ac_no))
        else:
            ac_no = str(ac_no).strip()
            
        is_trainee = 'Platoon' in dept or 'Cap ' in emp_name
        
        if is_trainee:
            if ac_no:
                trainees_list.append(parse_trainee_info(row))
        else:
            cleaned = clean_emp_name(emp_name).upper()
            if cleaned and ac_no:
                # If there are duplicate names in emp_data, keep the first or store as list
                # Assuming unique cleaned names for matching
                if cleaned not in emp_staff_map:
                    emp_staff_map[cleaned] = []
                emp_staff_map[cleaned].append(ac_no)

    used_ac_nos = set()
    
    # 2. Process ALL Nafri personnel (Uniform + Non-Uniform)
    nafri_personnel = []
    for _, row in df_nafri.iterrows():
        name = str(row['Name']).strip()
        if not name:
            continue
            
        name_upper = name.upper()
        ac_no = None
        
        if name_upper in emp_staff_map and len(emp_staff_map[name_upper]) > 0:
            ac_no = emp_staff_map[name_upper].pop(0) # take one
            
        # Check for duplicates or missing
        final_ac_no = get_unique_ac_no(ac_no, used_ac_nos)
        
        rank = str(row['Rank']).strip()
        is_uniform = rank.upper() not in ['COBBLER', 'SWEEPER', 'BARBER', 'LANGRI', 'MALI', 'WATER CARRIER', 'WASHER MAN', 'MASON', 'SANITARY WORKER', 'ELECTRICIAN', 'CARPENTER', 'PAINTER', 'NAIB QASID']
        
        nafri_personnel.append({
            'biometric_user_id': final_ac_no,
            'full_name': name,
            'department': str(row['Posted As']).strip() if row['Posted As'] else "Unknown",
            'rank': rank,
            'designation': str(row['Posted As']).strip(),
            'cnic': str(row['NIC']).strip(),
            'belt_no': str(row['Belt']).strip(),
            'category': "Uniform" if is_uniform else "Non-Uniform"
        })
        
    # Process trainees biometric_user_id to ensure no duplicates
    final_trainees = []
    for t in trainees_list:
        t['biometric_user_id'] = get_unique_ac_no(t['biometric_user_id'], used_ac_nos)
        final_trainees.append(t)
        
    return nafri_personnel, final_trainees

async def get_or_create(db, model, filter_kwargs, create_kwargs):
    stmt = select(model).filter_by(**filter_kwargs)
    result = await db.execute(stmt)
    instance = result.scalar_one_or_none()
    if not instance:
        instance = model(**create_kwargs)
        db.add(instance)
        await db.flush()
    return instance

async def seed_db(nafri_list, trainees_list):
    await init_db()
    async with async_session_factory() as db:
        logger.info("Clearing existing Personnel and Attendance data...")
        await db.execute(delete(AttendanceException))
        await db.execute(delete(AttendanceDaily))
        await db.execute(delete(AttendancePunch))
        await db.execute(delete(Personnel))
        # Remove all mistakenly created non-uniform ranks
        non_uniform_roles = ['COBBLER', 'SWEEPER', 'BARBER', 'LANGRI', 'MALI', 'WATER CARRIER', 'WASHER MAN', 'MASON', 'SANITARY WORKER', 'ELECTRICIAN', 'CARPENTER', 'PAINTER', 'NAIB QASID']
        for role in non_uniform_roles:
            await db.execute(delete(Rank).where(Rank.name.ilike(f"%{role}%")))
        await db.commit()
        
        general_shift = await get_or_create(db, Shift, {"name": "General Shift"}, {"name": "General Shift", "start_time": time(8, 0), "end_time": time(17, 0)})
        trainee_shift = await get_or_create(db, Shift, {"name": "Trainee Shift"}, {"name": "Trainee Shift", "start_time": time(4, 0), "end_time": time(16, 0)})
        morning_shift = await get_or_create(db, Shift, {"name": "Morning Shift"}, {"name": "Morning Shift", "start_time": time(8, 0), "end_time": time(16, 0)})
        evening_shift = await get_or_create(db, Shift, {"name": "Evening Shift"}, {"name": "Evening Shift", "start_time": time(16, 0), "end_time": time(0, 0)})
        night_shift = await get_or_create(db, Shift, {"name": "Night Shift"}, {"name": "Night Shift", "start_time": time(0, 0), "end_time": time(8, 0)})
        
        # Configure Default Shifts in System Settings
        setting_u = await get_or_create(db, SystemSetting, {"key": "default_shift_uniform"}, {"key": "default_shift_uniform", "value": str(general_shift.id), "value_type": "string"})
        setting_u.value = str(general_shift.id)
        setting_nu = await get_or_create(db, SystemSetting, {"key": "default_shift_non_uniform"}, {"key": "default_shift_non_uniform", "value": str(general_shift.id), "value_type": "string"})
        setting_nu.value = str(general_shift.id)
        setting_t = await get_or_create(db, SystemSetting, {"key": "default_shift_trainee"}, {"key": "default_shift_trainee", "value": str(trainee_shift.id), "value_type": "string"})
        setting_t.value = str(trainee_shift.id)
        
        basic_course = await get_or_create(db, Course, {"name": "Basic Course"}, {"name": "Basic Course"})
        low_course = await get_or_create(db, Course, {"name": "Low Level Course"}, {"name": "Low Level Course"})
        
        logger.info("Seeding Nafri (Uniform & Non-Uniform)...")
        civil_designations_set = set()
        
        import random
        for i, s in enumerate(nafri_list):
            dept_name = s['department'] if s['department'] else "Unknown"
            dept_code = dept_name[:20].upper()
            dept = await get_or_create(db, Department, {"code": dept_code}, {"name": dept_name, "code": dept_code})
            
            rank = None
            designation_str = None
            if s['category'] == 'Uniform':
                rank_name = s['rank']
                rank_code = rank_name[:20].upper() if rank_name else None
                if rank_name:
                    rank = await get_or_create(db, Rank, {"code": rank_code}, {"name": rank_name, "code": rank_code})
                designation_str = s['designation']
            else:
                designation_str = s['rank']
                if designation_str:
                    civil_designations_set.add(designation_str)
            
            duty_type = None
            assigned_shift = general_shift.id
            
            # Make ~10% of uniform staff Security
            if s['category'] == 'Uniform' and i % 10 == 0:
                duty_type = "Security"
                assigned_shift = random.choice([morning_shift.id, evening_shift.id, night_shift.id])
            
            p = Personnel(
                biometric_user_id=s['biometric_user_id'],
                full_name=s['full_name'],
                department_id=dept.id,
                rank_id=rank.id if rank else None,
                designation=designation_str,
                cnic=s['cnic'],
                employee_code=s['belt_no'],
                shift_id=assigned_shift,
                duty_type=duty_type,
                is_trainee=False,
                category=s['category']
            )
            db.add(p)
            
        # Add designations to SystemSetting
        if civil_designations_set:
            designations_list = sorted(list(civil_designations_set))
            setting = await get_or_create(db, SystemSetting, {"key": "civil_designations"}, {"key": "civil_designations", "value": "[]", "value_type": "json"})
            setting.value = json.dumps(designations_list)
        logger.info("Seeding Trainee Data...")
        for j, t in enumerate(trainees_list):
            dept_name = t['department'] if t['department'] else "Trainees"
            dept_code = dept_name[:20].upper()
            dept = await get_or_create(db, Department, {"code": dept_code}, {"name": dept_name, "code": dept_code})
            
            course_id = basic_course.id if t['course'] == "Basic" else (low_course.id if t['course'] == "Low Level" else None)
            duty_type = None
            assigned_shift = trainee_shift.id
            
            # Make ~5% of trainees Security
            if j % 20 == 0:
                duty_type = "Security"
                assigned_shift = random.choice([morning_shift.id, evening_shift.id, night_shift.id])
            
            p = Personnel(
                biometric_user_id=t['biometric_user_id'],
                full_name=t['full_name'],
                department_id=dept.id,
                employee_code=t['employee_code'],
                shift_id=assigned_shift,
                duty_type=duty_type,
                is_trainee=True,
                course_id=course_id,
                category="Trainee"
            )
            db.add(p)
                
        await db.commit()
        logger.info(f"Database Seeding Completed! Seeded {len(nafri_list)} Nafri and {len(trainees_list)} Trainees.")

if __name__ == "__main__":
    nafri, trainees = preprocess_and_seed()
    asyncio.run(seed_db(nafri, trainees))
