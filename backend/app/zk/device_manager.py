"""Device connection lifecycle manager."""

from __future__ import annotations

import logging
import time
from typing import Any, Callable, TypeVar

from app.config import get_settings
from app.zk.base import BaseAttendanceDevice, DeviceAttendanceLog, DeviceUser
from app.zk.exceptions import (
    DeviceAuthenticationError,
    DeviceConnectionError,
    DeviceSyncBusyError,
    classify_exception,
    is_retryable_reason,
    retry_delay_seconds,
    short_reason_label,
)
from app.zk.mock_client import MockZKDeviceAdapter
from app.zk.session import device_session
from app.zk.zk_client import ZKTecoDeviceAdapter

logger = logging.getLogger(__name__)

T = TypeVar("T")


def create_device_adapter(
    ip: str,
    port: int = 4370,
    password: str | None = None,
    name: str | None = None,
    transport: str = "auto",
) -> BaseAttendanceDevice:
    """Factory: returns Mock or Real adapter based on config."""
    settings = get_settings()
    if settings.use_mock_device:
        return MockZKDeviceAdapter(ip=ip, port=port, password=password, name=name)
    return ZKTecoDeviceAdapter(ip=ip, port=port, password=password, name=name, transport=transport)


class DeviceManager:
    """Manages the connect → read → disconnect lifecycle for one terminal."""

    def __init__(self, adapter: BaseAttendanceDevice, name: str | None = None):
        self.adapter = adapter
        self.name = name or getattr(adapter, "name", None) or getattr(adapter, "ip", "device")
        self.last_attempts = 0
        self.last_transport: str | None = None
        self.terminal_record_count = 0

    def _ip(self) -> str:
        return getattr(self.adapter, "ip", "") or ""

    def _label(self) -> str:
        return self.name or self._ip()

    def _settings(self):
        return get_settings()

    def _with_retry(self, action: str, fn: Callable[[], T], max_retries: int | None = None) -> T:
        settings = self._settings()
        retries = max(1, max_retries if max_retries is not None else settings.device_max_retries)
        backoff = max(1, settings.device_retry_backoff)
        last_error: Exception | None = None

        for attempt in range(1, retries + 1):
            self.last_attempts = attempt
            logger.info("[%s] %s attempt %d/%d", self._label(), action, attempt, retries)
            with device_session(self._ip()):
                try:
                    result = fn()
                    self.last_transport = getattr(self.adapter, "last_transport", None)
                    self.terminal_record_count = int(
                        getattr(self.adapter, "terminal_record_count", 0) or 0
                    )
                    return result
                except DeviceSyncBusyError:
                    raise
                except DeviceAuthenticationError:
                    raise
                except Exception as exc:
                    last_error = exc
                    reason = classify_exception(exc)
                    logger.warning(
                        "[%s] %s failed (%s): %s",
                        self._label(),
                        action,
                        short_reason_label(reason),
                        exc,
                    )
                    try:
                        self.adapter.disconnect()
                    except Exception:
                        pass

            if attempt >= retries or not is_retryable_reason(classify_exception(last_error)):
                break
            delay = retry_delay_seconds(attempt, backoff)
            logger.info("[%s] Retrying in %ss", self._label(), delay)
            time.sleep(delay)

        raise last_error or DeviceConnectionError(f"{action} failed")

    def probe(self) -> bool:
        """Lightweight reachability check — no attendance dump."""
        def _run() -> bool:
            self.adapter.connect(timeout=self._settings().device_connection_timeout)
            try:
                return True
            finally:
                try:
                    self.adapter.disconnect()
                except Exception:
                    pass

        return bool(self._with_retry("probe", _run, max_retries=1))

    def test_connection(self) -> dict[str, Any]:
        """Quick connectivity + info check."""
        return self._with_retry("test", self.adapter.test_connection, max_retries=1)

    def fetch_attendance(self, since=None) -> list[DeviceAttendanceLog]:
        """Connect, read attendance (optionally filtered after dump), disconnect."""
        def _run() -> list[DeviceAttendanceLog]:
            settings = self._settings()
            self.adapter.connect(timeout=settings.device_connection_timeout)
            try:
                if hasattr(self.adapter, "set_io_timeout"):
                    self.adapter.set_io_timeout(settings.device_read_timeout)
                if since is not None:
                    logs = self.adapter.get_attendance(since=since)
                else:
                    logs = self.adapter.get_attendance()
                logger.info("[%s] Fetched %d relevant attendance logs", self._label(), len(logs))
                return logs
            finally:
                try:
                    self.adapter.disconnect()
                except Exception as exc:
                    logger.warning(
                        "[%s] Disconnect after attendance read (cleanup warning): %s",
                        self._label(),
                        exc,
                    )

        return self._with_retry("fetch_attendance", _run)

    def clear_attendance(self) -> bool:
        """Connect, wipe the terminal attendance log, disconnect. Never call before persist."""
        def _run() -> bool:
            settings = self._settings()
            self.adapter.connect(timeout=settings.device_connection_timeout)
            try:
                if hasattr(self.adapter, "set_io_timeout"):
                    self.adapter.set_io_timeout(settings.device_command_timeout)
                ok = bool(self.adapter.clear_attendance())
                logger.info("[%s] Terminal attendance memory cleared", self._label())
                return ok
            finally:
                try:
                    self.adapter.disconnect()
                except Exception as exc:
                    logger.warning(
                        "[%s] Disconnect after clear (cleanup warning): %s",
                        self._label(),
                        exc,
                    )

        return self._with_retry("clear_attendance", _run)

    def fetch_users(self) -> list[DeviceUser]:
        """Fetch enrolled users with full lifecycle."""
        return self._with_retry("fetch_users", self._fetch_users_once)

    def _fetch_users_once(self) -> list[DeviceUser]:
        self.adapter.connect(timeout=self._settings().device_connection_timeout)
        try:
            if hasattr(self.adapter, "set_io_timeout"):
                self.adapter.set_io_timeout(self._settings().device_command_timeout)
            users = self.adapter.get_users()
            logger.info("[%s] Fetched %d users from device", self._label(), len(users))
            return users
        finally:
            try:
                self.adapter.disconnect()
            except Exception:
                pass

    def push_user(
        self,
        user_id: str,
        name: str,
        privilege: int = 0,
        password: str = "",
        group_id: str = "1",
        card: int = 0,
    ) -> bool:
        """Push a user profile to the device."""
        def _run() -> bool:
            self.adapter.connect(timeout=self._settings().device_connection_timeout)
            try:
                return self.adapter.set_user(
                    user_id=user_id,
                    name=name,
                    privilege=privilege,
                    password=password,
                    group_id=group_id,
                    card=card,
                )
            finally:
                self.adapter.disconnect()

        return self._with_retry("push_user", _run)

    def enroll_fingerprint(self, user_id: str, temp_id: int = 0) -> bool:
        """Trigger remote fingerprint enrollment on the device."""
        def _run() -> bool:
            self.adapter.connect(timeout=self._settings().device_connection_timeout)
            try:
                return self.adapter.enroll_fingerprint(user_id=user_id, temp_id=temp_id)
            finally:
                self.adapter.disconnect()

        return self._with_retry("enroll", _run)

    def fetch_templates(self) -> list[Any]:
        """Fetch all biometric templates from the device."""
        def _run() -> list[Any]:
            self.adapter.connect(timeout=self._settings().device_connection_timeout)
            try:
                return self.adapter.get_templates()
            finally:
                self.adapter.disconnect()

        return self._with_retry("fetch_templates", _run)

    def delete_user(self, user_id: str) -> bool:
        """Remove user from device."""
        def _run() -> bool:
            self.adapter.connect(timeout=self._settings().device_connection_timeout)
            try:
                return self.adapter.delete_user(user_id)
            finally:
                self.adapter.disconnect()

        return self._with_retry("delete_user", _run)
