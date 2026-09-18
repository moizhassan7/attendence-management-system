"""Real ZKTeco device adapter using pyzk library."""

from __future__ import annotations

import logging
from datetime import datetime
from struct import unpack
from typing import Any, Iterator

from app.config import get_settings
from app.zk.base import (
    BaseAttendanceDevice,
    DeviceAttendanceLog,
    DeviceInfo,
    DeviceTemplate,
    DeviceUser,
)
from app.zk.diagnostics import probe_tcp
from app.zk.exceptions import (
    DeviceAuthenticationError,
    DeviceBusyError,
    DeviceConnectionError,
    DeviceReadError,
    DeviceTimeoutError,
    DeviceUnreachableError,
    classify_exception,
    format_diagnostic,
    short_reason_label,
)

logger = logging.getLogger(__name__)


def connect_attempts(mode: str, base_timeout: int) -> list[tuple[bool, int]]:
    """(force_udp, timeout) attempts. TCP-only PINs must not fall back to UDP."""
    selected = (mode or "auto").strip().lower()
    timeout = max(1, int(base_timeout))
    if selected == "udp":
        return [(True, timeout), (False, min(8, timeout))]
    if selected == "tcp":
        return [(False, timeout)]
    return [(False, timeout), (True, min(8, timeout))]


def _decode_zk_time(raw: bytes) -> datetime:
    """ZK packed timestamp. Same algorithm as pyzk ZK._ZK__decode_time."""
    value = unpack("<I", raw)[0]
    second = value % 60
    value //= 60
    minute = value % 60
    value //= 60
    hour = value % 24
    value //= 24
    day = value % 31 + 1
    value //= 31
    month = value % 12 + 1
    value //= 12
    year = value + 2000
    return datetime(year, month, day, hour, minute, second)


def parse_attendance_buffer(
    attendance_data: bytes,
    record_count: int,
    since: datetime | None = None,
) -> list[DeviceAttendanceLog]:
    """Parse a CMD_ATTLOG buffer already downloaded by pyzk.read_with_buffer.

    pyzk/CMD_ATTLOG_RRQ always returns the full terminal log. `since` drops older
    records while parsing so incremental sync does not process tens of thousands
    of historical punches on every cycle.
    """
    if len(attendance_data) < 4 or record_count <= 0:
        return []

    total_size = unpack("I", attendance_data[:4])[0]
    record_size = total_size / record_count
    payload = attendance_data[4:]
    since_naive = None
    if since is not None:
        since_naive = since.replace(tzinfo=None) if since.tzinfo is not None else since
    logs: list[DeviceAttendanceLog] = []

    def _keep(ts: datetime) -> bool:
        return since_naive is None or ts >= since_naive

    if record_size == 8:
        while len(payload) >= 8:
            uid, status, timestamp, punch = unpack("HB4sB", payload[:8].ljust(8, b"\x00"))
            payload = payload[8:]
            ts = _decode_zk_time(timestamp)
            if not _keep(ts):
                continue
            logs.append(
                DeviceAttendanceLog(
                    user_id=str(uid),
                    timestamp=ts,
                    status=status,
                    punch=punch,
                    uid=uid,
                )
            )
    elif record_size == 16:
        while len(payload) >= 16:
            user_id, timestamp, status, punch, _reserved, _workcode = unpack(
                "<I4sBB2sI", payload[:16].ljust(16, b"\x00")
            )
            payload = payload[16:]
            ts = _decode_zk_time(timestamp)
            if not _keep(ts):
                continue
            logs.append(
                DeviceAttendanceLog(
                    user_id=str(user_id),
                    timestamp=ts,
                    status=status,
                    punch=punch,
                    uid=int(user_id),
                )
            )
    else:
        while len(payload) >= 40:
            uid, user_id, status, timestamp, punch, _space = unpack(
                "<H24sB4sB8s", payload[:40].ljust(40, b"\x00")
            )
            payload = payload[40:]
            ts = _decode_zk_time(timestamp)
            if not _keep(ts):
                continue
            pin = (user_id.split(b"\x00")[0]).decode(errors="ignore")
            logs.append(
                DeviceAttendanceLog(
                    user_id=pin,
                    timestamp=ts,
                    status=status,
                    punch=punch,
                    uid=uid,
                )
            )
    return logs


class ZKTecoDeviceAdapter(BaseAttendanceDevice):
    """Production adapter — communicates with real ZKTeco hardware via pyzk."""

    def __init__(
        self,
        ip: str,
        port: int = 4370,
        password: str | None = None,
        name: str | None = None,
        transport: str = "auto",
    ):
        self.ip = ip
        self.port = port
        self.password = password or ""
        self.name = name or ip
        self.transport = (transport or "auto").lower()
        self.last_transport: str | None = None
        self.terminal_record_count = 0
        self._conn = None
        self._zk = None
        self._settings = get_settings()
        self.last_tcp_probe: dict[str, str] | None = None

    def _label(self) -> str:
        return self.name or self.ip

    def _connection_timeout(self) -> int:
        return self._settings.device_connection_timeout or self._settings.device_timeout_seconds

    def _command_timeout(self) -> int:
        return self._settings.device_command_timeout

    def _read_timeout(self) -> int:
        return self._settings.device_read_timeout

    def _force_close_socket(self) -> None:
        for obj in (self._conn, self._zk):
            if obj is None:
                continue
            sock = getattr(obj, "_ZK__sock", None)
            if sock is None:
                continue
            try:
                sock.close()
            except Exception:
                pass

    def set_io_timeout(self, seconds: int) -> None:
        """Apply a socket timeout to the live pyzk connection."""
        sock = None
        if self._conn is not None:
            sock = getattr(self._conn, "_ZK__sock", None)
        if sock is None and self._zk is not None:
            sock = getattr(self._zk, "_ZK__sock", None)
        if sock is not None:
            sock.settimeout(seconds)

    def _connect_once(self, force_udp: bool, timeout: int) -> bool:
        from zk import ZK

        transport = "UDP" if force_udp else "TCP"
        logger.info(
            "[%s] Connecting to %s:%s via %s (timeout=%ss)",
            self._label(),
            self.ip,
            self.port,
            transport,
            timeout,
        )
        zk = ZK(
            self.ip,
            port=self.port,
            timeout=timeout,
            password=int(self.password) if self.password else 0,
            force_udp=force_udp,
            ommit_ping=True,
        )
        self._zk = zk
        try:
            self._conn = zk.connect()
        except Exception:
            self._force_close_socket()
            self._conn = None
            self._zk = None
            raise
        if self._conn is None:
            self._force_close_socket()
            self._zk = None
            raise DeviceConnectionError(f"Connection returned None for {self.ip}:{self.port}")
        logger.info("[%s] %s connection established to %s:%s", self._label(), transport, self.ip, self.port)
        self.last_transport = "udp" if force_udp else "tcp"
        return True

    def _raise_connect_failure(self, last_error: Exception | None) -> None:
        self.last_tcp_probe = probe_tcp(self.ip, self.port, timeout=min(3, self._connection_timeout()))
        detail = str(last_error) if last_error else "unknown error"
        reason = classify_exception(last_error) if last_error else "unknown"
        tcp_status = self.last_tcp_probe.get("detail") if self.last_tcp_probe else None
        message = format_diagnostic(self._label(), self.ip, self.port, reason, detail, tcp_status)
        logger.error(
            "[%s] Connection failed: %s | TCP check: %s",
            self._label(),
            short_reason_label(reason),
            tcp_status,
        )
        if reason == "authentication":
            raise DeviceAuthenticationError(message) from last_error
        if reason == "host_unreachable":
            raise DeviceUnreachableError(message) from last_error
        if reason == "session_busy":
            raise DeviceBusyError(message) from last_error
        if reason in {"connection_timeout", "socket_timeout", "read_timeout"}:
            raise DeviceTimeoutError(message) from last_error
        raise DeviceConnectionError(message) from last_error

    def connect(self, timeout: int | None = None) -> bool:
        """Open a session using preferred transport, with one alternate fallback."""
        last_error: Exception | None = None
        base_timeout = timeout or self._connection_timeout()
        mode = (self.transport or "auto").lower()
        logger.info("[%s] Transport preference: %s", self._label(), mode)

        attempts = connect_attempts(mode, base_timeout)

        for index, (force_udp, attempt_timeout) in enumerate(attempts):
            try:
                return self._connect_once(force_udp=force_udp, timeout=attempt_timeout)
            except ImportError:
                raise DeviceConnectionError(
                    "pyzk library not installed. Install with: pip install pyzk"
                )
            except Exception as exc:
                last_error = exc
                reason = classify_exception(exc)
                logger.warning(
                    "[%s] %s connect to %s:%s failed: %s (%s)",
                    self._label(),
                    "UDP" if force_udp else "TCP",
                    self.ip,
                    self.port,
                    short_reason_label(reason),
                    exc,
                )
                self.disconnect()
                if reason == "authentication" or reason == "host_unreachable":
                    break
                if index < len(attempts) - 1:
                    logger.info("[%s] Trying alternate transport", self._label())

        self._raise_connect_failure(last_error)
        return False

    def disconnect(self) -> None:
        """Close connection to device. Always drop the socket, even if CMD_EXIT fails."""
        if not self._conn and not self._zk:
            return
        logger.info("[%s] Disconnecting from %s:%s", self._label(), self.ip, self.port)
        try:
            if self._conn is not None:
                self._conn.disconnect()
        except Exception as exc:
            logger.warning("[%s] Disconnect command failed: %s", self._label(), exc)
            self._force_close_socket()
        finally:
            self._conn = None
            self._zk = None

    def test_connection(self) -> dict[str, Any]:
        """Connect, get basic info, disconnect. Skips full log dump so Test stays fast."""
        self.connect(timeout=self._connection_timeout())
        try:
            self.set_io_timeout(self._command_timeout())
            info = self.get_device_info(include_logs=False)
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
                    group_id=str(u.group_id) if hasattr(u, "group_id") else "",
                    card=u.card if hasattr(u, "card") else 0,
                )
                for u in (users or [])
            ]
        except Exception as exc:
            raise DeviceReadError(f"Failed to read users: {exc}") from exc

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
        from app.services.pin_allocator import require_numeric_device_pin

        try:
            user_id = require_numeric_device_pin(user_id)
        except ValueError as exc:
            raise DeviceReadError(str(exc)) from exc
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
            logger.info("[%s] Set user %s (%s) uid=%d", self._label(), user_id, name, uid)
            return True
        except Exception as exc:
            logger.error("[%s] Failed to set user %s: %s", self._label(), user_id, exc)
            raise DeviceReadError(f"Failed to set user on device: {exc}") from exc

    def _clear_user_templates(self, user_id: str, uid: int) -> None:
        """Remove existing fingerprint slots so the terminal can capture a new scan."""
        if not self._conn:
            return
        for fid in range(10):
            try:
                self._conn.delete_user_template(uid=uid, temp_id=fid, user_id=str(user_id))
            except Exception:
                continue
        try:
            self._conn.refresh_data()
        except Exception:
            pass
        logger.info("[%s] Cleared fingerprint templates for user %s (uid=%d)", self._label(), user_id, uid)

    def enroll_fingerprint(self, user_id: str, temp_id: int = 0, replace: bool = False) -> bool:
        """Trigger remote fingerprint enrollment prompt on device."""
        if not self._conn:
            raise DeviceConnectionError("Not connected")
        from app.services.pin_allocator import require_numeric_device_pin

        try:
            user_id = require_numeric_device_pin(user_id)
        except ValueError as exc:
            raise DeviceReadError(str(exc)) from exc
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
                if replace:
                    self._clear_user_templates(str(user_id), uid)

            if not str(user_id).isdigit() and self.last_transport == "udp":
                raise DeviceConnectionError(
                    f"PIN {user_id} cannot enroll over UDP. Terminal must use TCP for this ID."
                )

            logger.info("[%s] Starting remote enrollment for user %s (uid=%d)", self._label(), user_id, uid)
            success = self._conn.enroll_user(uid=uid, temp_id=temp_id, user_id=str(user_id))
            return bool(success)
        except (ValueError, TypeError, DeviceConnectionError):
            raise
        except Exception as exc:
            logger.warning(
                "[%s] Enrollment command ended for user %s: %s",
                self._label(),
                user_id,
                exc,
            )
            # Scan timeout / duplicate finger: caller verifies templates afterwards.
            return False
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
        except Exception as exc:
            logger.warning("[%s] Failed to read templates: %s", self._label(), exc)
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
                logger.info("[%s] Deleted user %s", self._label(), user_id)
                return True
            return False
        except Exception as exc:
            logger.error("[%s] Failed to delete user %s: %s", self._label(), user_id, exc)
            raise DeviceReadError(f"Failed to delete user from device: {exc}") from exc

    def purge_temp_users_without_fingerprints(self) -> dict[str, int]:
        """Remove TEMP-* IDs that do not own a fingerprint template."""
        if not self._conn:
            raise DeviceConnectionError("Not connected")
        from app.services.temp_pin_cleanup import is_temp_pin, temp_users_safe_to_delete

        users = self.get_users()
        templates = self.get_templates()
        protected = {template.uid for template in templates}
        doomed = temp_users_safe_to_delete(users, protected)
        skipped_fp = sum(
            1
            for user in users
            if is_temp_pin(getattr(user, "user_id", "")) and getattr(user, "uid", None) in protected
        )
        deleted = 0
        failed = 0
        aborted = False
        starting_fingers = int(getattr(self._conn, "fingers", 0) or 0)
        try:
            self._conn.disable_device()
        except Exception:
            pass
        for user in doomed:
            try:
                ok = bool(self._conn.delete_user(uid=int(user.uid), user_id=str(user.user_id)))
                if ok:
                    deleted += 1
                else:
                    failed += 1
            except Exception:
                failed += 1
            if deleted and deleted % 10 == 0:
                try:
                    self._conn.read_sizes()
                    if starting_fingers and int(getattr(self._conn, "fingers", 0) or 0) < starting_fingers:
                        aborted = True
                        break
                except Exception:
                    pass
        try:
            self._conn.refresh_data()
        except Exception:
            pass
        try:
            self._conn.enable_device()
            self._conn.verify_user()
        except Exception:
            pass
        leftover_temp = 0
        leftover_total = -1
        try:
            leftover_users = self.get_users()
            leftover_temp = sum(1 for user in leftover_users if is_temp_pin(user.user_id))
            leftover_total = len(leftover_users)
        except Exception:
            leftover_total = -1
        logger.info(
            "[%s] Purged TEMP users without fingerprints: deleted=%d failed=%d skipped_fp=%d leftover_temp=%d",
            self._label(),
            deleted,
            failed,
            skipped_fp,
            leftover_temp,
        )
        return {
            "deleted": deleted,
            "failed": failed,
            "skipped_fp": skipped_fp,
            "protected_templates": len(protected),
            "leftover_temp": leftover_temp,
            "leftover_users": leftover_total,
            "aborted": aborted,
        }

    def _read_attendance_buffered(self, since: datetime | None = None) -> list[DeviceAttendanceLog]:
        """Download attendance via pyzk's buffered CMD_ATTLOG_RRQ (internally chunked)."""
        from zk import const

        self._conn.read_sizes()
        record_count = int(getattr(self._conn, "records", 0) or 0)
        self.terminal_record_count = record_count
        logger.info("[%s] Terminal reports %d attendance records", self._label(), record_count)
        if record_count == 0:
            logger.info("[%s] read_sizes reported 0; trying pyzk get_attendance()", self._label())
            return self._attendance_via_pyzk(since)

        logger.info("[%s] Reading attendance records", self._label())
        attendance_data, size = self._conn.read_with_buffer(const.CMD_ATTLOG_RRQ)
        if size < 4:
            logger.warning("[%s] Attendance buffer too small (%s bytes)", self._label(), size)
            return []

        logs = parse_attendance_buffer(attendance_data, record_count, since=since)
        logger.info(
            "[%s] Attendance read completed: terminal=%d relevant=%d",
            self._label(),
            record_count,
            len(logs),
        )
        return logs

    def iter_attendance_batches(self, batch_size: int = 500) -> Iterator[list[DeviceAttendanceLog]]:
        """Yield parsed attendance in application batches after a chunked protocol read."""
        logs = self.get_attendance()
        if batch_size <= 0:
            yield logs
            return
        for index in range(0, len(logs), batch_size):
            yield logs[index:index + batch_size]

    def _attendance_via_pyzk(self, since: datetime | None = None) -> list[DeviceAttendanceLog]:
        records = self._conn.get_attendance() or []
        since_naive = None
        if since is not None:
            since_naive = since.replace(tzinfo=None) if since.tzinfo is not None else since
        logs = []
        for record in records:
            ts = record.timestamp
            if since_naive is not None and ts.replace(tzinfo=None) < since_naive:
                continue
            logs.append(
                DeviceAttendanceLog(
                    user_id=str(record.user_id),
                    timestamp=ts,
                    status=record.status if hasattr(record, "status") else 0,
                    punch=record.punch if hasattr(record, "punch") else 0,
                    uid=record.uid if hasattr(record, "uid") else 0,
                )
            )
        if records:
            self.terminal_record_count = len(records)
        logger.info("[%s] pyzk get_attendance parsed %d relevant records", self._label(), len(logs))
        return logs

    def get_attendance(self, since: datetime | None = None) -> list[DeviceAttendanceLog]:
        """Retrieve attendance. Protocol dump is full; `since` filters after download."""
        if not self._conn:
            raise DeviceConnectionError("Not connected")
        try:
            return self._read_attendance_buffered(since=since)
        except Exception as buffered_error:
            logger.warning(
                "[%s] Buffered attendance read failed (%s); falling back to pyzk get_attendance()",
                self._label(),
                buffered_error,
            )
            try:
                return self._attendance_via_pyzk(since)
            except Exception as exc:
                raise DeviceReadError(f"Failed to read attendance: {exc}") from exc

    def clear_attendance(self) -> bool:
        """Wipe the terminal attendance log via pyzk CMD_CLEAR_ATTLOG."""
        if not self._conn:
            raise DeviceConnectionError("Not connected")
        try:
            ok = bool(self._conn.clear_attendance())
            if not ok:
                raise DeviceReadError("Device refused to clear attendance log")
            self.terminal_record_count = 0
            logger.info("[%s] CMD_CLEAR_ATTLOG succeeded", self._label())
            return True
        except DeviceReadError:
            raise
        except Exception as exc:
            raise DeviceReadError(f"Failed to clear attendance log: {exc}") from exc

    def get_device_info(self, include_logs: bool = True) -> DeviceInfo:
        """Get device serial, firmware, etc. Log count uses read_sizes, not a full dump."""
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

            user_count = 0
            try:
                users = self._conn.get_users() or []
                user_count = len(users)
            except Exception:
                pass

            log_count = 0
            if include_logs:
                try:
                    self._conn.read_sizes()
                    log_count = int(getattr(self._conn, "records", 0) or 0)
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
        except Exception as exc:
            raise DeviceReadError(f"Failed to read device info: {exc}") from exc

    def enable(self) -> None:
        """Re-enable device."""
        if self._conn:
            try:
                self._conn.enable_device()
            except Exception as exc:
                logger.warning("[%s] Failed to enable device: %s", self._label(), exc)

    def disable(self) -> None:
        """Temporarily disable device."""
        if self._conn:
            try:
                self._conn.disable_device()
            except Exception as exc:
                logger.warning("[%s] Failed to disable device: %s", self._label(), exc)
