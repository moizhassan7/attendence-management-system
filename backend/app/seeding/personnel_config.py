"""Department aliases, category rules, and Excel source filenames."""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
EMP_DATA_FILENAME = "emp_data.xls"
NAFRI_FILENAME = "Punjab Police Nafri total 288 (2).xlsx"

EMP_DATA_PATH = REPO_ROOT / EMP_DATA_FILENAME
NAFRI_PATH = REPO_ROOT / NAFRI_FILENAME

COURSE_BASIC = ("BTC", "Basic Training Course")
COURSE_LOWER = ("LLC", "Lower Level Course")

# Canonical departments used by the seeder (code, display name).
DEPARTMENTS: dict[str, tuple[str, str]] = {
    "admin staff": ("ADMIN", "Admin Staff"),
    "band staff": ("BAND", "Band Staff"),
    "class-iv": ("CLASS_IV", "Class IV"),
    "class iv": ("CLASS_IV", "Class IV"),
    "class-iv staff": ("CLASS_IV", "Class IV"),
    "drill staff": ("DRILL", "Drill Staff"),
    "law staff": ("LAW", "Law Staff"),
    "line staff": ("LINE", "Line Staff"),
    "ministeral staff": ("MINISTERIAL", "Ministerial Staff"),
    "ministerial staff": ("MINISTERIAL", "Ministerial Staff"),
    "ministeraial staff": ("MINISTERIAL", "Ministerial Staff"),
    "mt staff": ("MT", "MT Staff"),
    "security staff": ("SECURITY", "Security Staff"),
    "weapon staff": ("WEAPON", "Weapon Staff"),
    "lower ladies": ("LOWER_LADIES", "Lower Ladies"),
    "police training school sargodh": ("PTS_SARGODHA", "Police Training School Sargodha"),
    "police training school sargodha": ("PTS_SARGODHA", "Police Training School Sargodha"),
    "misllenous staff": ("MISC", "Miscellaneous Staff"),
    "miscellaneous staff": ("MISC", "Miscellaneous Staff"),
}

NON_UNIFORM_DEPARTMENT_CODES = frozenset({"CLASS_IV", "MINISTERIAL"})

NON_UNIFORM_RANK_NAMES = frozenset(
    {
        "LANGRI",
        "SWEEPER",
        "WASHER MAN",
        "MALI",
        "WATER CARRIER",
        "SENIOR CLERK",
        "JUNIOR CLERK",
        "BARBER",
        "ASSISTANT",
        "COBBLER",
        "SANITARY WORKER",
        "NAIB QASID",
        "N/QASID",
        "DAFTRI",
        "MASON",
        "ELECTRICIAN",
        "CARPENTER",
        "PAINTER",
        "OFFICE SUPERINTENDENT",
        "PSYCHOLOGIST",
        "MEDICAL OFFICER (DOCTOR) BPS",
        "MEDICAL OFFICER",
        "DOCTOR",
        "MASHKI",
        "DHOBI",
        "COOK",
        "FOLLOWER",
        "PLUMBER",
        "ACCOUNTANT",
        "COMPUTER OPERATOR",
        "DRIVER",
    }
)

DESIGNATION_LABELS = {
    "LANGRI": "Langri",
    "SWEEPER": "Sweeper",
    "WASHER MAN": "Washer Man",
    "MALI": "Mali",
    "WATER CARRIER": "Water Carrier",
    "SENIOR CLERK": "Senior Clerk",
    "JUNIOR CLERK": "Junior Clerk",
    "BARBER": "Barber",
    "ASSISTANT": "Assistant",
    "COBBLER": "Cobbler",
    "SANITARY WORKER": "Sanitary Worker",
    "NAIB QASID": "Naib Qasid",
    "N/QASID": "Naib Qasid",
    "DAFTRI": "Daftri",
    "MASON": "Mason",
    "ELECTRICIAN": "Electrician",
    "CARPENTER": "Carpenter",
    "PAINTER": "Painter",
    "OFFICE SUPERINTENDENT": "Office Superintendent",
    "PSYCHOLOGIST": "Psychologist",
    "MEDICAL OFFICER (DOCTOR) BPS": "Medical Officer (Doctor) BPS",
    "MEDICAL OFFICER": "Medical Officer",
    "DOCTOR": "Doctor",
    "MASHKI": "Mashki",
    "DHOBI": "Dhobi",
}

RANK_ORDER = [
    "Inspector",
    "INSPECTOR LEGAL",
    "SUB INSPECTOR",
    "ASI",
    "HEAD CONSTABLE",
    "HEAD CONSTABLE DRIVER",
    "LADY HC",
    "Constable",
    "CONSTABLE DRIVER",
    "CONSTABLE (EX-ARMY)",
    "BAND CONSTABLE",
]

NAME_RANK_PREFIXES = frozenset(
    {
        "IP",
        "INSP",
        "INSPECTOR",
        "SI",
        "ASI",
        "HC",
        "LC",
        "CONSTABLE",
        "CT",
        "SP",
        "DSP",
        "SSP",
        "DIG",
        "IG",
    }
)


def _norm_dept_key(raw: str) -> str:
    return " ".join(str(raw or "").strip().lower().split())


def resolve_department(raw: str | None) -> tuple[str, str] | None:
    if not raw:
        return None
    key = _norm_dept_key(raw)
    if key in DEPARTMENTS:
        return DEPARTMENTS[key]
    return None


def category_for_department(code: str | None) -> str:
    if code and code.upper() in NON_UNIFORM_DEPARTMENT_CODES:
        return "Non-Uniform"
    return "Uniform"


def _title_key(name: str | None) -> str:
    return " ".join(str(name or "").strip().upper().split())


def is_civil_title(rank_name: str | None) -> bool:
    return _title_key(rank_name) in NON_UNIFORM_RANK_NAMES


def designation_label(rank_name: str | None) -> str | None:
    if not rank_name or not str(rank_name).strip():
        return None
    key = _title_key(rank_name)
    if key in DESIGNATION_LABELS:
        return DESIGNATION_LABELS[key]
    return " ".join(part.capitalize() for part in str(rank_name).strip().split())


def category_for_rank(rank_name: str | None) -> str:
    if is_civil_title(rank_name):
        return "Non-Uniform"
    return "Uniform"


def category_for_record(department_code: str | None, rank_name: str | None) -> str:
    if department_code:
        return category_for_department(department_code)
    return category_for_rank(rank_name)


def make_code(name: str, max_len: int = 20) -> str:
    cleaned = "".join(ch if ch.isalnum() else "_" for ch in (name or "").upper())
    while "__" in cleaned:
        cleaned = cleaned.replace("__", "_")
    cleaned = cleaned.strip("_") or "UNK"
    return cleaned[:max_len]
