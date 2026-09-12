"""Development seed script — populates master data for testing."""

from __future__ import annotations

import asyncio
import logging
from datetime import date, time

from passlib.context import CryptContext

from app.config import get_settings
from app.database import async_session_factory, init_db
from app.models.department import Department
from app.models.device import Device
from app.models.holiday import Holiday
from app.models.personnel import Personnel
from app.models.rank import Rank
from app.models.settings import SystemSetting
from app.models.shift import Shift
from app.models.user import User

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed_database():
    """Create seed data for development. Skips if data already exists."""
    settings = get_settings()

    # Create tables first
    await init_db()

    async with async_session_factory() as db:
        # Check if already seeded
        from sqlalchemy import select, func
        count = (await db.execute(select(func.count(Department.id)))).scalar()
        if count and count > 0:
            logger.info("Database already seeded, skipping")
            return

        logger.info("Seeding database with development data...")

        # ── Departments ──
        departments = [
            Department(name="Operations", code="OPS"),
            Department(name="Administration", code="ADMIN"),
            Department(name="Technical", code="TECH"),
            Department(name="Logistics", code="LOG"),
            Department(name="Intelligence", code="INTEL"),
            Department(name="Training", code="TRG"),
            Department(name="Communications", code="COMM"),
            Department(name="Transport", code="TRN"),
        ]
        for d in departments:
            db.add(d)
        await db.flush()

        # ── Ranks ──
        ranks = [
            Rank(name="Director", code="DIR", sort_order=1),
            Rank(name="Deputy Director", code="DD", sort_order=2),
            Rank(name="Senior Officer", code="SO", sort_order=3),
            Rank(name="Officer", code="OFF", sort_order=4),
            Rank(name="Inspector", code="INSP", sort_order=5),
            Rank(name="Sub Inspector", code="SI", sort_order=6),
            Rank(name="Assistant", code="ASST", sort_order=7),
            Rank(name="Technician", code="TECH", sort_order=8),
            Rank(name="Staff", code="STF", sort_order=9),
            Rank(name="Driver", code="DRV", sort_order=10),
        ]
        for r in ranks:
            db.add(r)
        await db.flush()

        # ── Shifts ──
        shifts = [
            Shift(name="Morning Shift", start_time=time(8, 30), end_time=time(17, 0), late_grace_minutes=10),
            Shift(name="Evening Shift", start_time=time(14, 0), end_time=time(22, 0), late_grace_minutes=10),
            Shift(name="Night Shift", start_time=time(22, 0), end_time=time(6, 0), late_grace_minutes=15),
        ]
        for s in shifts:
            db.add(s)
        await db.flush()

        # ── Holidays (sample 2026 Pakistan holidays) ──
        holidays = [
            Holiday(holiday_date=date(2026, 3, 23), name="Pakistan Day"),
            Holiday(holiday_date=date(2026, 5, 1), name="Labour Day"),
            Holiday(holiday_date=date(2026, 8, 14), name="Independence Day"),
            Holiday(holiday_date=date(2026, 11, 9), name="Iqbal Day"),
            Holiday(holiday_date=date(2026, 12, 25), name="Quaid-e-Azam Day"),
        ]
        for h in holidays:
            db.add(h)

        # ── Sample Personnel ──
        sample_employees = [
            ("1001", "EMP-001", "Muhammad Ali Khan", "DIR", "OPS", "Uniform"),
            ("1002", "EMP-002", "Ahmed Hassan", "INSP", "OPS", "Uniform"),
            ("1003", "EMP-003", "Fatima Zahra", "OFF", "ADMIN", "Non-Uniform"),
            ("1004", "EMP-004", "Usman Ghani", "SI", "TECH", "Uniform"),
            ("1005", "EMP-005", "Zainab Bibi", "ASST", "ADMIN", "Non-Uniform"),
            ("1006", "EMP-006", "Bilal Ahmad", "TECH", "TECH", "Uniform"),
            ("1007", "EMP-007", "Sana Malik", "OFF", "INTEL", "Non-Uniform"),
            ("1008", "EMP-008", "Imran Hussain", "STF", "LOG", "Uniform"),
            ("1009", "EMP-009", "Ayesha Siddiqui", "ASST", "ADMIN", "Non-Uniform"),
            ("1010", "EMP-010", "Rashid Mehmood", "DRV", "TRN", "Uniform"),
            ("1011", "EMP-011", "Nadia Parveen", "OFF", "TRG", "Non-Uniform"),
            ("1012", "EMP-012", "Tariq Aziz", "INSP", "OPS", "Uniform"),
            ("1013", "EMP-013", "Hira Batool", "ASST", "COMM", "Non-Uniform"),
            ("1014", "EMP-014", "Kamran Akbar", "SI", "OPS", "Uniform"),
            ("1015", "EMP-015", "Saima Noor", "STF", "ADMIN", "Non-Uniform"),
            ("1016", "EMP-016", "Farhan Raza", "TECH", "TECH", "Uniform"),
            ("1017", "EMP-017", "Amina Yousuf", "OFF", "INTEL", "Non-Uniform"),
            ("1018", "EMP-018", "Naveed Iqbal", "STF", "LOG", "Uniform"),
            ("1019", "EMP-019", "Rabia Sultan", "ASST", "TRG", "Non-Uniform"),
            ("1020", "EMP-020", "Waqas Aslam", "DRV", "TRN", "Uniform"),
        ]

        # Build lookup dicts
        dept_map = {d.code: d.id for d in departments}
        rank_map = {r.code: r.id for r in ranks}
        shift_id = shifts[0].id  # Morning shift default

        for bio_id, emp_code, name, rank_code, dept_code, cat in sample_employees:
            db.add(Personnel(
                biometric_user_id=bio_id,
                employee_code=emp_code,
                full_name=name,
                rank_id=rank_map.get(rank_code),
                department_id=dept_map.get(dept_code),
                category=cat,
                shift_id=shift_id,
                employment_status="Active",
            ))

        # ── Mock Device ──
        db.add(Device(
            name="Main Gate Biometric",
            ip_address="192.168.1.201",
            port=4370,
            location="Main Gate",
            enabled=True,
            connection_status="UNKNOWN",
        ))

        # ── Admin User ──
        db.add(User(
            username=settings.admin_username,
            email=settings.admin_email,
            hashed_password=pwd_context.hash(settings.admin_password),
            full_name="System Administrator",
            role="ADMIN",
            is_active=True,
        ))

        # ── System Settings ──
        default_settings = [
            ("sync_interval_seconds", "30", "int", "Device sync interval in seconds"),
            ("debounce_seconds", "60", "int", "Minimum gap between valid punches"),
            ("timezone", "Asia/Karachi", "string", "Application timezone"),
            ("default_shift", "1", "int", "Default shift ID for new personnel"),
            ("late_grace_minutes", "10", "int", "Grace period for late marking"),
            ("dashboard_refresh_interval", "30", "int", "Dashboard auto-refresh interval in seconds"),
            ("weekend_days", "5,6", "string", "Weekend day numbers (0=Mon..6=Sun)"),
        ]
        for key, value, vtype, desc in default_settings:
            db.add(SystemSetting(key=key, value=value, value_type=vtype, description=desc))

        await db.commit()
        logger.info("Database seeded successfully with %d employees", len(sample_employees))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_database())
