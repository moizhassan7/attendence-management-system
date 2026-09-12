"""Health check endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.utils.timezone import now
from app.workers.sync_scheduler import is_scheduler_running

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health_check(db: AsyncSession = Depends(get_db)):
    """System health check — application, database, scheduler, devices."""
    # Database check
    db_status = "healthy"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {e}"

    # Scheduler check
    scheduler_status = "running" if is_scheduler_running() else "stopped"

    # Device summary
    from sqlalchemy import select, func
    from app.models.device import Device

    try:
        total_result = await db.execute(
            select(func.count(Device.id)).where(Device.enabled == True)
        )
        total_devices = total_result.scalar() or 0

        online_result = await db.execute(
            select(func.count(Device.id)).where(
                Device.enabled == True,
                Device.connection_status == "ONLINE",
            )
        )
        online_devices = online_result.scalar() or 0
    except Exception:
        total_devices = 0
        online_devices = 0

    return {
        "success": True,
        "data": {
            "application": "healthy",
            "database": db_status,
            "scheduler": scheduler_status,
            "server_time": now().isoformat(),
            "devices": {
                "total": total_devices,
                "online": online_devices,
                "offline": total_devices - online_devices,
            },
        },
    }
