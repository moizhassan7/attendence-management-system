
import asyncio
from datetime import date
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text

from app.models.course import Course
from app.models.personnel import Personnel
from app.models.attendance import AttendanceDaily
from app.utils.timezone import today

engine = create_async_engine('sqlite+aiosqlite:///./attendance.db')
SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def seed():
    async with SessionLocal() as db:
        # Clear old data
        await db.execute(text("DELETE FROM attendance_daily WHERE personnel_id IN (SELECT id FROM personnel WHERE is_trainee = 1)"))
        await db.execute(text("DELETE FROM personnel WHERE is_trainee = 1"))
        await db.execute(text("DELETE FROM courses"))
        await db.flush()

        # Create courses
        courses_data = [
            {"name": "Basic Recruit Class Course", "code": "BRCC"},
            {"name": "Lower Class Course", "code": "LCC"},
            {"name": "Drill/Weapon Instructor Course", "code": "DWIC"}
        ]
        
        courses = []
        for c in courses_data:
            course = Course(name=c["name"], code=c["code"], active=True)
            db.add(course)
            courses.append(course)
            
        await db.flush()
        
        # Create trainees for each course
        trainees = []
        import random
        # 770 in BRCC, 87 in LCC
        for i in range(770):
            gender = "Male" if random.random() < 0.9 else "Female"
            p = Personnel(biometric_user_id=f"T_C1_{i}", full_name=f"Trainee 1_{i}", is_trainee=True, course_id=courses[0].id, gender=gender)
            db.add(p)
            trainees.append(p)
            
        for i in range(87):
            gender = "Male" if random.random() < 0.9 else "Female"
            p = Personnel(biometric_user_id=f"T_C2_{i}", full_name=f"Trainee 2_{i}", is_trainee=True, course_id=courses[1].id, gender=gender)
            db.add(p)
            trainees.append(p)
            
        await db.flush()
        
        # Give them attendance
        t = today()
        for p in trainees:
            # 95% present, 5% absent
            status = "PRESENT" if random.random() < 0.95 else "ABSENT"
            if random.random() < 0.05:
                status = "LEAVE"
            if random.random() < 0.02:
                status = "REPATRIATION"
                
            att = AttendanceDaily(personnel_id=p.id, attendance_date=t, status=status)
            db.add(att)
            
        await db.commit()
        print("Seeded trainees!")

asyncio.run(seed())
