"""Device schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class DeviceCreate(BaseModel):
    name: str
    ip_address: str
    port: int = 4370
    communication_password: str | None = None
    enabled: bool = True
    location: str | None = None
    preferred_transport: str = "auto"


class DeviceUpdate(BaseModel):
    name: str | None = None
    ip_address: str | None = None
    port: int | None = None
    communication_password: str | None = None
    enabled: bool | None = None
    location: str | None = None
    preferred_transport: str | None = None


class DeviceOut(BaseModel):
    id: int
    name: str
    ip_address: str
    port: int
    enabled: bool
    location: str | None
    last_seen_at: datetime | None
    last_sync_at: datetime | None
    preferred_transport: str = "auto"
    connection_status: str
    last_error: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DeviceTestResult(BaseModel):
    connected: bool
    serial_number: str | None = None
    firmware_version: str | None = None
    platform: str | None = None
    device_name: str | None = None
    mac_address: str | None = None
    user_count: int = 0
    log_count: int = 0
    error: str | None = None


class DeviceSyncResult(BaseModel):
    device_id: int
    device_name: str
    status: str
    device_ip: str | None = None
    logs_found: int = 0
    logs_inserted: int = 0
    logs_skipped: int = 0
    retry_count: int = 0
    duration_seconds: float | None = None
    sync_mode: str | None = None
    transport: str | None = None
    terminal_records: int = 0
    device_log_cleared: bool = False
    error: str | None = None
    error_type: str | None = None
