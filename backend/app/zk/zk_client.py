"""Real ZKTeco device adapter using pyzk library."""

from __future__ import annotations

import logging
from typing import Any

from app.config import get_settings
from app.zk.base import (
    BaseAttendanceDevice,
    DeviceAttendanceLog,
    DeviceInfo,
    DeviceTemplate,
    DeviceUser,
)
from app.zk.exceptions import (
    DeviceAuthenticationError,
    DeviceConnectionError,
    DeviceReadError,
    DeviceTimeoutError,
)

logger = logging.getLogger(__name__)


class ZKTecoDeviceAdapter(BaseAttendanceDevice):
    """Production adapter — communicates with real ZKTeco hardware via pyzk."""

    def __init__(self, ip: str, port: int = 4370, password: str | None = None):
        self.ip = ip
        self.port = port
        self.password = password or ""
        self._conn = None
        self._settings = get_settings()

    def connect(self) -> bool:
        """Open TCP connection to ZKTeco device."""
        try:
            from zk import ZK

            zk = ZK(
                self.ip,
                port=self.port,
                timeout=self._settings.device_timeout_seconds,
                password=int(self.password) if self.password else 0,
                force_udp=False,
                ommit_ping=True,
            )
            self._conn = zk.connect()
            if self._conn is None:
                raise DeviceConnectionError(f"Connection returned None for {self.ip}:{self.port}")
            logger.info("Connected to ZKTeco device at %s:%s", self.ip, self.port)
            return True
        except ImportError:
            raise DeviceConnectionError(
                "pyzk library not installed. Install with: pip install pyzk"
            )
        except Exception as e:
            error_msg = str(e)
            if "timeout" in error_msg.lower():
                raise DeviceTimeoutError(f"Timeout connecting to {self.ip}:{self.port}: {error_msg}")
            if "password" in error_msg.lower() or "auth" in error_msg.lower():
                raise DeviceAuthenticationError(f"Auth failed for {self.ip}:{self.port}: {error_msg}")
            raise DeviceConnectionError(f"Failed to connect to {self.ip}:{self.port}: {error_msg}")

    def disconnect(self) -> None:
        """Close connection to device."""
        if self._conn:
            try:
                self._conn.disconnect()
                logger.info("Disconnected from ZKTeco device at %s:%s", self.ip, self.port)
            except Exception as e:
                logger.warning("Error disconnecting from %s:%s: %s", self.ip, self.port, e)
            finally:
                self._conn = None

    def test_connection(self) -> dict[str, Any]:
        """Connect, get basic info, disconnect."""
        self.connect()
        try:
            info = self.get_device_info()
            return {
                "connected": True,
                "serial_number": info.serial_number,
                "firmware_version": info.firmware_version,
                "platform": info.platform,
                "device_name": info.device_name,
                "mac_address": info.mac_address,
                "user_count": info.user_count,
                "log_count": info.log_count,
            }
        finally:
            self.disconnect()

    def get_users(self) -> list[DeviceUser]:
        """Retrieve enrolled users."""
        if not self._conn:
            raise DeviceConnectionError("Not connected")
        try:
            users = self._conn.get_users()
            return [
                DeviceUser(
                    uid=u.uid,
                    user_id=str(u.user_id),
                    name=u.name or "",
                    privilege=u.privilege,
                    password=u.password or "",
                    group_id=str(u.group_id) if hasattr(u, 'group_id') else "",
                    card=u.card if hasattr(u, 'card') else 0,
                )
                for u in (users or [])
            ]
        except Exception as e:
            raise DeviceReadError(f"Failed to read users: {e}")

    def set_user(
        self,
        user_id: str,
        name: str,
        privilege: int = 0,
        password: str = "",
        group_id: str = "1",
        card: int = 0,
    ) -> bool:
        """Create or update user on the device."""
        if not self._conn:
            raise DeviceConnectionError("Not connected")
        try:
            existing_users = self._conn.get_users() or []
            existing = next((u for u in existing_users if str(u.user_id) == str(user_id)), None)
            if existing:
                uid = existing.uid
            else:
                max_uid = max([u.uid for u in existing_users], default=0)
                uid = max_uid + 1

            self._conn.set_user(
                uid=uid,
                name=name,
                privilege=privilege,
                password=password,
                group_id=str(group_id),
                user_id=str(user_id),
                card=card,
            )
            try:
                self._conn.refresh_data()
            except Exception:
                pass
            logger.info("Set user %s (%s) on device %s (uid=%d)", user_id, name, self.ip, uid)
            return True
        except Exception as e:
            logger.error("Failed to set user %s on device %s: %s", user_id, self.ip, e)
            raise DeviceReadError(f"Failed to set user on device: {e}")

    def enroll_fingerprint(self, user_id: str, temp_id: int = 0) -> bool:
        """Trigger remote fingerprint enrollment prompt on device."""
        if not self._conn:
            raise DeviceConnectionError("Not connected")
        try:
            existing_users = self._conn.get_users() or []
            user = next((u for u in existing_users if str(u.user_id) == str(user_id)), None)
            if not user:
                max_uid = max([u.uid for u in existing_users], default=0)
                uid = max_uid + 1
                self._conn.set_user(
                    uid=uid,
                    name=str(user_id),
                    privilege=0,
                    password="",
                    group_id="1",
                    user_id=str(user_id),
                    card=0,
                )
                try:
                    self._conn.refresh_data()
                except Exception:
                    pass
            else:
                uid = user.uid

            logger.info("Starting remote enrollment for user %s (uid=%d) on %s", user_id, uid, self.ip)
            success = self._conn.enroll_user(uid=uid, temp_id=temp_id, user_id=str(user_id))
            return bool(success)
        except Exception as e:
            logger.error("Enrollment failed for user %s on %s: %s", user_id, self.ip, e)
            raise DeviceReadError(f"Enrollment failed on device: {e}")
        finally:
            try:
                self._conn.cancel_capture()
                self._conn.verify_user()
            except Exception:
                pass

    def get_templates(self) -> list[DeviceTemplate]:
        """Retrieve enrolled fingerprint templates from device."""
        if not self._conn:
            raise DeviceConnectionError("Not connected")
        try:
            raw_templates = self._conn.get_templates() or []
            return [
                DeviceTemplate(
                    uid=t.uid,
                    fid=t.fid if hasattr(t, "fid") else 0,
                    size=t.size if hasattr(t, "size") else 0,
                    valid=t.valid if hasattr(t, "valid") else 1,
                )
                for t in raw_templates
            ]
        except Exception as e:
            logger.warning("Failed to read templates from device %s: %s", self.ip, e)
            return []

    def delete_user(self, user_id: str) -> bool:
        """Delete user from device."""
        if not self._conn:
            raise DeviceConnectionError("Not connected")
        try:
            existing_users = self._conn.get_users() or []
            user = next((u for u in existing_users if str(u.user_id) == str(user_id)), None)
            if user:
                self._conn.delete_user(uid=user.uid, user_id=str(user_id))
                try:
                    self._conn.refresh_data()
                except Exception:
                    pass
                logger.info("Deleted user %s from device %s", user_id, self.ip)
                return True
            return False
        except Exception as e:
            logger.error("Failed to delete user %s from %s: %s", user_id, self.ip, e)
            raise DeviceReadError(f"Failed to delete user from device: {e}")

    def get_attendance(self) -> list[DeviceAttendanceLog]:
        """Retrieve attendance logs."""
        if not self._conn:
            raise DeviceConnectionError("Not connected")
        try:
            records = self._conn.get_attendance()
            return [
                DeviceAttendanceLog(
                    user_id=str(r.user_id),
                    timestamp=r.timestamp,
                    status=r.status if hasattr(r, 'status') else 0,
                    punch=r.punch if hasattr(r, 'punch') else 0,
                    uid=r.uid if hasattr(r, 'uid') else 0,
                )
                for r in (records or [])
            ]
        except Exception as e:
            raise DeviceReadError(f"Failed to read attendance: {e}")

    def get_device_info(self) -> DeviceInfo:
        """Get device serial, firmware, etc."""
        if not self._conn:
            raise DeviceConnectionError("Not connected")
        try:
            serial = ""
            firmware = ""
            platform = ""
            device_name = ""
            mac = ""

            try:
                serial = self._conn.get_serialnumber() or ""
            except Exception:
                pass
            try:
                firmware = self._conn.get_firmware_version() or ""
            except Exception:
                pass
            try:
                platform = self._conn.get_platform() or ""
            except Exception:
                pass
            try:
                device_name = self._conn.get_device_name() or ""
            except Exception:
                pass
            try:
                mac = self._conn.get_mac() or ""
            except Exception:
                pass

            users = self._conn.get_users() or []
            user_count = len(users)

            log_count = 0
            try:
                attendance = self._conn.get_attendance() or []
                log_count = len(attendance)
            except Exception:
                pass

            return DeviceInfo(
                serial_number=serial,
                firmware_version=firmware,
                platform=platform,
                device_name=device_name,
                mac_address=mac,
                user_count=user_count,
                log_count=log_count,
            )
        except Exception as e:
            raise DeviceReadError(f"Failed to read device info: {e}")

    def enable(self) -> None:
        """Re-enable device."""
        if self._conn:
            try:
                self._conn.enable_device()
            except Exception as e:
                logger.warning("Failed to enable device %s: %s", self.ip, e)

    def disable(self) -> None:
        """Temporarily disable device."""
        if self._conn:
            try:
                self._conn.disable_device()
            except Exception as e:
                logger.warning("Failed to disable device %s: %s", self.ip, e)
