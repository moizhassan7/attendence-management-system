"""Device management API endpoints."""

from __future__ import annotations

import asyncio
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.device import Device
from app.models.device_sync_log import DeviceSyncLog
from app.schemas.common import ApiResponse, PaginatedResponse, PaginationMeta
from app.schemas.device import DeviceCreate, DeviceOut, DeviceUpdate, DeviceTestResult, DeviceSyncResult
from app.zk.device_manager import DeviceManager, create_device_adapter
from app.zk.sync_service import SyncService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("/stats", response_model=ApiResponse)
async def device_stats(db: AsyncSession = Depends(get_db)):
    """Summary metrics of connected devices."""
    total = await db.scalar(select(func.count(Device.id))) or 0
    online = await db.scalar(select(func.count(Device.id)).where(Device.connection_status == "ONLINE")) or 0
    offline = await db.scalar(select(func.count(Device.id)).where(Device.connection_status != "ONLINE")) or 0
    enabled = await db.scalar(select(func.count(Device.id)).where(Device.enabled == True)) or 0
    
    # Latest sync
    latest_sync_res = await db.execute(
        select(DeviceSyncLog).order_by(DeviceSyncLog.started_at.desc()).limit(1)
    )
    latest_sync = latest_sync_res.scalar_one_or_none()
    
    return ApiResponse(data={
        "total": total,
        "online": online,
        "offline": offline,
        "enabled": enabled,
        "last_sync_at": latest_sync.started_at.isoformat() if latest_sync else None,
        "last_sync_status": latest_sync.status if latest_sync else None,
        "last_sync_inserted": latest_sync.logs_inserted if latest_sync else 0,
    })


@router.get("/logs", response_model=ApiResponse)
async def device_sync_logs(
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db)
):
    """Recent device synchronization logs."""
    result = await db.execute(
        select(DeviceSyncLog)
        .order_by(DeviceSyncLog.started_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()
    
    out = []
    for l in logs:
        dev_name = l.device.name if l.device else f"Device #{l.device_id}"
        dev_ip = l.device.ip_address if l.device else "N/A"
        out.append({
            "id": l.id,
            "device_id": l.device_id,
            "device_name": dev_name,
            "device_ip": dev_ip,
            "status": l.status,
            "logs_found": l.logs_found,
            "logs_inserted": l.logs_inserted,
            "logs_skipped": l.logs_skipped,
            "started_at": l.started_at.isoformat() if l.started_at else None,
            "completed_at": l.completed_at.isoformat() if l.completed_at else None,
            "error_message": l.error_message,
        })
    return ApiResponse(data=out)


@router.post("/sync-all", response_model=ApiResponse)
async def sync_all_devices(db: AsyncSession = Depends(get_db)):
    """Trigger synchronization for all enabled devices."""
    sync_service = SyncService()
    summary = await sync_service.sync_all_devices(db)
    return ApiResponse(data=summary, message=f"Sync completed. {summary.get('success', 0)} devices synced.")


@router.get("", response_model=PaginatedResponse)
async def list_devices(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
    db: AsyncSession = Depends(get_db),
):
    """List all devices with pagination."""
    # Count
    count_result = await db.execute(select(func.count(Device.id)))
    total = count_result.scalar() or 0

    # Fetch
    result = await db.execute(
        select(Device)
        .order_by(Device.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    devices = result.scalars().all()

    return PaginatedResponse(
        data=[DeviceOut.model_validate(d) for d in devices],
        pagination=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@router.get("/{device_id}", response_model=ApiResponse)
async def get_device(device_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single device by ID."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return ApiResponse(data=DeviceOut.model_validate(device))


@router.post("", response_model=ApiResponse, status_code=201)
async def create_device(payload: DeviceCreate, db: AsyncSession = Depends(get_db)):
    """Register a new device."""
    # Check for duplicate IP
    existing = await db.execute(
        select(Device).where(Device.ip_address == payload.ip_address)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Device with this IP already exists")

    device = Device(**payload.model_dump())
    db.add(device)
    await db.flush()
    return ApiResponse(data=DeviceOut.model_validate(device), message="Device created")


@router.put("/{device_id}", response_model=ApiResponse)
async def update_device(
    device_id: int, payload: DeviceUpdate, db: AsyncSession = Depends(get_db)
):
    """Update device configuration."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(device, key, value)

    await db.flush()
    return ApiResponse(data=DeviceOut.model_validate(device), message="Device updated")


@router.delete("/{device_id}", response_model=ApiResponse)
async def delete_device(device_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a device."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    await db.delete(device)
    return ApiResponse(message="Device deleted")


@router.post("/{device_id}/test", response_model=ApiResponse)
async def test_device_connection(device_id: int, db: AsyncSession = Depends(get_db)):
    """Test connectivity to a device."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    try:
        adapter = create_device_adapter(
            ip=device.ip_address,
            port=device.port,
            password=device.communication_password,
        )
        loop = asyncio.get_running_loop()
        test_result = await loop.run_in_executor(None, adapter.test_connection)
        return ApiResponse(data=DeviceTestResult(**test_result))
    except Exception as e:
        logger.error("Test connection failed for device %s: %s", device.name, e)
        return ApiResponse(
            data=DeviceTestResult(connected=False, error=str(e)),
            message=f"Connection failed: {e}",
        )


@router.post("/{device_id}/sync", response_model=ApiResponse)
async def sync_device_now(device_id: int, db: AsyncSession = Depends(get_db)):
    """Trigger immediate sync for a device."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    try:
        sync_service = SyncService()
        sync_result = await sync_service.sync_device(db, device)
        return ApiResponse(data=DeviceSyncResult(**sync_result), message="Sync complete")
    except Exception as e:
        logger.error("Manual sync failed for device %s: %s", device.name, e)
        return ApiResponse(
            success=False,
            data=DeviceSyncResult(
                device_id=device.id,
                device_name=device.name,
                status="FAILED",
                error=str(e),
            ),
            message=f"Sync failed: {e}",
        )


@router.patch("/{device_id}/enable", response_model=ApiResponse)
async def enable_device(device_id: int, db: AsyncSession = Depends(get_db)):
    """Enable a device for sync."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    device.enabled = True
    return ApiResponse(message="Device enabled")


@router.patch("/{device_id}/disable", response_model=ApiResponse)
async def disable_device(device_id: int, db: AsyncSession = Depends(get_db)):
    """Disable a device from sync."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    device.enabled = False
    return ApiResponse(message="Device disabled")


@router.post("/{device_id}/users", response_model=ApiResponse)
async def fetch_device_users(device_id: int, db: AsyncSession = Depends(get_db)):
    """Fetch enrolled users from a device (for mapping)."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    try:
        adapter = create_device_adapter(
            ip=device.ip_address,
            port=device.port,
            password=device.communication_password,
        )
        manager = DeviceManager(adapter)
        loop = asyncio.get_running_loop()
        users = await loop.run_in_executor(None, manager.fetch_users)
        return ApiResponse(
            data=[
                {"uid": u.uid, "user_id": u.user_id, "name": u.name, "privilege": u.privilege}
                for u in users
            ]
        )
    except Exception as e:
        logger.error("Failed to fetch users from device %s: %s", device.name, e)
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {e}")
