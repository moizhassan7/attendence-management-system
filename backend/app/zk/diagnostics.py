"""Local TCP diagnostics for ZKTeco terminals. No ping, no internet."""

from __future__ import annotations

import errno
import socket


def probe_tcp(ip: str, port: int, timeout: float = 3.0) -> dict[str, str]:
    """Socket-level check used only to classify failures. Not a ZK protocol session."""
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return {"status": "open", "detail": f"TCP {ip}:{port} accepted a connection"}
    except socket.timeout:
        return {"status": "timeout", "detail": f"TCP connection timeout to {ip}:{port}"}
    except OSError as exc:
        err_no = getattr(exc, "errno", None)
        if err_no in (errno.ECONNREFUSED, 10061):
            return {"status": "refused", "detail": f"TCP {ip}:{port} refused the connection"}
        if err_no in (errno.ENETUNREACH, errno.EHOSTUNREACH, 10051, 10065):
            return {"status": "unreachable", "detail": f"Host {ip} is unreachable"}
        if err_no in (errno.ETIMEDOUT, 10060):
            return {"status": "timeout", "detail": f"TCP connection timeout to {ip}:{port}"}
        return {"status": "error", "detail": f"TCP {ip}:{port} failed: {exc}"}
