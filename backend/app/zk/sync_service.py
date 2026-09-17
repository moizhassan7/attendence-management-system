"""Sync service — orchestrates attendance ingestion from devices to database."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import timedelta

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import async_session_factory
from app.models.attendance import AttendancePunch
from app.models.device import Device
from app.models.device_sync_log import DeviceSyncLog
from app.utils.timezone import make_aware, now
from app.zk.base import DeviceAttendanceLog
from app.zk.device_manager import DeviceManager, create_device_adapter
from app.zk.exceptions import (
    DeviceAuthenticationError,
    DeviceConnectionError,
    DeviceSyncBusyError,
    classify_exception,
    format_diagnostic,
    short_reason_label,
)

logger = logging.getLogger(__name__)

_sync_guard = asyncio.Lock()
_sync_in_progress: set[int] = set()


def _chunked(items: list, size: int):
    if size <= 0:
        yield items
        return
    for index in range(0, len(items), size):
        yield items[index:index + size]


def incremental_since(latest_punch, lookback_minutes: int):
    """Cursor for incremental sync: last stored punch minus a recovery overlap."""
    if latest_punch is None:
        return None
    minutes = max(0, lookback_minutes)
    return latest_punch - timedelta(minutes=minutes)


def persist_cursor_for_sync(
    *,
    full: bool,
    latest_time,
    lookback_minutes: int,
    clear_after: bool,
):
    """When the terminal log will be wiped, persist the entire dump first."""
    if full or latest_time is None or clear_after:
        return None
    return incremental_since(latest_time, lookback_minutes)


def sync_mode_for(*, full: bool, latest_time, clear_after: bool) -> str:
    if latest_time is None:
        return "initial"
    if full:
        return "historical"
    if clear_after:
        return "save_then_clear"
    return "incremental"


def should_clear_device_log(*, succeeded: bool, enabled: bool, terminal_records: int, logs_found: int) -> bool:
    """Wipe device memory only after a successful persist of a real dump. Never clear on empty/failed reads."""
    return bool(succeeded and enabled and terminal_records > 0 and logs_found > 0)


class SyncService:
    """Handles syncing attendance from all enabled devices."""

    async def _claim_device(self, device_id: int) -> bool:
        async with _sync_guard:
            if device_id in _sync_in_progress:
                return False
            _sync_in_progress.add(device_id)
            return True

    async def _release_device(self, device_id: int) -> None:
        async with _sync_guard:
            _sync_in_progress.discard(device_id)

    async def heartbeat_device(self, db: AsyncSession, device: Device) -> bool:
        """Lightweight reachability. Never competes with an in-progress sync."""
        if device.id in _sync_in_progress:
            logger.info("[%s] Skipping heartbeat; sync in progress", device.name)
            return device.connection_status in {"ONLINE", "SYNCING"}
        adapter = create_device_adapter(
            ip=device.ip_address,
            port=device.port,
            password=device.communication_password,
            name=device.name,
            transport=getattr(device, "preferred_transport", None) or "auto",
        )
        manager = DeviceManager(adapter, name=device.name)
        loop = asyncio.get_running_loop()
        try:
            await loop.run_in_executor(None, manager.probe)
            device.connection_status = "ONLINE"
            device.last_seen_at = now()
            await db.flush()
            return True
        except Exception as exc:
            device.connection_status = "DEGRADED" if device.last_sync_at else "OFFLINE"
            device.last_error = str(exc)
            await db.flush()
            logger.warning("[%s] Heartbeat failed: %s", device.name, exc)
            return False

    async def sync_all_devices(self, db: AsyncSession) -> dict:
        """Sync every enabled terminal independently. One failure cannot fail the others."""
        result = await db.execute(select(Device).where(Device.enabled.is_(True)))
        devices = list(result.scalars().all())
        settings = get_settings()
        concurrency = max(1, settings.device_sync_concurrency)
        semaphore = asyncio.Semaphore(concurrency)

        async def _run(device_id: int) -> dict:
            async with semaphore:
                return await self._sync_device_isolated(device_id)

        details = await asyncio.gather(*[_run(device.id) for device in devices], return_exceptions=True)

        summary = {"total": len(devices), "success": 0, "failed": 0, "busy": 0, "details": []}
        for device, item in zip(devices, details):
            if isinstance(item, Exception):
                row = {
                    "device_id": device.id,
                    "device_name": device.name,
                    "device_ip": device.ip_address,
                    "status": "FAILED",
                    "error": str(item),
                    "retry_count": 0,
                }
            else:
                row = item
            summary["details"].append(row)
            status = row.get("status")
            if status == "SUCCESS":
                summary["success"] += 1
            elif status == "BUSY":
                summary["busy"] += 1
            else:
                summary["failed"] += 1
        return summary

    async def _sync_device_isolated(self, device_id: int, full: bool = False) -> dict:
        """Own DB session so a failed terminal never rolls back a successful one."""
        async with async_session_factory() as db:
            result = await db.execute(select(Device).where(Device.id == device_id))
            device = result.scalar_one_or_none()
            if device is None:
                return {"device_id": device_id, "status": "FAILED", "error": "Device not found"}
            try:
                summary = await self.sync_device(db, device, full=full)
                await db.commit()
                return summary
            except DeviceSyncBusyError as exc:
                await db.rollback()
                return {
                    "device_id": device.id,
                    "device_name": device.name,
                    "device_ip": device.ip_address,
                    "status": "BUSY",
                    "error": str(exc),
                    "retry_count": 0,
                }
            except Exception as exc:
                logger.error("[%s] Isolated sync failed: %s", device.name, exc)
                try:
                    await db.commit()
                except Exception:
                    await db.rollback()
                return {
                    "device_id": device.id,
                    "device_name": device.name,
                    "device_ip": device.ip_address,
                    "status": "FAILED",
                    "error": str(exc),
                    "retry_count": get_settings().device_max_retries,
                }

    async def sync_device(self, db: AsyncSession, device: Device, full: bool = False) -> dict:
        """Sync a single device. Returns summary of the operation."""
        claimed = await self._claim_device(device.id)
        if not claimed:
            raise DeviceSyncBusyError(
                f"Sync already running for {device.name} ({device.ip_address}:{device.port})"
            )

        started = time.monotonic()
        retry_count = 0
        manager: DeviceManager | None = None
        try:
            sync_log = DeviceSyncLog(
                device_id=device.id,
                started_at=now(),
                status="RUNNING",
            )
            db.add(sync_log)
            await db.flush()
            device.connection_status = "SYNCING"
            await db.flush()

            latest_time = await db.scalar(
                select(func.max(AttendancePunch.punch_time)).where(AttendancePunch.device_id == device.id)
            )
            settings = get_settings()
            clear_after = bool(settings.device_clear_log_after_sync)
            since = persist_cursor_for_sync(
                full=full,
                latest_time=latest_time,
                lookback_minutes=settings.device_sync_lookback_minutes,
                clear_after=clear_after,
            )
            sync_mode = sync_mode_for(full=full, latest_time=latest_time, clear_after=clear_after)

            logger.info(
                "[%s] Sync started mode=%s transport=%s cursor=%s clear_after=%s",
                device.name,
                sync_mode,
                getattr(device, "preferred_transport", None) or "auto",
                since,
                clear_after,
            )

            adapter = create_device_adapter(
                ip=device.ip_address,
                port=device.port,
                password=device.communication_password,
                name=device.name,
                transport=getattr(device, "preferred_transport", None) or "auto",
            )
            manager = DeviceManager(adapter, name=device.name)
            loop = asyncio.get_running_loop()
            raw_logs = await loop.run_in_executor(
                None, lambda: manager.fetch_attendance(since=since)
            )
            retry_count = max(0, manager.last_attempts - 1)
            terminal_records = manager.terminal_record_count or len(raw_logs)

            logs_found = len(raw_logs)
            logs_inserted = 0
            logs_skipped = 0

            batch_size = max(1, settings.device_persist_batch_size)
            logger.info(
                "[%s] Persisting %d new/relevant records (terminal reported %d) in batches of %d",
                device.name,
                logs_found,
                terminal_records,
                batch_size,
            )

            for batch_number, batch in enumerate(_chunked(raw_logs, batch_size), start=1):
                inserted, skipped = await self._ingest_batch(db, device.id, batch)
                logs_inserted += inserted
                logs_skipped += skipped
                await db.commit()
                db.add(sync_log)
                await db.refresh(sync_log)
                logger.info(
                    "[%s] Persisted batch %d: +%d created, %d skipped",
                    device.name,
                    batch_number,
                    inserted,
                    skipped,
                )

            current_time = now()
            learned = manager.last_transport
            if learned in {"tcp", "udp"}:
                device.preferred_transport = learned
            device.connection_status = "ONLINE"
            device.last_seen_at = current_time
            device.last_sync_at = current_time
            device.last_error = None

            sync_log.completed_at = current_time
            sync_log.status = "SUCCESS"
            sync_log.logs_found = logs_found
            sync_log.logs_inserted = logs_inserted
            sync_log.logs_skipped = logs_skipped
            if hasattr(sync_log, "retry_count"):
                sync_log.retry_count = retry_count
            await db.flush()
            await db.commit()

            device_log_cleared = False
            if should_clear_device_log(
                succeeded=True,
                enabled=clear_after,
                terminal_records=terminal_records,
                logs_found=logs_found,
            ):
                logger.info(
                    "[%s] Clearing terminal attendance memory after successful persist (CMD_CLEAR_ATTLOG)",
                    device.name,
                )
                try:
                    await loop.run_in_executor(None, manager.clear_attendance)
                    device_log_cleared = True
                    logger.info("[%s] Terminal attendance memory cleared", device.name)
                except Exception as exc:
                    logger.warning(
                        "[%s] Persist succeeded but terminal log clear failed; next cycle will re-download (idempotent): %s",
                        device.name,
                        exc,
                    )

            duration = time.monotonic() - started
            logger.info(
                "[%s] Sync completed mode=%s transport=%s: %d relevant, %d created, %d skipped, terminal=%d cleared=%s (%.1fs)",
                device.name,
                sync_mode,
                learned or "unknown",
                logs_found,
                logs_inserted,
                logs_skipped,
                terminal_records,
                device_log_cleared,
                duration,
            )

            return {
                "device_id": device.id,
                "device_name": device.name,
                "device_ip": device.ip_address,
                "status": "SUCCESS",
                "sync_mode": sync_mode,
                "transport": learned,
                "terminal_records": terminal_records,
                "logs_found": logs_found,
                "logs_inserted": logs_inserted,
                "logs_skipped": logs_skipped,
                "retry_count": retry_count,
                "device_log_cleared": device_log_cleared,
                "duration_seconds": round(duration, 2),
                "error": None,
            }

        except DeviceSyncBusyError:
            raise
        except Exception as exc:
            reason = classify_exception(exc)
            retry_count = max(manager.last_attempts if manager is not None else 0, 1)
            if isinstance(exc, (DeviceConnectionError, DeviceAuthenticationError)) and "Possible causes" in str(exc):
                diagnostic = str(exc)
            else:
                diagnostic = format_diagnostic(
                    device.name,
                    device.ip_address,
                    device.port,
                    reason,
                    str(exc),
                )
            duration = time.monotonic() - started
            sync_log.completed_at = now()
            sync_log.status = "FAILED"
            sync_log.error_message = diagnostic
            if hasattr(sync_log, "retry_count"):
                sync_log.retry_count = retry_count
            device.last_error = diagnostic
            device.connection_status = "DEGRADED" if device.last_sync_at else "OFFLINE"
            await db.flush()
            logger.error(
                "[%s] Sync FAILED after %.1fs: %s",
                device.name,
                duration,
                short_reason_label(reason),
            )
            return {
                "device_id": device.id,
                "device_name": device.name,
                "device_ip": device.ip_address,
                "status": "FAILED",
                "sync_mode": "incremental",
                "transport": manager.last_transport if manager is not None else None,
                "logs_found": sync_log.logs_found or 0,
                "logs_inserted": sync_log.logs_inserted or 0,
                "logs_skipped": sync_log.logs_skipped or 0,
                "retry_count": retry_count,
                "device_log_cleared": False,
                "duration_seconds": round(duration, 2),
                "error": diagnostic,
                "error_type": reason,
            }
        finally:
            await self._release_device(device.id)

    async def _ingest_batch(
        self, db: AsyncSession, device_id: int, logs: list[DeviceAttendanceLog]
    ) -> tuple[int, int]:
        """Insert a batch of punches. Idempotent via unique (device, user, time)."""
        if not logs:
            return 0, 0

        prepared: list[tuple[str, object, DeviceAttendanceLog]] = []
        seen: set[tuple[str, object]] = set()
        skipped = 0
        for log in logs:
            punch_time = make_aware(log.timestamp) if log.timestamp.tzinfo is None else log.timestamp
            key = (str(log.user_id), punch_time)
            if key in seen:
                skipped += 1
                continue
            seen.add(key)
            prepared.append((key[0], punch_time, log))

        if not prepared:
            return 0, skipped

        existing_rows = await db.execute(
            select(AttendancePunch.biometric_user_id, AttendancePunch.punch_time).where(
                AttendancePunch.device_id == device_id,
                or_(
                    *[
                        and_(
                            AttendancePunch.biometric_user_id == user_id,
                            AttendancePunch.punch_time == punch_time,
                        )
                        for user_id, punch_time, _log in prepared
                    ]
                ),
            )
        )
        existing = {(row[0], row[1]) for row in existing_rows.all()}

        to_insert: list[AttendancePunch] = []
        for user_id, punch_time, log in prepared:
            if (user_id, punch_time) in existing:
                skipped += 1
                continue
            punch_type = None
            if log.punch == 0:
                punch_type = "IN"
            elif log.punch == 1:
                punch_type = "OUT"
            to_insert.append(
                AttendancePunch(
                    device_id=device_id,
                    biometric_user_id=user_id,
                    punch_time=punch_time,
                    punch_type=punch_type,
                    verified=log.status,
                    raw_status=log.status,
                    raw_work_code=log.punch,
                    source="DEVICE",
                )
            )
            existing.add((user_id, punch_time))

        if not to_insert:
            return 0, skipped

        try:
            async with db.begin_nested():
                db.add_all(to_insert)
                await db.flush()
            return len(to_insert), skipped
        except IntegrityError:
            inserted = 0
            for punch in to_insert:
                if await self._insert_one(db, punch):
                    inserted += 1
                else:
                    skipped += 1
            return inserted, skipped

    async def _insert_one(self, db: AsyncSession, punch: AttendancePunch) -> bool:
        try:
            async with db.begin_nested():
                db.add(punch)
                await db.flush()
            return True
        except IntegrityError:
            return False

    async def _ingest_punch(
        self, db: AsyncSession, device_id: int, log: DeviceAttendanceLog
    ) -> bool:
        """Insert a single punch if not duplicate. Returns True if inserted."""
        inserted, _skipped = await self._ingest_batch(db, device_id, [log])
        return inserted == 1
