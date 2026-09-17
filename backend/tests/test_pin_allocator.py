"""Next-free device PIN allocation."""

from app.services.pin_allocator import next_numeric_pin, parse_numeric_pin


def test_parse_numeric_pin():
    assert parse_numeric_pin("2001") == 2001
    assert parse_numeric_pin(" 101 ") == 101
    assert parse_numeric_pin("TEMP-ABC") is None
    assert parse_numeric_pin(None) is None


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
