"""ZKTeco truncated PIN matching against personnel biometric IDs."""

from types import SimpleNamespace

from app.services.pin_match import (
    device_enroll_pin,
    personnel_has_device_fingerprint,
    pins_equivalent,
    resolve_personnel_pin,
)


def test_device_enroll_pin_keeps_temp_cnic_intact():
    """The terminal stores the full 18-char PIN; truncating created twin records."""
    assert device_enroll_pin("TEMP-3840371912046") == "TEMP-3840371912046"
    assert device_enroll_pin("2001") == "2001"
    assert device_enroll_pin("TEMP-384037191") == "TEMP-384037191"


def test_device_enroll_pin_truncates_beyond_protocol_field():
    assert device_enroll_pin("X" * 30) == "X" * 24


def test_candidate_device_pins_include_legacy_truncated_twin():
    from app.services.pin_match import candidate_device_pins

    assert candidate_device_pins("TEMP-3840371912046") == [
        "TEMP-3840371912046",
        "TEMP-384037191",
    ]
    assert candidate_device_pins("2001") == ["2001"]


def test_exact_pin_matches():
    assert pins_equivalent("2001", "2001") is True
    assert pins_equivalent("TEMP-3840371912046", "TEMP-3840371912046") is True


def test_truncated_temp_cnic_matches_full_personnel_pin():
    assert pins_equivalent("TEMP-384037191", "TEMP-3840371912046") is True
    assert pins_equivalent("TEMP-381015506", "TEMP-3810155063127") is True


def test_short_prefix_does_not_match_other_staff():
    assert pins_equivalent("TEMP-38", "TEMP-3840371912046") is False
    assert pins_equivalent("TEMP-3840371912046", "TEMP-38") is False


def test_resolve_prefers_exact_then_unique_truncation():
    pins = ["TEMP-3840371912046", "TEMP-38", "2001"]
    assert resolve_personnel_pin("TEMP-3840371912046", pins) == "TEMP-3840371912046"
    assert resolve_personnel_pin("TEMP-384037191", pins) == "TEMP-3840371912046"
    assert resolve_personnel_pin("2001", pins) == "2001"
    assert resolve_personnel_pin("TEMP-38", pins) == "TEMP-38"


def test_resolve_is_none_when_truncation_is_ambiguous():
    pins = ["TEMP-3840371912046", "TEMP-3840371919999"]
    assert resolve_personnel_pin("TEMP-384037191", pins) is None


def test_fingerprint_detected_on_truncated_twin():
    users = [
        SimpleNamespace(uid=11, user_id="TEMP-3840371912046"),
        SimpleNamespace(uid=12, user_id="TEMP-384037191"),
    ]
    assert personnel_has_device_fingerprint("TEMP-3840371912046", users, {12}) is True
    assert personnel_has_device_fingerprint("TEMP-3840371912046", users, {11}) is True
    assert personnel_has_device_fingerprint("TEMP-3840371912046", users, {99}) is False
    assert personnel_has_device_fingerprint("TEMP-38", users, {12}) is False
