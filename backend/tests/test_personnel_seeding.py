"""Unit tests for employee Excel import matching (no database writes)."""

from __future__ import annotations

from app.seeding.personnel_config import (
    category_for_department,
    category_for_rank,
    department_for_civil_title,
    resolve_department,
)
from app.seeding.personnel_match import build_canonical_records, build_trainee_records, match_personnel
from app.seeding.personnel_normalize import (
    belt_variants,
    canonical_belt,
    extract_primary_belt,
    is_platoon_department,
    name_tokens,
    platoon_course_code,
    unmapped_biometric_id,
)
from app.seeding.personnel_sources import EmpRecord, NafriRecord


def test_ac_no_is_biometric_not_belt():
    assert canonical_belt("R/499") == "R/499"
    assert 4 != "R/499"


def test_belt_variants_swap():
    assert "R/221" in belt_variants("221/R")
    assert "221/R" in belt_variants("R/221")
    assert extract_primary_belt("S/29 C/791") == "S/29"
    assert "S/29" in belt_variants("S/29 C/791")


def test_platoon_skip_rule():
    assert is_platoon_department("Z(Platoon No. 5)")
    assert is_platoon_department("ZL(Platoon No.07)")
    assert not is_platoon_department("Admin Staff")
    assert not is_platoon_department("Class-IV")
    assert platoon_course_code("Z(Platoon No. 5)") == "BTC"
    assert platoon_course_code("Z (Platoon No.1)") == "BTC"
    assert platoon_course_code("ZL(Platoon No.07)") == "LLC"
    assert platoon_course_code("ZL(Platoon No.01)") == "LLC"


def test_class_iv_and_ministerial_are_non_uniform():
    assert resolve_department("Class-IV") == ("CLASS_IV", "Class IV")
    assert resolve_department("Ministeral Staff") == ("MINISTERIAL", "Ministerial Staff")
    assert category_for_department("CLASS_IV") == "Non-Uniform"
    assert category_for_department("MINISTERIAL") == "Non-Uniform"
    assert category_for_department("ADMIN") == "Uniform"
    assert category_for_rank("LANGRI") == "Non-Uniform"
    assert category_for_rank("Inspector") == "Uniform"


def test_name_tokens_strip_rank_and_expand_m():
    assert name_tokens("IP Aftab Ahmed") == name_tokens("AFTAB AHMED")
    assert "MUHAMMAD" in name_tokens("M Shafqat Khan")
    assert "MUHAMMAD" in name_tokens("MUHAMMAD SHAFQAT KHAN")
    assert name_tokens("Assitant Arshad Mehmood") == name_tokens("ARSHAD MEHMOOD")
    assert name_tokens("S/Clerk M Akram") == name_tokens("MUHAMMAD AKRAM")


def test_unmatched_civil_nafri_is_not_admin():
    nafri = NafriRecord(
        0, "ARSHAD MEHMOOD", "Male", "ASSISTANT", "11111-1111111-1", "", "", None, "POSTED", None, None
    )
    recs = build_canonical_records(match_personnel([], [nafri]))
    assert recs[0]["department_code"] == "MINISTERIAL"
    assert recs[0]["category"] == "Non-Uniform"
    sweeper = NafriRecord(
        1, "GHULAM", "Male", "SWEEPER", "33333-3333333-3", "IV/1", "IV/1", None, "POSTED", None, None
    )
    recs = build_canonical_records(match_personnel([], [sweeper]))
    assert recs[0]["department_code"] == "CLASS_IV"
    assert department_for_civil_title("ASSISTANT") == ("MINISTERIAL", "Ministerial Staff")


def test_ministerial_emp_matches_nafri_despite_title_prefix():
    emp = EmpRecord(
        0, 230, "", "", "Assitant Arshad Mehmood", "09:00", None,
        "Ministeral Staff", "MINISTERIAL", "Ministerial Staff", False,
    )
    nafri = NafriRecord(
        0, "ARSHAD MEHMOOD", "Male", "ASSISTANT", "38401-0000000-1", "", "", None, "POSTED", None, None
    )
    recs = build_canonical_records(match_personnel([emp], [nafri]))
    assert len(recs) == 1
    assert recs[0]["department_code"] == "MINISTERIAL"
    assert recs[0]["full_name"] == "ARSHAD MEHMOOD"
    assert recs[0]["category"] == "Non-Uniform"


def test_unmatched_ministerial_emp_is_seeded():
    emp = EmpRecord(
        0, 233, "", "", "S/Clerk Muhammad Ishfaq", "09:00", None,
        "Ministeral Staff", "MINISTERIAL", "Ministerial Staff", False,
    )
    recs = build_canonical_records(match_personnel([emp], []))
    assert len(recs) == 1
    assert recs[0]["biometric_user_id"] == "233"
    assert recs[0]["department_code"] == "MINISTERIAL"
    assert recs[0]["category"] == "Non-Uniform"
    assert recs[0]["designation"] == "Senior Clerk"


def test_belt_match_keeps_nafri_name_and_emp_biometric():
    emp = EmpRecord(
        row_index=0,
        ac_no=4,
        belt_raw="R/499",
        belt_canonical="R/499",
        name="IP Aftab Ahmed",
        on_duty_raw="09:00",
        on_duty=None,
        department_raw="Admin Staff",
        department_code="ADMIN",
        department_name="Admin Staff",
        is_platoon=False,
    )
    nafri = NafriRecord(
        row_index=0,
        full_name="AFTAB AHMAD",
        gender="Male",
        rank_name="Inspector",
        cnic="38403-2111484-7",
        belt_raw="R/499",
        belt_canonical="R/499",
        dob=None,
        status="POSTED",
        posted_as=None,
        ps_unit=None,
    )
    report = match_personnel([emp], [nafri])
    assert len(report.linked) == 1
    assert report.linked[0].method == "belt"
    recs = build_canonical_records(report)
    assert recs[0]["biometric_user_id"] == unmapped_biometric_id("38403-2111484-7")
    assert recs[0]["biometric_user_id"].startswith("TEMP-")
    assert recs[0]["temp_biometric"] is True
    assert recs[0]["employee_code"] == "R/499"
    assert recs[0]["full_name"] == "AFTAB AHMAD"
    assert recs[0]["rank_name"] == "Inspector"
    assert recs[0]["cnic"] == "38403-2111484-7"
    assert recs[0]["department_code"] == "ADMIN"
    assert recs[0]["category"] == "Uniform"
    assert recs[0]["designation"] is None


def test_civil_nafri_title_becomes_designation():
    nafri = NafriRecord(
        0, "GHULAM", "Male", "SWEEPER", "33333-3333333-3", "IV/1", "IV/1", None, "POSTED", None, None
    )
    recs = build_canonical_records(match_personnel([], [nafri]))
    assert recs[0]["category"] == "Non-Uniform"
    assert recs[0]["designation"] == "Sweeper"
    assert recs[0]["rank_name"] is None


def test_platoon_records_are_not_seeded():
    emp = EmpRecord(
        row_index=1,
        ac_no=900,
        belt_raw="1",
        belt_canonical="1",
        name="Trainee X",
        on_duty_raw="09:00",
        on_duty=None,
        department_raw="Z(Platoon No. 2)",
        department_code=None,
        department_name=None,
        is_platoon=True,
    )
    report = match_personnel([emp], [])
    assert len(report.skipped_platoons) == 1
    assert build_canonical_records(report) == []
    trainees = build_trainee_records([emp])
    assert len(trainees) == 1
    assert trainees[0]["course_code"] == "BTC"
    assert trainees[0]["biometric_user_id"] == "900"
    assert trainees[0]["is_trainee"] is True


def test_multi_biometric_same_belt_picks_one_nafri_person():
    e1 = EmpRecord(0, 1, "R/221", "R/221", "ASI Ghulam Rasool", "09:00", None, "Police Training School Sargodh", "PTS_SARGODHA", "Police Training School Sargodha", False)
    e2 = EmpRecord(1, 3, "221/R", "R/221", "ASI Ghulam Rasool", "09:00", None, "Admin Staff", "ADMIN", "Admin Staff", False)
    nafri = NafriRecord(0, "GHULAM RASOOL", "Male", "ASI", "11111-1111111-1", "R/221", "R/221", None, "POSTED", None, None)
    report = match_personnel([e1, e2], [nafri])
    assert len(report.linked) == 2
    recs = build_canonical_records(report)
    assert len(recs) == 1
    assert recs[0]["cnic"] == "11111-1111111-1"
    assert recs[0]["biometric_user_id"] == unmapped_biometric_id("11111-1111111-1")
    assert recs[0]["biometric_user_id"].startswith("TEMP-")
    assert recs[0]["department_code"] == "ADMIN"


def test_unmapped_placeholder_is_not_numeric_device_id():
    bio = unmapped_biometric_id("38403-2111484-7")
    assert bio.startswith("TEMP-")
    assert not bio.isdigit()


def test_unmatched_staff_emp_is_kept_with_nafri():
    emp_only = EmpRecord(
        0, 88, "X/1", "X/1", "Device Only", "09:00", None, "Admin Staff", "ADMIN", "Admin Staff", False
    )
    nafri = NafriRecord(
        0, "SAADAT ALI SHAH", "Male", "Inspector", "38402-1591309-7", "S/264", "S/264", None, "POSTED", None, None
    )
    recs = build_canonical_records(match_personnel([emp_only], [nafri]))
    names = {row["full_name"] for row in recs}
    assert names == {"SAADAT ALI SHAH", "Device Only"}


def test_security_staff_duty_type():
    emp = EmpRecord(
        0, 50, "S/73", "S/73", "IP Muzaffar", "09:00", None, "Security Staff", "SECURITY", "Security Staff", False
    )
    nafri = NafriRecord(
        0, "MUZAFFAR KHAN", "Male", "Inspector", "38401-0323970-7", "S/73", "S/73", None, "POSTED", None, None
    )
    recs = build_canonical_records(match_personnel([emp], [nafri]))
    assert recs[0]["department_code"] == "SECURITY"
    assert recs[0]["duty_type"] == "Security"


def test_security_compound_belt_and_unmatched_device_staff():
    emp_match = EmpRecord(
        0, 154, "S/29 C/791", "S/29", "C/791IP Asad Hassan", "09:00", None,
        "Security Staff", "SECURITY", "Security Staff", False,
    )
    emp_extra = EmpRecord(
        1, 153, "R/383", "R/383", "IP M Sabtian Ali", "09:00", None,
        "Security Staff", "SECURITY", "Security Staff", False,
    )
    nafri = NafriRecord(
        0, "ASAD HASSAN", "Male", "Inspector", "11111-1111111-1", "S/29", "S/29", None, "POSTED", None, None
    )
    recs = build_canonical_records(match_personnel([emp_match, emp_extra], [nafri]))
    by_name = {row["full_name"]: row for row in recs}
    assert by_name["ASAD HASSAN"]["department_code"] == "SECURITY"
    assert by_name["IP M Sabtian Ali"]["department_code"] == "SECURITY"
    assert by_name["IP M Sabtian Ali"]["biometric_user_id"] == "153"
    assert by_name["IP M Sabtian Ali"]["duty_type"] == "Security"
