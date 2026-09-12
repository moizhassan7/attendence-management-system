"""ZKTeco-specific exceptions."""


class DeviceConnectionError(Exception):
    """Failed to connect to device."""
    pass


class DeviceTimeoutError(Exception):
    """Device communication timed out."""
    pass


class DeviceAuthenticationError(Exception):
    """Device authentication failed (wrong password)."""
    pass


class DeviceReadError(Exception):
    """Failed to read data from device."""
    pass


class DeviceDisabledError(Exception):
    """Device is disabled in configuration."""
    pass
