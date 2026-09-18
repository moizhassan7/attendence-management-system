"""Clean database setup script — seeds only Admin, Real Device, and core settings."""

from __future__ import annotations

import asyncio
import logging
from datetime import date, time

from sqlalchemy import select, func

from app.config import get_settings
from app.core.security import get_password_hash
from app.database import async_session_factory, init_db
from app.models.device import Device
from app.models.settings import SystemSetting
from app.models.shift import Shift
from app.models.user import User

logger = logging.getLogger(__name__)


async def seed_database():
    """Seed initial administrator and real ZKTeco hardware device."""
    settings = get_settings()

    # Create tables first
    await init_db()

    async with async_session_factory() as db:
        # Check if Admin already exists
        admin_exists = (await db.execute(
            select(User).where(User.username == settings.admin_username)
        )).scalar_one_or_none()

        if not admin_exists:
            logger.info("Creating default administrator account (%s)...", settings.admin_username)
            db.add(User(
                username=settings.admin_username,
                email=settings.admin_email,
                hashed_password=get_password_hash(settings.admin_password),
                full_name="System Administrator",
                role="ADMIN",
                is_active=True,
            ))

        live_terminals = [
            ("TR-3", "192.168.1.220", "TR-3 entrance"),
            ("TR-2", "192.168.1.210", "TR-2 entrance"),
            ("PTS Staff", "192.168.1.201", "PTS Staff"),
        ]
        for name, ip, location in live_terminals:
            device_exists = (await db.execute(
                select(Device).where(Device.ip_address == ip)
            )).scalar_one_or_none()
            if not device_exists:
                logger.info("Adding ZKTeco terminal %s (%s:4370)...", name, ip)
                db.add(Device(
                    name=name,
                    ip_address=ip,
                    port=4370,
                    location=location,
                    enabled=True,
                    connection_status="UNKNOWN",
                ))

        # Shifts (required for attendance calculation)
        shift_count = (await db.execute(select(func.count(Shift.id)))).scalar()
        if not shift_count or shift_count == 0:
            shifts = [
                Shift(name="Morning Shift", start_time=time(8, 0), end_time=time(16, 0), late_grace_minutes=15),
                Shift(name="Evening Shift", start_time=time(16, 0), end_time=time(0, 0), late_grace_minutes=15),
                Shift(name="Night Shift", start_time=time(0, 0), end_time=time(8, 0), late_grace_minutes=15),
                Shift(name="General Shift", start_time=time(8, 0), end_time=time(17, 0), late_grace_minutes=15),
                Shift(name="Trainee Shift", start_time=time(4, 0), end_time=time(16, 0), late_grace_minutes=15),
            ]
            for s in shifts:
                db.add(s)

        # Core System Settings
        setting_count = (await db.execute(select(func.count(SystemSetting.id)))).scalar()
        if not setting_count or setting_count == 0:
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
        logger.info("Database initialization complete: Admin user and Real Device configured.")


async def seed_all():
    """Wipe every table, then seed admin, device, shifts, settings, and personnel."""
    from app.database import reset_db
    from app.seed_personnel import seed_personnel

    logger.info("Resetting database (drop all tables)...")
    await reset_db()
    await seed_database()
    await seed_personnel()
    logger.info("Full rebuild complete: admin, shifts, device, and Nafri personnel.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import sys

    if "--reset-all" in sys.argv:
        asyncio.run(seed_all())
    else:
        asyncio.run(seed_database())
