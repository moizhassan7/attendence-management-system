"""Background sync scheduler — runs continuously, syncs all devices at intervals."""

from __future__ import annotations

import asyncio
import logging

from app.config import get_settings
from app.database import async_session_factory
from app.websocket.manager import ws_manager
from app.zk.sync_service import SyncService

logger = logging.getLogger(__name__)

_running = False
_task: asyncio.Task | None = None


async def start_sync_scheduler() -> None:
    """Start the background sync loop."""
    global _running, _task
    if _running:
        logger.warning("Sync scheduler already running")
        return
    _running = True
    _task = asyncio.create_task(_sync_loop())
    logger.info("Sync scheduler started")


async def stop_sync_scheduler() -> None:
    """Stop the background sync loop."""
    global _running, _task
    _running = False
    if _task and not _task.done():
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
    _task = None
    logger.info("Sync scheduler stopped")


def is_scheduler_running() -> bool:
    """Check if the scheduler is currently running."""
    return _running and _task is not None and not _task.done()


async def _sync_loop() -> None:
    """Main sync loop — runs until stopped."""
    settings = get_settings()
    sync_service = SyncService()

    logger.info("Sync loop started with interval=%ds", settings.sync_interval_seconds)

    while _running:
        try:
            async with async_session_factory() as db:
                try:
                    result = await sync_service.sync_all_devices(db)
                    enrollments = await sync_service.sync_enrollments_all_devices()
                    
                    # Compute daily attendance for today after a successful sync
                    from app.services.attendance_engine import AttendanceService
                    from app.utils.timezone import today
                    
                    calc_service = AttendanceService()
                    processed = await calc_service.process_daily_attendance(db, today())
                    
                    await db.commit()
                    new_punches = sum(d.get("logs_inserted", 0) for d in result.get("details", []))
                    logger.info(
                        "🔄 [SYNC CYCLE] Devices: %d/%d OK | New Punches: +%d | Fingerprints updated: %d | Personnel Evaluated: %d | Status: ACTIVE",
                        result["success"], result["total"], new_punches,
                        enrollments.get("fingerprints_updated", 0), processed
                    )
                    # Broadcast dashboard update via WebSocket
                    await ws_manager.broadcast({
                        "event": "dashboard.metrics.updated",
                        "data": {
                            "devices_synced": result["success"],
                            "devices_failed": result["failed"],
                            "personnel_calculated": processed,
                        },
                    })
                except Exception as e:
                    await db.rollback()
                    logger.error("Sync cycle error: %s", e, exc_info=True)
        except Exception as e:
            logger.error("Session error in sync loop: %s", e, exc_info=True)

        # Wait for next interval
        try:
            await asyncio.sleep(settings.sync_interval_seconds)
        except asyncio.CancelledError:
            break

    logger.info("Sync loop exited")
