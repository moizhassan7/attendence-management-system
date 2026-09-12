"""User Management API endpoints."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.auth import UserOut, UserCreate, UserUpdate, ResetPasswordRequest
from app.core.security import get_password_hash

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=ApiResponse)
async def list_users(
    search: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    role: Annotated[str | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
):
    """List users with search and filter capabilities."""
    stmt = select(User).order_by(User.id)

    if search:
        s = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.username).like(s),
                func.lower(User.full_name).like(s),
            )
        )

    if status:
        if status.lower() == "active":
            stmt = stmt.where(User.is_active == True)
        elif status.lower() in ("inactive", "disabled"):
            stmt = stmt.where(User.is_active == False)

    if role:
        if role.lower() in ("admin",):
            stmt = stmt.where(User.role == "ADMIN")
        elif role.lower() in ("non-admin", "viewer", "operator"):
            stmt = stmt.where(User.role != "ADMIN")

    result = await db.execute(stmt)
    users = result.scalars().all()
    return ApiResponse(data=[UserOut.model_validate(u) for u in users])


@router.post("", response_model=ApiResponse, status_code=201)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Create a new user account."""
    existing = await db.execute(
        select(User).where(func.lower(User.username) == payload.username.strip().lower())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already exists")

    # Map role
    user_role = "ADMIN" if payload.role.upper() == "ADMIN" else "VIEWER"

    user = User(
        username=payload.username.strip(),
        full_name=payload.full_name or payload.username,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=user_role,
        is_active=payload.is_active,
    )
    db.add(user)
    await db.flush()
    return ApiResponse(data=UserOut.model_validate(user), message="User created successfully")


@router.put("/{user_id}", response_model=ApiResponse)
async def update_user(
    user_id: int, payload: UserUpdate, db: AsyncSession = Depends(get_db)
):
    """Update user account details."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.email is not None:
        user.email = payload.email
    if payload.role is not None:
        user.role = "ADMIN" if payload.role.upper() == "ADMIN" else "VIEWER"
    if payload.is_active is not None:
        user.is_active = payload.is_active

    await db.flush()
    return ApiResponse(data=UserOut.model_validate(user), message="User updated successfully")


@router.patch("/{user_id}/status", response_model=ApiResponse)
async def toggle_user_status(user_id: int, db: AsyncSession = Depends(get_db)):
    """Toggle user active status."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.username.lower() == "admin":
        raise HTTPException(status_code=400, detail="Cannot disable default administrator account")

    user.is_active = not user.is_active
    await db.flush()
    new_state = "Active" if user.is_active else "Disabled"
    return ApiResponse(
        data=UserOut.model_validate(user),
        message=f"User {user.username} is now {new_state}"
    )


@router.post("/{user_id}/reset-password", response_model=ApiResponse)
async def reset_password(
    user_id: int, payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
):
    """Reset user password."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = get_password_hash(payload.new_password)
    await db.flush()
    return ApiResponse(message=f"Password for {user.username} reset successfully")


@router.delete("/{user_id}", response_model=ApiResponse)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a user account."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.username.lower() in ("admin", "bioinc221"):
        raise HTTPException(status_code=400, detail="Cannot delete protected administrator account")

    await db.delete(user)
    return ApiResponse(message=f"User {user.username} deleted successfully")
