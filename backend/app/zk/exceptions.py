"""ZKTeco-specific exceptions and local diagnostic classification."""

from __future__ import annotations

import errno
import socket


class DeviceConnectionError(Exception):
    """Failed to connect to device."""


class DeviceTimeoutError(DeviceConnectionError):
    """Device communication timed out."""


class DeviceAuthenticationError(Exception):
    """Device authentication failed (wrong password)."""


class DeviceReadError(Exception):
    """Failed to read data from device."""


class DeviceDisabledError(Exception):
    """Device is disabled in configuration."""


class DeviceBusyError(DeviceConnectionError):
    """Terminal rejected the session (busy or another client)."""


class DeviceUnreachableError(DeviceConnectionError):
    """Host or port is not reachable at the TCP layer."""


class DeviceSyncBusyError(Exception):
    """A sync job is already running for this terminal."""


# Stable machine-readable reasons used in logs and the dashboard.
REASON_CONNECTION_TIMEOUT = "connection_timeout"
REASON_SOCKET_TIMEOUT = "socket_timeout"
REASON_CONNECTION_REFUSED = "connection_refused"
REASON_UNREACHABLE = "host_unreachable"
REASON_AUTH = "authentication"
REASON_BUSY = "session_busy"
REASON_MALFORMED = "malformed_response"
REASON_PROTOCOL = "protocol_error"
REASON_READ_TIMEOUT = "read_timeout"
REASON_RESET = "connection_reset"
REASON_SYNC_IN_PROGRESS = "sync_in_progress"
REASON_UNKNOWN = "unknown"


_TIMEOUT_TOKENS = ("timed out", "timeout", "time out")
_RESET_TOKENS = ("10054", "forcibly closed", "connection reset", "10053")
_REFUSED_TOKENS = ("10061", "connection refused", "111")
_UNREACHABLE_TOKENS = ("10051", "10065", "network is unreachable", "no route", "host is unreachable")
_AUTH_TOKENS = ("password", "unauth", "auth failed", "authentication")
_BUSY_TOKENS = ("already connected", "session", "busy", "can't connect", "invalid response")
_MALFORMED_TOKENS = ("unpack", "struct.error", "malformed", "invalid data")


def classify_exception(error: BaseException) -> str:
    """Map a socket/pyzk/OS error to a stable reason code."""
    if isinstance(error, DeviceSyncBusyError):
        return REASON_SYNC_IN_PROGRESS
    if isinstance(error, DeviceAuthenticationError):
        return REASON_AUTH
    if isinstance(error, DeviceBusyError):
        return REASON_BUSY
    if isinstance(error, DeviceUnreachableError):
        return REASON_UNREACHABLE
    if isinstance(error, DeviceTimeoutError):
        msg = str(error).lower()
        if "read" in msg or "attendance" in msg:
            return REASON_READ_TIMEOUT
        return REASON_CONNECTION_TIMEOUT

    if isinstance(error, socket.timeout) or isinstance(error, TimeoutError):
        return REASON_SOCKET_TIMEOUT

    err_no = getattr(error, "errno", None)
    if err_no in (errno.ENETUNREACH, errno.EHOSTUNREACH, 10051, 10065):
        return REASON_UNREACHABLE
    if err_no in (errno.ECONNREFUSED, 10061):
        return REASON_CONNECTION_REFUSED
    if err_no in (errno.ECONNRESET, errno.ECONNABORTED, 10054, 10053):
        return REASON_RESET
    if err_no in (errno.ETIMEDOUT, 10060):
        return REASON_CONNECTION_TIMEOUT

    msg = str(error).lower()
    if any(token in msg for token in _UNREACHABLE_TOKENS):
        return REASON_UNREACHABLE
    if any(token in msg for token in _REFUSED_TOKENS):
        return REASON_CONNECTION_REFUSED
    if any(token in msg for token in _RESET_TOKENS):
        return REASON_RESET
    if any(token in msg for token in _TIMEOUT_TOKENS):
        if "read" in msg or "attendance" in msg:
            return REASON_READ_TIMEOUT
        return REASON_CONNECTION_TIMEOUT
    if any(token in msg for token in _AUTH_TOKENS):
        return REASON_AUTH
    if any(token in msg for token in _MALFORMED_TOKENS):
        return REASON_MALFORMED
    if any(token in msg for token in _BUSY_TOKENS):
        return REASON_BUSY
    return REASON_UNKNOWN


def is_retryable_reason(reason: str) -> bool:
    """Transient network/session failures may be retried. Auth/config may not."""
    return reason in {
        REASON_CONNECTION_TIMEOUT,
        REASON_SOCKET_TIMEOUT,
        REASON_CONNECTION_REFUSED,
        REASON_UNREACHABLE,
        REASON_BUSY,
        REASON_RESET,
        REASON_READ_TIMEOUT,
        REASON_PROTOCOL,
        REASON_UNKNOWN,
    }


def retry_delay_seconds(attempt: int, backoff: int) -> float:
    """Delay after a failed attempt. attempt is 1-based (after try 1 → backoff ** 1)."""
    return float(backoff ** attempt)


def short_reason_label(reason: str) -> str:
    return {
        REASON_CONNECTION_TIMEOUT: "TCP connection timeout",
        REASON_SOCKET_TIMEOUT: "Socket timeout",
        REASON_CONNECTION_REFUSED: "Connection refused",
        REASON_UNREACHABLE: "Host unreachable",
        REASON_AUTH: "Authentication/configuration error",
        REASON_BUSY: "Terminal busy or session rejected",
        REASON_MALFORMED: "Malformed terminal response",
        REASON_PROTOCOL: "ZKTeco protocol error",
        REASON_READ_TIMEOUT: "Timeout while reading attendance log",
        REASON_RESET: "Connection reset during transfer",
        REASON_SYNC_IN_PROGRESS: "Sync already running for this terminal",
        REASON_UNKNOWN: "Unexpected terminal error",
    }.get(reason, "Unexpected terminal error")


def format_diagnostic(
    name: str,
    ip: str,
    port: int,
    reason: str,
    detail: str,
    tcp_status: str | None = None,
) -> str:
    """Human-readable failure text. Does not claim a cause unless the error confirms it."""
    label = short_reason_label(reason)
    lines = [
        f"{name} ({ip}:{port})",
        "",
        "Connection failed.",
        f"Reason: {label}.",
    ]
    if detail:
        lines.append(f"Detail: {detail}")
    if tcp_status:
        lines.append(f"TCP check: {tcp_status}")
    lines.extend(
        [
            "",
            "Possible causes:",
            "- Another ZKTeco client is currently connected.",
            "- Terminal TCP/IP service is unavailable.",
            "- Port 4370 is blocked/unreachable.",
            "- Terminal IP configuration is incorrect.",
            "- Terminal is temporarily busy.",
        ]
    )
    if reason == REASON_AUTH:
        lines.append("- Communication password / device key is incorrect.")
    if reason in {REASON_READ_TIMEOUT, REASON_RESET}:
        lines.append("- Large attendance log caused the terminal to drop the session.")
    return "\n".join(lines)
