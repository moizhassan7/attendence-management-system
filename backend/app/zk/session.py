"""Per-terminal ZKTeco I/O lock.

Each IP has its own lock so TR-1 and TR-2 can talk at the same time.
The same terminal is never given two overlapping sessions.
"""

from __future__ import annotations

import threading
import time
from contextlib import contextmanager
from typing import Iterator

# Brief settle time after closing a session on the same terminal.
_PER_DEVICE_GAP_SECONDS = 0.35

_registry_lock = threading.Lock()
_ip_locks: dict[str, threading.Lock] = {}
_last_per_ip: dict[str, float] = {}


def _lock_for(ip: str) -> threading.Lock:
    key = ip or "_"
    with _registry_lock:
        lock = _ip_locks.get(key)
        if lock is None:
            lock = threading.Lock()
            _ip_locks[key] = lock
        return lock


def is_device_locked(ip: str) -> bool:
    """True when another thread currently holds this terminal's session."""
    with _registry_lock:
        lock = _ip_locks.get(ip or "_")
    return bool(lock and lock.locked())


@contextmanager
def device_session(ip: str = "") -> Iterator[None]:
    """Serialize ZK conversations for one IP only. Different IPs run independently."""
    lock = _lock_for(ip)
    lock.acquire()
    try:
        with _registry_lock:
            since = time.monotonic() - _last_per_ip.get(ip, 0.0)
        wait = max(_PER_DEVICE_GAP_SECONDS - since, 0.0)
        if wait > 0:
            time.sleep(wait)
        yield
    finally:
        with _registry_lock:
            _last_per_ip[ip] = time.monotonic()
        lock.release()
