"""ZKTeco sync isolation, retry, diagnostics, and attendance parsing."""

from __future__ import annotations

import socket
import threading
import time
from datetime import datetime, timedelta
from struct import pack
from unittest.mock import patch

import pytest

from app.zk.device_manager import DeviceManager
from app.zk.exceptions import (
    DeviceAuthenticationError,
    DeviceTimeoutError,
    classify_exception,
    is_retryable_reason,
    retry_delay_seconds,
    short_reason_label,
)
from app.zk.session import device_session, is_device_locked
from app.zk.zk_client import parse_attendance_buffer


def test_retry_delays_are_exponential():
    assert retry_delay_seconds(1, 2) == 2
    assert retry_delay_seconds(2, 2) == 4
    assert retry_delay_seconds(3, 2) == 8


def test_classify_timeout_and_reset():
    assert classify_exception(TimeoutError("timed out")) == "socket_timeout"
    assert classify_exception(OSError(10054, "forcibly closed")) == "connection_reset"
    assert classify_exception(OSError(10061, "connection refused")) == "connection_refused"
    assert classify_exception(DeviceAuthenticationError("bad password")) == "authentication"
    assert classify_exception(DeviceTimeoutError("Timeout connecting")) == "connection_timeout"
    assert is_retryable_reason("connection_timeout") is True
    assert is_retryable_reason("authentication") is False
    assert "timeout" in short_reason_label("connection_timeout").lower()


def test_parse_40_byte_attendance_records():
    def encode_time(dt: datetime) -> bytes:
        value = (
            ((dt.year % 100) * 12 * 31 + ((dt.month - 1) * 31) + dt.day - 1)
            * (24 * 60 * 60)
            + (dt.hour * 60 + dt.minute) * 60
            + dt.second
        )
        return pack("<I", value)

    stamp = datetime(2026, 9, 17, 8, 30, 0)
    user = b"1001".ljust(24, b"\x00")
    record = pack("<H24sB4sB8s", 1, user, 1, encode_time(stamp), 0, b"\x00" * 8)
    header = pack("I", 40)
    logs = parse_attendance_buffer(header + record, 1)
    assert len(logs) == 1
    assert logs[0].user_id == "1001"
    assert logs[0].punch == 0
    assert logs[0].timestamp.hour == 8


def test_parse_skips_records_before_incremental_cursor():
    def encode_time(dt: datetime) -> bytes:
        value = (
            ((dt.year % 100) * 12 * 31 + ((dt.month - 1) * 31) + dt.day - 1)
            * (24 * 60 * 60)
            + (dt.hour * 60 + dt.minute) * 60
            + dt.second
        )
        return pack("<I", value)

    def record(dt: datetime, pin: bytes) -> bytes:
        user = pin.ljust(24, b"\x00")
        return pack("<H24sB4sB8s", 1, user, 1, encode_time(dt), 0, b"\x00" * 8)

    old = record(datetime(2026, 1, 1, 8, 0, 0), b"1001")
    new = record(datetime(2026, 9, 17, 8, 30, 0), b"1002")
    header = pack("I", 80)
    logs = parse_attendance_buffer(header + old + new, 2, since=datetime(2026, 9, 16, 0, 0, 0))
    assert len(logs) == 1
    assert logs[0].user_id == "1002"


def test_incremental_since_uses_lookback_from_last_punch():
    from app.zk.sync_service import incremental_since, persist_cursor_for_sync, should_clear_device_log, sync_mode_for

    latest = datetime(2026, 9, 17, 9, 1, 0)
    cutoff = incremental_since(latest, 120)
    assert cutoff == latest - timedelta(minutes=120)
    assert incremental_since(None, 120) is None
    assert persist_cursor_for_sync(
        full=False, latest_time=latest, lookback_minutes=120, clear_after=False
    ) == cutoff
    assert persist_cursor_for_sync(
        full=False, latest_time=latest, lookback_minutes=120, clear_after=True
    ) is None
    assert persist_cursor_for_sync(
        full=True, latest_time=latest, lookback_minutes=120, clear_after=False
    ) is None
    assert sync_mode_for(full=False, latest_time=latest, clear_after=True) == "save_then_clear"
    assert should_clear_device_log(succeeded=True, enabled=True, terminal_records=48115, logs_found=48115) is True
    assert should_clear_device_log(succeeded=False, enabled=True, terminal_records=48115, logs_found=48115) is False
    assert should_clear_device_log(succeeded=True, enabled=False, terminal_records=48115, logs_found=48115) is False
    assert should_clear_device_log(succeeded=True, enabled=True, terminal_records=0, logs_found=0) is False
    assert should_clear_device_log(succeeded=True, enabled=True, terminal_records=48115, logs_found=0) is False


def test_different_terminals_are_not_globally_locked():
    entered: list[str] = []
    release = threading.Event()

    def worker(ip: str) -> None:
        with device_session(ip):
            entered.append(ip)
            release.wait(timeout=1.0)

    threads = [
        threading.Thread(target=worker, args=("192.168.1.205",)),
        threading.Thread(target=worker, args=("192.168.1.210",)),
    ]
    for thread in threads:
        thread.start()
    time.sleep(0.15)
    assert set(entered) == {"192.168.1.205", "192.168.1.210"}
    release.set()
    for thread in threads:
        thread.join(timeout=1.0)


def test_same_terminal_sessions_are_serialized():
    inside = 0
    max_inside = 0
    lock = threading.Lock()

    def worker() -> None:
        nonlocal inside, max_inside
        with device_session("192.168.1.210"):
            with lock:
                inside += 1
                max_inside = max(max_inside, inside)
            time.sleep(0.08)
            with lock:
                inside -= 1

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=2.0)
    assert max_inside == 1
    assert is_device_locked("192.168.1.210") is False


class _TimeoutAdapter:
    ip = "192.168.1.220"
    name = "TR-3"

    def __init__(self) -> None:
        self.connects = 0
        self.disconnects = 0

    def connect(self, timeout=None) -> bool:
        self.connects += 1
        raise TimeoutError("timed out")

    def disconnect(self) -> None:
        self.disconnects += 1

    def get_attendance(self):
        return []


def test_fetch_retries_three_times_with_backoff_and_always_disconnects():
    adapter = _TimeoutAdapter()
    manager = DeviceManager(adapter, name="TR-3")
    sleeps: list[float] = []

    with patch("time.sleep", side_effect=lambda seconds: sleeps.append(seconds)):
        with pytest.raises(TimeoutError):
            manager.fetch_attendance()

    assert adapter.connects == 3
    assert adapter.disconnects >= 3
    assert [delay for delay in sleeps if delay >= 2][:2] == [2.0, 4.0]
    assert manager.last_attempts == 3


class _FlakyReadAdapter:
    ip = "192.168.1.201"
    name = "PTS Staff"

    def __init__(self) -> None:
        self.reads = 0
        self.disconnected = False

    def connect(self, timeout=None) -> bool:
        self.disconnected = False
        return True

    def disconnect(self) -> None:
        self.disconnected = True

    def set_io_timeout(self, seconds: int) -> None:
        return None

    def get_attendance(self):
        self.reads += 1
        if self.reads == 1:
            raise OSError(10054, "forcibly closed")
        return []


def test_connection_is_closed_after_failed_read_then_retry_succeeds():
    adapter = _FlakyReadAdapter()
    manager = DeviceManager(adapter, name="PTS Staff")
    with patch("time.sleep", return_value=None):
        logs = manager.fetch_attendance()
    assert logs == []
    assert adapter.reads == 2
    assert adapter.disconnected is True
    assert manager.last_attempts == 2


class _ClearAdapter:
    ip = "192.168.1.205"
    name = "TR-1"
    last_transport = "tcp"
    terminal_record_count = 0

    def __init__(self) -> None:
        self.cleared = 0
        self.connected = False

    def connect(self, timeout=None) -> bool:
        self.connected = True
        return True

    def disconnect(self) -> None:
        self.connected = False

    def set_io_timeout(self, seconds: int) -> None:
        return None

    def clear_attendance(self) -> bool:
        assert self.connected is True
        self.cleared += 1
        return True


def test_clear_attendance_runs_only_while_connected_then_disconnects():
    adapter = _ClearAdapter()
    manager = DeviceManager(adapter, name="TR-1")
    assert manager.clear_attendance() is True
    assert adapter.cleared == 1
    assert adapter.connected is False
    assert manager.last_attempts == 1


@pytest.mark.asyncio
async def test_duplicate_sync_is_rejected_for_same_terminal():
    from app.zk.exceptions import DeviceSyncBusyError
    from app.zk.sync_service import SyncService

    service = SyncService()
    claimed = await service._claim_device(42)
    assert claimed is True
    with pytest.raises(DeviceSyncBusyError):
        # emulate second request while first still holds the device
        second = await service._claim_device(42)
        if not second:
            raise DeviceSyncBusyError("Sync already running")
    other = await service._claim_device(99)
    assert other is True
    await service._release_device(42)
    await service._release_device(99)
    assert await service._claim_device(42) is True
    await service._release_device(42)


def test_tcp_probe_does_not_use_ping():
    from app.zk.diagnostics import probe_tcp

    with patch("app.zk.diagnostics.socket.create_connection", side_effect=socket.timeout("timed out")):
        result = probe_tcp("192.168.1.199", 4370, timeout=0.2)
    assert result["status"] == "timeout"
    assert "192.168.1.199:4370" in result["detail"]
