"""Configuration and System Settings API."""

from __future__ import annotations

import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.settings import SystemSetting
from app.schemas.common import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULT_SETTINGS = {
    "org_acronym": ("PTS", "string", "Organization acronym / avatar chip"),
    "org_display_name": ("Police Training School Rawat", "string", "Organization display name"),
    "org_legal_name": ("Police Training School, Rawat — Rawalpindi", "string", "Full / legal organization name"),
    "org_system_name": ("Biometric Attendance Management System", "string", "System brand title"),
    "org_tagline": ("Train to Serve", "string", "Organization motto or tagline"),
    "org_logo_url": ("/pts_logo.png", "string", "White-label organization logo URL"),
    "trainee_pin_min": ("1", "int", "Trainee PIN range minimum"),
    "trainee_pin_max": ("2000", "int", "Trainee PIN range maximum"),
    "staff_pin_min": ("2001", "int", "Staff PIN range minimum"),
    "civil_designations": (
        json.dumps([
            "Senior Clerk",
            "Junior Clerk",
            "Assistant",
            "Accountant",
            "Computer Operator",
            "Driver",
            "Cook",
            "Follower",
            "Naib Qasid",
            "Electrician",
            "Plumber",
            "Sanitary Worker",
            "Langri",
            "Sweeper",
            "Washer Man",
            "Mali",
            "Water Carrier",
            "Barber",
            "Cobbler",
            "Daftri",
            "Mason",
            "Carpenter",
            "Painter",
            "Office Superintendent",
            "Psychologist",
            "Medical Officer (Doctor) BPS",
            "Mashki",
            "Dhobi",
        ]),
        "json",
        "Non-uniform ministerial and menial designations"
    ),
    "default_shift_uniform": ("", "string", "Default shift ID for Uniform staff"),
    "default_shift_non_uniform": ("", "string", "Default shift ID for Non-Uniform staff"),
    "default_shift_trainee": ("", "string", "Default shift ID for Trainees"),
}


async def _get_or_create_setting(key: str, db: AsyncSession) -> str:
    """Helper to fetch a setting value or initialize default."""
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()
    if setting and setting.value is not None:
        return setting.value

    # Insert default if available
    if key in DEFAULT_SETTINGS:
        val, val_type, desc = DEFAULT_SETTINGS[key]
        if not setting:
            setting = SystemSetting(key=key, value=val, value_type=val_type, description=desc)
            db.add(setting)
        else:
            setting.value = val
        await db.flush()
        return val
    return ""


async def _save_setting(key: str, value: str, db: AsyncSession, val_type: str = "string", desc: str | None = None):
    """Upsert a setting key-value pair."""
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = value
    else:
        setting = SystemSetting(key=key, value=value, value_type=val_type, description=desc)
        db.add(setting)
    await db.flush()


class BrandingUpdate(BaseModel):
    acronym: str
    display_name: str
    legal_name: str
    system_name: str
    tagline: str
    logo_url: str | None = None


class PinRangesUpdate(BaseModel):
    trainee_pin_max: int
    staff_pin_min: int


class DesignationCreate(BaseModel):
    name: str


@router.get("", response_model=ApiResponse)
async def get_all_settings(db: AsyncSession = Depends(get_db)):
    """Retrieve all configuration settings."""
    # Ensure all defaults exist
    for k in DEFAULT_SETTINGS:
        await _get_or_create_setting(k, db)

    result = await db.execute(select(SystemSetting))
    all_settings = result.scalars().all()

    settings_map = {s.key: s.value for s in all_settings}

    designations = []
    try:
        designations = json.loads(settings_map.get("civil_designations", "[]"))
    except Exception:
        designations = []

    return ApiResponse(data={
        "branding": {
            "acronym": settings_map.get("org_acronym", "PTS"),
            "display_name": settings_map.get("org_display_name", "Police Training School Rawat"),
            "legal_name": settings_map.get("org_legal_name", "Police Training School, Rawat — Rawalpindi"),
            "system_name": settings_map.get("org_system_name", "Biometric Attendance Management System"),
            "tagline": settings_map.get("org_tagline", "Train to Serve"),
            "logo_url": settings_map.get("org_logo_url", "/pts_logo.png"),
        },
        "ranges": {
            "trainee_pin_min": int(settings_map.get("trainee_pin_min", 1)),
            "trainee_pin_max": int(settings_map.get("trainee_pin_max", 2000)),
            "staff_pin_min": int(settings_map.get("staff_pin_min", 2001)),
        },
        "default_shifts": {
            "uniform": settings_map.get("default_shift_uniform", ""),
            "non_uniform": settings_map.get("default_shift_non_uniform", ""),
            "trainee": settings_map.get("default_shift_trainee", ""),
        },
        "designations": designations,
    })


@router.post("/branding", response_model=ApiResponse)
async def update_branding(payload: BrandingUpdate, db: AsyncSession = Depends(get_db)):
    """Update branding information."""
    await _save_setting("org_acronym", payload.acronym, db)
    await _save_setting("org_display_name", payload.display_name, db)
    await _save_setting("org_legal_name", payload.legal_name, db)
    await _save_setting("org_system_name", payload.system_name, db)
    await _save_setting("org_tagline", payload.tagline, db)
    if payload.logo_url is not None:
        await _save_setting("org_logo_url", payload.logo_url, db)

    return ApiResponse(message="Branding configuration saved successfully")


@router.post("/ranges", response_model=ApiResponse)
async def update_pin_ranges(payload: PinRangesUpdate, db: AsyncSession = Depends(get_db)):
    """Update Trainee and Staff PIN routing ranges."""
    if payload.staff_pin_min <= payload.trainee_pin_max:
        payload.staff_pin_min = payload.trainee_pin_max + 1

    await _save_setting("trainee_pin_max", str(payload.trainee_pin_max), db, "int")
    await _save_setting("staff_pin_min", str(payload.staff_pin_min), db, "int")

    return ApiResponse(
        data={
            "trainee_pin_min": 1,
            "trainee_pin_max": payload.trainee_pin_max,
            "staff_pin_min": payload.staff_pin_min,
        },
        message="PIN ranges updated successfully"
    )


class DefaultShiftsUpdate(BaseModel):
    uniform: str | None = None
    non_uniform: str | None = None
    trainee: str | None = None


@router.post("/default-shifts", response_model=ApiResponse)
async def update_default_shifts(payload: DefaultShiftsUpdate, db: AsyncSession = Depends(get_db)):
    """Update default shifts for personnel categories."""
    if payload.uniform is not None:
        await _save_setting("default_shift_uniform", payload.uniform, db)
    if payload.non_uniform is not None:
        await _save_setting("default_shift_non_uniform", payload.non_uniform, db)
    if payload.trainee is not None:
        await _save_setting("default_shift_trainee", payload.trainee, db)

    return ApiResponse(message="Default shifts updated successfully")


@router.get("/designations", response_model=ApiResponse)
async def list_designations(db: AsyncSession = Depends(get_db)):
    """List non-uniform designations."""
    raw = await _get_or_create_setting("civil_designations", db)
    try:
        items = json.loads(raw)
    except Exception:
        items = []
    return ApiResponse(data=items)


@router.post("/designations", response_model=ApiResponse)
async def add_designation(payload: DesignationCreate, db: AsyncSession = Depends(get_db)):
    """Add a new non-uniform designation."""
    raw = await _get_or_create_setting("civil_designations", db)
    try:
        items = json.loads(raw)
    except Exception:
        items = []

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Designation name cannot be empty")

    if name not in items:
        items.append(name)
        await _save_setting("civil_designations", json.dumps(items), db, "json")

    return ApiResponse(data=items, message=f"Designation '{name}' added")


@router.delete("/designations/{name}", response_model=ApiResponse)
async def remove_designation(name: str, db: AsyncSession = Depends(get_db)):
    """Remove a non-uniform designation."""
    raw = await _get_or_create_setting("civil_designations", db)
    try:
        items = json.loads(raw)
    except Exception:
        items = []

    items = [i for i in items if i.lower() != name.strip().lower()]
    await _save_setting("civil_designations", json.dumps(items), db, "json")

    return ApiResponse(data=items, message=f"Designation removed")
