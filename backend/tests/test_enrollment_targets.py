"""Staff vs trainee terminal targeting for auto-push."""

from types import SimpleNamespace

from app.api.v1.personnel import is_trainee_terminal, resolve_re_enroll_pin, terminals_for_person


def test_trainee_terminals_are_tr_units():
    assert is_trainee_terminal(SimpleNamespace(name="TR-1")) is True
    assert is_trainee_terminal(SimpleNamespace(name="PTS Staff")) is False


def test_new_trainees_are_pushed_to_disabled_tr_units():
    person = SimpleNamespace(is_trainee=True)
    devices = [
        SimpleNamespace(name="PTS Staff", enabled=True),
        SimpleNamespace(name="TR-1", enabled=False),
        SimpleNamespace(name="TR-2", enabled=False),
        SimpleNamespace(name="TR-3", enabled=False),
    ]
    names = [item.name for item in terminals_for_person(person, devices)]
    assert names == ["TR-1", "TR-2", "TR-3"]


def test_new_staff_stay_on_pts_terminal():
    person = SimpleNamespace(is_trainee=False)
    devices = [
        SimpleNamespace(name="PTS Staff", enabled=True),
        SimpleNamespace(name="TR-1", enabled=False),
    ]
    names = [item.name for item in terminals_for_person(person, devices)]
    assert names == ["PTS Staff"]


def test_re_enroll_keeps_pin_when_blank_or_same():
    assert resolve_re_enroll_pin("2001", None) is None
    assert resolve_re_enroll_pin("2001", "") is None
    assert resolve_re_enroll_pin("2001", " 2001 ") is None


def test_re_enroll_switches_to_new_device_pin():
    assert resolve_re_enroll_pin("2001", "2140") == "2140"
    assert resolve_re_enroll_pin("TEMP-3840371912046", "2140") == "2140"


def test_tcp_transport_does_not_fall_back_to_udp():
    from app.zk.zk_client import connect_attempts

    attempts = connect_attempts("tcp", 90)
    assert attempts == [(False, 90)]


def test_auto_transport_still_allows_udp_fallback():
    from app.zk.zk_client import connect_attempts

    attempts = connect_attempts("auto", 90)
    assert attempts[0] == (False, 90)
    assert attempts[1][0] is True
