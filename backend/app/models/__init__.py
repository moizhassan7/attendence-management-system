"""Package init — import all models so Base.metadata discovers them."""

from app.models.device import Device
from app.models.department import Department
from app.models.rank import Rank
from app.models.shift import Shift
from app.models.personnel import Personnel
from app.models.attendance import AttendancePunch, AttendanceDaily
from app.models.exception import AttendanceException
from app.models.holiday import Holiday
from app.models.device_sync_log import DeviceSyncLog
from app.models.audit import AuditLog
from app.models.settings import SystemSetting
from app.models.user import User
from app.models.course import Course

__all__ = [
    "Device",
    "Department",
    "Rank",
    "Shift",
    "Personnel",
    "AttendancePunch",
    "AttendanceDaily",
    "AttendanceException",
    "Holiday",
    "DeviceSyncLog",
    "AuditLog",
    "SystemSetting",
    "User",
    "Course",
]
