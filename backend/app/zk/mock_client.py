"""Mock ZKTeco device adapter for development/testing."""

from __future__ import annotations

import logging
import random
from datetime import datetime
from typing import Any

from app.utils.timezone import get_tz, today
from app.zk.base import (
    BaseAttendanceDevice,
    DeviceAttendanceLog,
    DeviceInfo,
    DeviceTemplate,
    DeviceUser,
)
from app.services.pin_allocator import require_numeric_device_pin

logger = logging.getLogger(__name__)

# Simulated employee pool
_MOCK_EMPLOYEES = [
    ("1001", "Muhammad Ali Khan"),
    ("1002", "Ahmed Hassan"),
    ("1003", "Fatima Zahra"),
    ("1004", "Usman Ghani"),
    ("1005", "Zainab Bibi"),
    ("1006", "Bilal Ahmad"),
    ("1007", "Sana Malik"),
    ("1008", "Imran Hussain"),
    ("1009", "Ayesha Siddiqui"),
    ("1010", "Rashid Mehmood"),
    ("1011", "Nadia Parveen"),
    ("1012", "Tariq Aziz"),
    ("1013", "Hira Batool"),
    ("1014", "Kamran Akbar"),
    ("1015", "Saima Noor"),
    ("1016", "Farhan Raza"),
    ("1017", "Amina Yousuf"),
    ("1018", "Naveed Iqbal"),
    ("1019", "Rabia Sultan"),
    ("1020", "Waqas Aslam"),
]


class MockZKDeviceAdapter(BaseAttendanceDevice):
    """Development-only mock that simulates a ZKTeco device."""

    def __init__(self, ip: str, port: int = 4370, password: str | None = None, name: str | None = None):
        self.ip = ip
        self.port = port
        self.password = password
        self.name = name or ip
        self.last_transport = "tcp"
        self.terminal_record_count = 0
        self._connected = False

    def set_io_timeout(self, seconds: int) -> None:
        return None

    def connect(self, timeout: int | None = None) -> bool:
        self._connected = True
        logger.info("[MOCK] Connected to simulated device at %s:%s", self.ip, self.port)
        return True

    def disconnect(self) -> None:
        self._connected = False
        logger.info("[MOCK] Disconnected from simulated device at %s:%s", self.ip, self.port)

    def test_connection(self) -> dict[str, Any]:
        return {
            "connected": True,
            "serial_number": "MOCK-SN-001",
            "firmware_version": "Ver 6.60 Oct 20 2023 (Mock)",
            "platform": "ZMM220_TFT",
            "device_name": "Mock ZKTeco F18",
            "mac_address": "00:17:61:AA:BB:CC",
            "user_count": len(_MOCK_EMPLOYEES),
            "log_count": 0,
        }

    def get_users(self) -> list[DeviceUser]:
        return [
            DeviceUser(
                uid=i + 1,
                user_id=uid,
                name=name,
                privilege=0 if i > 0 else 14,
            )
            for i, (uid, name) in enumerate(_MOCK_EMPLOYEES)
        ]

    def set_user(
        self,
        user_id: str,
        name: str,
        privilege: int = 0,
        password: str = "",
        group_id: str = "1",
        card: int = 0,
    ) -> bool:
        logger.info("[MOCK] User set on device: PIN=%s, Name=%s", user_id, name)
        require_numeric_device_pin(user_id)
        return True

    def enroll_fingerprint(self, user_id: str, temp_id: int = 0, replace: bool = False) -> bool:
        logger.info("[MOCK] Fingerprint enrolled for user PIN=%s replace=%s", user_id, replace)
        require_numeric_device_pin(user_id)
        return True

    def get_templates(self) -> list[DeviceTemplate]:
        return [
            DeviceTemplate(uid=i + 1, fid=0, size=1024, valid=1)
            for i in range(len(_MOCK_EMPLOYEES))
        ]

    def delete_user(self, user_id: str) -> bool:
        logger.info("[MOCK] User deleted from device: PIN=%s", user_id)
        return True

    def get_attendance(self, since=None) -> list[DeviceAttendanceLog]:
        """Generate realistic attendance logs for today."""
        logs: list[DeviceAttendanceLog] = []
        tz = get_tz()
        current_date = today()

        for uid, _name in _MOCK_EMPLOYEES:
            # ~90% show up
            if random.random() > 0.90:
                continue

            # Morning punch: 08:15 - 09:15
            hour_in = 8
            minute_in = random.randint(15, 55)
            if random.random() < 0.15:  # some come late
                hour_in = 9
                minute_in = random.randint(0, 15)

            punch_in = datetime(
                current_date.year, current_date.month, current_date.day,
                hour_in, minute_in, random.randint(0, 59),
                tzinfo=tz,
            )

            logs.append(DeviceAttendanceLog(
                user_id=uid,
                timestamp=punch_in,
                status=1,  # fingerprint
                punch=0,   # IN
            ))

            # Afternoon/evening punch: 16:30 - 18:00
            if random.random() < 0.85:  # some haven't left yet
                hour_out = random.choice([16, 17])
                minute_out = random.randint(0, 59)
                punch_out = datetime(
                    current_date.year, current_date.month, current_date.day,
                    hour_out, minute_out, random.randint(0, 59),
                    tzinfo=tz,
                )
                logs.append(DeviceAttendanceLog(
                    user_id=uid,
                    timestamp=punch_out,
                    status=1,
                    punch=1,  # OUT
                ))

        logger.info("[MOCK] Generated %d attendance logs for %s", len(logs), current_date)
        self.terminal_record_count = len(logs)
        if since is None:
            return logs
        since_cmp = since.replace(tzinfo=None) if since.tzinfo is not None else since
        return [
            log for log in logs
            if (log.timestamp.replace(tzinfo=None) if log.timestamp.tzinfo else log.timestamp) >= since_cmp
        ]

    def clear_attendance(self) -> bool:
        logger.info("[MOCK] Cleared attendance log on simulated device %s", self.ip)
        self.terminal_record_count = 0
        return True

    def get_device_info(self) -> DeviceInfo:
        return DeviceInfo(
            serial_number="MOCK-SN-001",
            firmware_version="Ver 6.60 Oct 20 2023 (Mock)",
            platform="ZMM220_TFT",
            device_name="Mock ZKTeco F18",
            mac_address="00:17:61:AA:BB:CC",
            user_count=len(_MOCK_EMPLOYEES),
            log_count=0,
        )

    def enable(self) -> None:
        logger.debug("[MOCK] Device enabled")

    def disable(self) -> None:
        logger.debug("[MOCK] Device disabled")
