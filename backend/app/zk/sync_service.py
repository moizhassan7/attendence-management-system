"""Sync service — orchestrates attendance ingestion from devices to database."""

from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import AttendancePunch
from app.models.device import Device
from app.models.device_sync_log import DeviceSyncLog
from app.utils.timezone import now, make_aware
from app.zk.base import DeviceAttendanceLog
from app.zk.device_manager import DeviceManager, create_device_adapter

logger = logging.getLogger(__name__)


class SyncService:
    """Handles syncing attendance from all enabled devices."""

    async def sync_all_devices(self, db: AsyncSession) -> dict:
        """Sync attendance from all enabled devices. Each device fails independently."""
        result = await db.execute(
            select(Device).where(Device.enabled == True)
        )
        devices = result.scalars().all()

        summary = {"total": len(devices), "success": 0, "failed": 0, "details": []}

        for device in devices:
            try:
                device_result = await self.sync_device(db, device)
                summary["success"] += 1
                summary["details"].append(device_result)
            except Exception as e:
                logger.error("Sync failed for device %s (%s): %s", device.name, device.ip_address, e)
                summary["failed"] += 1
                summary["details"].append({
                    "device_id": device.id,
                    "device_name": device.name,
                    "status": "FAILED",
                    "error": str(e),
                })
                # Update device status
                device.connection_status = "OFFLINE"
                device.last_error = str(e)
                await db.flush()

        return summary

    async def sync_device(self, db: AsyncSession, device: Device) -> dict:
        """Sync a single device. Returns summary of the operation."""
        sync_log = DeviceSyncLog(
            device_id=device.id,
            started_at=now(),
            status="RUNNING",
        )
        db.add(sync_log)
        await db.flush()

        try:
            # Create adapter and fetch logs
            adapter = create_device_adapter(
                ip=device.ip_address,
                port=device.port,
                password=device.communication_password,
            )
            manager = DeviceManager(adapter)

            # This is blocking I/O — run in thread pool
            import asyncio
            loop = asyncio.get_running_loop()
            raw_logs = await loop.run_in_executor(None, manager.fetch_attendance)

            # Process logs
            logs_found = len(raw_logs)
            logs_inserted = 0
            logs_skipped = 0

            for log_entry in raw_logs:
                was_inserted = await self._ingest_punch(db, device.id, log_entry)
                if was_inserted:
                    logs_inserted += 1
                else:
                    logs_skipped += 1

            # Update device status
            current_time = now()
            device.connection_status = "ONLINE"
            device.last_seen_at = current_time
            device.last_sync_at = current_time
            device.last_error = None

            # Update sync log
            sync_log.completed_at = current_time
            sync_log.status = "SUCCESS"
            sync_log.logs_found = logs_found
            sync_log.logs_inserted = logs_inserted
            sync_log.logs_skipped = logs_skipped

            await db.flush()

            logger.debug(
                "Sync complete for %s: found=%d inserted=%d skipped=%d",
                device.name, logs_found, logs_inserted, logs_skipped,
            )

            return {
                "device_id": device.id,
                "device_name": device.name,
                "status": "SUCCESS",
                "logs_found": logs_found,
                "logs_inserted": logs_inserted,
                "logs_skipped": logs_skipped,
            }

        except Exception as e:
            sync_log.completed_at = now()
            sync_log.status = "FAILED"
            sync_log.error_message = str(e)
            device.connection_status = "OFFLINE"
            device.last_error = str(e)
            await db.flush()
            raise

    async def _ingest_punch(
        self, db: AsyncSession, device_id: int, log: DeviceAttendanceLog
    ) -> bool:
        """Insert a single punch if not duplicate. Returns True if inserted."""
        punch_time = make_aware(log.timestamp) if log.timestamp.tzinfo is None else log.timestamp

        # Check for existing record (app-level dedup)
        existing = await db.execute(
            select(AttendancePunch.id).where(
                AttendancePunch.device_id == device_id,
                AttendancePunch.biometric_user_id == str(log.user_id),
                AttendancePunch.punch_time == punch_time,
            )
        )
        if existing.scalar_one_or_none() is not None:
            return False  # Duplicate — skip

        # Determine punch direction
        punch_type = None
        if log.punch == 0:
            punch_type = "IN"
        elif log.punch == 1:
            punch_type = "OUT"

        punch = AttendancePunch(
            device_id=device_id,
            biometric_user_id=str(log.user_id),
            punch_time=punch_time,
            punch_type=punch_type,
            verified=log.status,
            raw_status=log.status,
            raw_work_code=log.punch,
            source="DEVICE",
        )
        db.add(punch)

        try:
            await db.flush()
            return True
        except Exception:
            # DB-level unique constraint violation — treat as duplicate
            await db.rollback()
            return False
