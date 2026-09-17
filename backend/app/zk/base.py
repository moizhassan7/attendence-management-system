"""Abstract base for biometric attendance devices — enables dependency injection."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass
class DeviceUser:
    """User record from a biometric device."""
    uid: int
    user_id: str
    name: str
    privilege: int = 0
    password: str = ""
    group_id: str = ""
    card: int = 0


@dataclass
class DeviceAttendanceLog:
    """Single attendance punch from a biometric device."""
    user_id: str
    timestamp: datetime
    status: int = 0  # raw device status
    punch: int = 0   # raw punch code
    uid: int = 0


@dataclass
class DeviceInfo:
    """Device information."""
    serial_number: str = ""
    firmware_version: str = ""
    platform: str = ""
    device_name: str = ""
    mac_address: str = ""
    user_count: int = 0
    log_count: int = 0


@dataclass
class DeviceTemplate:
    """Fingerprint template from biometric device."""
    uid: int
    fid: int = 0
    size: int = 0
    valid: int = 1


class BaseAttendanceDevice(ABC):
    """Interface that both ZKTeco and Mock adapters must implement."""

    @abstractmethod
    def connect(self) -> bool:
        """Establish connection to device. Returns True on success."""
        ...

    @abstractmethod
    def disconnect(self) -> None:
        """Close connection to device."""
        ...

    @abstractmethod
    def test_connection(self) -> dict[str, Any]:
        """Test connectivity and return device info dict."""
        ...

    @abstractmethod
    def get_users(self) -> list[DeviceUser]:
        """Retrieve all enrolled users from device."""
        ...

    @abstractmethod
    def set_user(
        self,
        user_id: str,
        name: str,
        privilege: int = 0,
        password: str = "",
        group_id: str = "1",
        card: int = 0,
    ) -> bool:
        """Create or update a user on the device."""
        ...

    @abstractmethod
    def enroll_fingerprint(self, user_id: str, temp_id: int = 0) -> bool:
        """Trigger remote fingerprint enrollment prompt on device."""
        ...

    @abstractmethod
    def get_templates(self) -> list[DeviceTemplate]:
        """Retrieve all biometric templates from device."""
        ...

    @abstractmethod
    def delete_user(self, user_id: str) -> bool:
        """Delete user from device."""
        ...

    @abstractmethod
    def get_attendance(self) -> list[DeviceAttendanceLog]:
        """Retrieve all attendance logs from device."""
        ...

    @abstractmethod
    def clear_attendance(self) -> bool:
        """Wipe attendance logs on the physical device after they have been saved."""
        ...

    @abstractmethod
    def get_device_info(self) -> DeviceInfo:
        """Get device hardware/firmware information."""
        ...

    @abstractmethod
    def enable(self) -> None:
        """Re-enable device after maintenance."""
        ...

    @abstractmethod
    def disable(self) -> None:
        """Temporarily disable device (e.g., during log read)."""
        ...

