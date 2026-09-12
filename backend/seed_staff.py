import asyncio
from datetime import date
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text

from app.models.rank import Rank
from app.models.personnel import Personnel
from app.models.attendance import AttendanceDaily
from app.utils.timezone import today

engine = create_async_engine('sqlite+aiosqlite:///./attendance.db')
SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def seed():
    async with SessionLocal() as db:
        # Create standard ranks if they don't exist
        ranks_data = [
            {"name": "Constable", "code": "CT", "sort_order": 1},
            {"name": "Head Constable", "code": "HC", "sort_order": 2},
            {"name": "Assistant Sub-Inspector", "code": "ASI", "sort_order": 3},
            {"name": "Sub-Inspector", "code": "SI", "sort_order": 4},
            {"name": "Inspector", "code": "INSP", "sort_order": 5},
            {"name": "Inspector (Legal)", "code": "INSP-L", "sort_order": 6},
        ]
        
        ranks = {}
        for r_data in ranks_data:
            existing = await db.execute(select(Rank).where(Rank.name == r_data["name"]))
            rank = existing.scalar_one_or_none()
            if not rank:
                rank = Rank(name=r_data["name"], code=r_data["code"], sort_order=r_data["sort_order"], active=True)
                db.add(rank)
                await db.flush()
            ranks[r_data["name"]] = rank

        # Clear old staff
        await db.execute(text("DELETE FROM attendance_daily WHERE personnel_id IN (SELECT id FROM personnel WHERE is_trainee = 0)"))
        await db.execute(text("DELETE FROM personnel WHERE is_trainee = 0"))
        await db.flush()

        import random
        # Seed uniform staff
        staff_counts = {
            "Constable": 68,
            "Head Constable": 42,
            "Assistant Sub-Inspector": 33,
            "Sub-Inspector": 18,
            "Inspector": 15,
            "Inspector (Legal)": 4
        }
        
        staff = []
        uid = 2000
        for rank_name, count in staff_counts.items():
            rank = ranks[rank_name]
            for i in range(count):
                gender = "Male" if random.random() < 0.9 else "Female"
                p = Personnel(
                    biometric_user_id=f"S{uid}", 
                    full_name=f"Staff {rank_name} {i}", 
                    is_trainee=False, 
                    rank_id=rank.id, 
                    gender=gender,
                    category="Uniform"
                )
                db.add(p)
                staff.append(p)
                uid += 1
                
        # Seed civil staff
        for i in range(29):
            gender = "Male" if random.random() < 0.8 else "Female"
            person = Personnel(
                biometric_user_id=f"S{uid}", 
                full_name=f"Civil Staff {i}", 
                is_trainee=False, 
                rank_id=ranks["Constable"].id, # Mock rank
                gender=gender,
                category="Non-Uniform",
                cnic=f"37101-{random.randint(1000000, 9999999)}-{random.randint(1, 9)}",
                father_name=f"{fake.first_name_male()} {fake.last_name()}",
                dob=fake.date_of_birth(minimum_age=22, maximum_age=60),
            )
            db.add(person)
            staff.append(person)
            uid += 1

        await db.flush()

        # Create Security Staff
        security_count = 31
        departments = (await db.execute(select(Department))).scalars().all()
        sec_dept = next((d for d in departments if d.name == "Security"), None)
        sec_ranks = [ranks["Constable"], ranks["Head Constable"], ranks["Assistant Sub-Inspector"]]
        
        if sec_dept:
            for i in range(security_count):
                rank = random.choices(sec_ranks, weights=[20, 8, 3])[0]
                person = Personnel(
                    biometric_user_id=f"S{i+100}",
                    employee_code=f"{random.randint(100, 999)}/{random.choice(['C', 'RWP', 'LHR'])}",
                    full_name=fake.name().upper(),
                    rank_id=rank.id,
                    department_id=sec_dept.id,
                    category="Uniform",
                    duty_type="Security",
                    gender="Male", # Mostly male
                    cnic=f"37405-{random.randint(1000000, 9999999)}-{random.randint(1, 9)}",
                    father_name=f"{fake.first_name_male()} {fake.last_name()}".upper(),
                    dob=fake.date_of_birth(minimum_age=20, maximum_age=50),
                )
                db.add(person)
                staff.append(person)
            
        await db.flush()
        print("Staff seeded.")
        
        # Give them attendance
        t = today()
        for p in staff:
            # Randomize attendance mimicking the screenshot
            rand = random.random()
            if rand < 0.44:
                status = "PRESENT"
            elif rand < 0.45:
                status = "ABSENT"
            elif rand < 0.56:
                status = "LEAVE"
            elif rand < 0.70:
                status = "WEEKEND"
            elif rand < 0.74:
                status = "OSD"
            elif rand < 0.75:
                status = "MEDICAL"
            elif rand < 0.75: # 0 Evidence
                status = "EVIDENCE"
            else:
                status = "DUTY_REST"
                
            att = AttendanceDaily(personnel_id=p.id, attendance_date=t, status=status)
            db.add(att)
            
        await db.commit()
        print("Seeded staff!")

asyncio.run(seed())
