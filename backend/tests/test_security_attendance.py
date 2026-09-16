"""Security rotation rules: default duty rest, punch accepted on any shift."""

from __future__ import annotations

from datetime import datetime, time
from types import SimpleNamespace

from app.services.attendance_engine import (
    infer_shift_for_punch,
    is_security_staff,
    status_for_security_without_punch,
)


def test_security_without_punch_defaults_to_duty_rest():
    assert status_for_security_without_punch(None) == "DUTY_REST"
    assert status_for_security_without_punch("ABSENT") == "ABSENT"
    assert status_for_security_without_punch("leave") == "LEAVE"


def test_is_security_duty_type():
    assert is_security_staff("Security")
    assert is_security_staff(" security ")
    assert not is_security_staff("General")
    assert not is_security_staff(None)


def test_morning_punch_maps_to_morning_even_if_evening_assigned():
    morning = SimpleNamespace(name="Morning Shift", start_time=time(8, 0))
    evening = SimpleNamespace(name="Evening Shift", start_time=time(16, 0))
    night = SimpleNamespace(name="Night Shift", start_time=time(22, 0))
    punch = datetime(2026, 9, 16, 8, 15)
    picked = infer_shift_for_punch(punch, [evening, night, morning])
    assert picked is not None
    assert picked.name == "Morning Shift"


def test_evening_punch_maps_to_evening():
    morning = SimpleNamespace(name="Morning Shift", start_time=time(8, 0))
    evening = SimpleNamespace(name="Evening Shift", start_time=time(16, 0))
    punch = datetime(2026, 9, 16, 16, 40)
    picked = infer_shift_for_punch(punch, [morning, evening])
    assert picked is not None
    assert picked.name == "Evening Shift"
