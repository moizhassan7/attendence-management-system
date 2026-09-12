"""Device connection lifecycle manager."""

from __future__ import annotations

import logging
from typing import Any

from app.config import get_settings
from app.zk.base import BaseAttendanceDevice, DeviceAttendanceLog, DeviceUser
from app.zk.exceptions import DeviceConnectionError
from app.zk.mock_client import MockZKDeviceAdapter
from app.zk.zk_client import ZKTecoDeviceAdapter

logger = logging.getLogger(__name__)


def create_device_adapter(
    ip: str, port: int = 4370, password: str | None = None
) -> BaseAttendanceDevice:
    """Factory: returns Mock or Real adapter based on config."""
    settings = get_settings()
    if settings.use_mock_device:
        return MockZKDeviceAdapter(ip=ip, port=port, password=password)
    return ZKTecoDeviceAdapter(ip=ip, port=port, password=password)


class DeviceManager:
    """Manages the connect → disable → read → enable → disconnect lifecycle."""

    def __init__(self, adapter: BaseAttendanceDevice):
        self.adapter = adapter

    def test_connection(self) -> dict[str, Any]:
        """Quick connectivity + info check."""
        return self.adapter.test_connection()

    def fetch_attendance(self) -> list[DeviceAttendanceLog]:
        """Full sync lifecycle — connect, disable, read, enable, disconnect."""
        self.adapter.connect()
        try:
            self.adapter.disable()
            try:
                logs = self.adapter.get_attendance()
                logger.info("Fetched %d attendance logs", len(logs))
                return logs
            finally:
                self.adapter.enable()
        finally:
            self.adapter.disconnect()

    def fetch_users(self) -> list[DeviceUser]:
        """Fetch enrolled users with full lifecycle."""
        self.adapter.connect()
        try:
            self.adapter.disable()
            try:
                users = self.adapter.get_users()
                logger.info("Fetched %d users from device", len(users))
                return users
            finally:
                self.adapter.enable()
        finally:
            self.adapter.disconnect()
