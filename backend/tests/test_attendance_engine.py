"""Daily status rules: sanctioned leave overrides a same-day check-in."""

from app.services.attendance_engine import apply_sanctioned_exception


def test_leave_overrides_present_after_check_in():
    assert apply_sanctioned_exception("PRESENT", "LEAVE") == "LEAVE"
    assert apply_sanctioned_exception("LATE", "leave") == "LEAVE"


def test_osd_and_medical_override_punch():
    assert apply_sanctioned_exception("PRESENT", "OSD") == "OSD"
    assert apply_sanctioned_exception("LATE", "MEDICAL") == "MEDICAL"


def test_leave_still_applies_without_punch():
    assert apply_sanctioned_exception("ABSENT", "LEAVE") == "LEAVE"
    assert apply_sanctioned_exception("DUTY_REST", "LEAVE") == "LEAVE"


def test_no_exception_keeps_punch_status():
    assert apply_sanctioned_exception("PRESENT", None) == "PRESENT"
    assert apply_sanctioned_exception("LATE", "") == "LATE"
    assert apply_sanctioned_exception("ABSENT", None) == "ABSENT"


def test_unknown_exception_does_not_override():
    assert apply_sanctioned_exception("PRESENT", "HALF_DAY") == "PRESENT"
