"""Next-free device PIN allocation."""

from app.services.pin_allocator import (
    is_temp_pin,
    next_numeric_pin,
    parse_numeric_pin,
    require_numeric_device_pin,
    used_numeric_pins,
)


def test_parse_numeric_pin():
    assert parse_numeric_pin("2001") == 2001
    assert parse_numeric_pin(" 101 ") == 101
    assert parse_numeric_pin("TEMP-ABC") is None
    assert parse_numeric_pin(None) is None


def test_is_temp_pin():
    assert is_temp_pin("TEMP-3840371912046") is True
    assert is_temp_pin("temp-1") is True
    assert is_temp_pin("2008") is False


def test_require_numeric_device_pin():
    assert require_numeric_device_pin("2008") == "2008"
    assert require_numeric_device_pin(" 101 ") == "101"
    try:
        require_numeric_device_pin("TEMP-3840371912046")
    except ValueError as exc:
        assert "TEMP" in str(exc)
    else:
        raise AssertionError("expected TEMP PIN to be rejected")
    try:
        require_numeric_device_pin("ABC")
    except ValueError:
        pass
    else:
        raise AssertionError("expected text PIN to be rejected")


def test_used_and_next_pin_never_duplicates():
    used = used_numeric_pins(["2001", "TEMP-X", "2003", None, "abc"])
    assert used == {2001, 2003}
    assert next_numeric_pin(used, 2001) == 2002
    used.add(2002)
    assert next_numeric_pin(used, 2001) == 2004


def test_next_staff_pin_starts_at_range_and_fills_gaps():
    used = {2001, 2002, 2004}
    assert next_numeric_pin(used, 2001) == 2003
    assert next_numeric_pin(set(), 2001) == 2001


def test_next_trainee_pin_stays_inside_range():
    used = {1, 2, 3}
    assert next_numeric_pin(used, 1, 2000) == 4


def test_next_pin_raises_when_range_is_full():
    used = {1, 2, 3}
    try:
        next_numeric_pin(used, 1, 3)
    except ValueError as exc:
        assert "No free device PIN" in str(exc)
    else:
        raise AssertionError("expected ValueError")
