"""TEMP-* PIN cleanup: never delete a user that holds a fingerprint template."""

from types import SimpleNamespace

from app.services.temp_pin_cleanup import (
    build_legacy_temp_pin_map,
    is_temp_pin,
    temp_truncations,
    temp_users_safe_to_delete,
)


def test_is_temp_pin():
    assert is_temp_pin("TEMP-3840371912046") is True
    assert is_temp_pin("temp-3840") is True
    assert is_temp_pin("2008") is False
    assert is_temp_pin("2140") is False


def test_temp_truncations_are_legacy_14_char_twins():
    assert temp_truncations("TEMP-3840371912046") == ["TEMP-384037191"]
    assert temp_truncations("TEMP-384037191") == []
    assert temp_truncations("2008") == []


def test_temp_users_with_fingerprints_are_not_deleted():
    users = [
        SimpleNamespace(uid=2, user_id="TEMP-3840371912046"),
        SimpleNamespace(uid=3, user_id="TEMP-384037191"),
        SimpleNamespace(uid=203, user_id="2008"),
        SimpleNamespace(uid=204, user_id="2001"),
    ]
    doomed = temp_users_safe_to_delete(users, template_uids={203, 204, 2})
    pins = {u.user_id for u in doomed}
    assert pins == {"TEMP-384037191"}
    assert 203 not in {u.uid for u in doomed}


def test_numeric_users_are_never_purged_even_without_templates():
    users = [
        SimpleNamespace(uid=7, user_id="2008"),
        SimpleNamespace(uid=8, user_id="TEMP-384025468"),
    ]
    doomed = temp_users_safe_to_delete(users, template_uids=set())
    assert [u.user_id for u in doomed] == ["TEMP-384025468"]


def test_legacy_temp_map_uses_cnic_and_drops_collisions():
    people = [
        SimpleNamespace(biometric_user_id="2140", cnic="38403-7191204-6", employee_code="R/11"),
        SimpleNamespace(biometric_user_id="2141", cnic="38403-7191999-1", employee_code=""),
    ]
    mapping = build_legacy_temp_pin_map(people)
    assert mapping["TEMP-3840371912046"] == "2140"
    assert mapping["TEMP-R-11"] == "2140"
    assert "TEMP-384037191" not in mapping
