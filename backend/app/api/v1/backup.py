"""Database Backup and Restore API endpoints."""

from __future__ import annotations

import hashlib
import logging
import os
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.config import get_settings
from app.database import get_db, engine
from app.models.audit import AuditLog
from app.schemas.common import ApiResponse
from app.utils.timezone import now

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/backup", tags=["backup"])

BACKUP_DIR = Path("backups")


def get_db_path() -> Path:
    """Extract physical SQLite file path from database_url."""
    settings = get_settings()
    url = settings.database_url
    if "sqlite" in url:
        raw_path = url.split("///")[-1]
        return Path(raw_path).resolve()
    return Path("attendance.db").resolve()


def ensure_backup_dir() -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    return BACKUP_DIR


def calculate_sha256(filepath: Path) -> str:
    sha = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            sha.update(chunk)
    return sha.hexdigest()


class BackupInfo(BaseModel):
    filename: str
    size_bytes: int
    size_formatted: str
    created_at: str
    sha256: str
    record_counts: dict[str, int]


def format_bytes(size: int) -> str:
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024.0:
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} TB"


def get_sqlite_record_counts(db_file: Path) -> dict[str, int]:
    """Inspect tables inside SQLite database file."""
    counts = {}
    if not db_file.exists():
        return counts
    try:
        conn = sqlite3.connect(str(db_file))
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cursor.fetchall() if not r[0].startswith("sqlite") and not r[0].startswith("alembic")]
        for t in tables:
            try:
                cursor.execute(f"SELECT count(*) FROM [{t}]")
                counts[t] = cursor.fetchone()[0]
            except Exception:
                pass
        conn.close()
    except Exception as e:
        logger.warning("Failed to get counts from %s: %s", db_file, e)
    return counts


@router.get("", response_model=ApiResponse)
async def list_backups(
    current_user = Depends(require_admin),
):
    """List all available database backups."""
    ensure_backup_dir()
    backups = []
    
    # Also get live database info
    live_db = get_db_path()
    live_counts = get_sqlite_record_counts(live_db) if live_db.exists() else {}
    live_info = {
        "path": str(live_db.name),
        "exists": live_db.exists(),
        "size_bytes": live_db.stat().st_size if live_db.exists() else 0,
        "size_formatted": format_bytes(live_db.stat().st_size) if live_db.exists() else "0 B",
        "record_counts": live_counts,
    }

    for f in sorted(BACKUP_DIR.glob("*.db"), key=os.path.getmtime, reverse=True):
        stat = f.stat()
        created_time = datetime.fromtimestamp(stat.st_mtime).isoformat()
        checksum = calculate_sha256(f)
        counts = get_sqlite_record_counts(f)
        backups.append({
            "filename": f.name,
            "size_bytes": stat.st_size,
            "size_formatted": format_bytes(stat.st_size),
            "created_at": created_time,
            "sha256": checksum,
            "record_counts": counts,
        })

    return ApiResponse(data={"live_database": live_info, "backups": backups})


@router.post("/create", response_model=ApiResponse)
async def create_backup(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_admin),
):
    """Create a new SQLite backup snapshot."""
    live_db = get_db_path()
    if not live_db.exists():
        raise HTTPException(status_code=404, detail="Live database file not found")

    ensure_backup_dir()
    timestamp_str = now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"pts_attendance_backup_{timestamp_str}.db"
    backup_path = BACKUP_DIR / backup_filename

    try:
        # Use SQLite backup API for a hot, consistent snapshot
        src_conn = sqlite3.connect(str(live_db))
        dst_conn = sqlite3.connect(str(backup_path))
        with dst_conn:
            src_conn.backup(dst_conn)
        dst_conn.close()
        src_conn.close()

        checksum = calculate_sha256(backup_path)
        stat = backup_path.stat()
        counts = get_sqlite_record_counts(backup_path)

        # Audit log
        import json
        audit = AuditLog(
            action="CREATE_BACKUP",
            entity_type="database",
            entity_id=backup_filename,
            new_value=json.dumps({"size": stat.st_size, "sha256": checksum}),
            performed_by=getattr(current_user, "username", "admin"),
        )
        db.add(audit)
        await db.commit()

        return ApiResponse(
            data={
                "filename": backup_filename,
                "size_bytes": stat.st_size,
                "size_formatted": format_bytes(stat.st_size),
                "created_at": now().isoformat(),
                "sha256": checksum,
                "record_counts": counts,
            },
            message=f"Backup {backup_filename} created successfully",
        )
    except Exception as e:
        if backup_path.exists():
            backup_path.unlink()
        logger.error("Failed to create database backup: %s", e)
        raise HTTPException(status_code=500, detail=f"Backup creation failed: {e}")


@router.get("/download/{filename}")
async def download_backup(
    filename: str,
    current_user = Depends(require_admin),
):
    """Download an existing backup file."""
    # Prevent directory traversal
    safe_name = os.path.basename(filename)
    file_path = BACKUP_DIR / safe_name
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Backup file not found")

    return FileResponse(
        path=str(file_path),
        filename=safe_name,
        media_type="application/octet-stream",
    )


@router.post("/restore", response_model=ApiResponse)
async def restore_backup(
    filename: Annotated[str | None, Query()] = None,
    file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_admin),
):
    """Restore database from an existing backup file or uploaded file."""
    ensure_backup_dir()
    live_db = get_db_path()

    if file:
        safe_name = f"uploaded_restore_{now().strftime('%Y%m%d_%H%M%S')}_{os.path.basename(file.filename or 'backup.db')}"
        target_restore_file = BACKUP_DIR / safe_name
        with open(target_restore_file, "wb") as f_out:
            shutil.copyfileobj(file.file, f_out)
    elif filename:
        safe_name = os.path.basename(filename)
        target_restore_file = BACKUP_DIR / safe_name
        if not target_restore_file.exists():
            raise HTTPException(status_code=404, detail="Specified backup file not found")
    else:
        raise HTTPException(status_code=400, detail="Provide either a filename or upload a backup file")

    # Step 1: Validate SQLite file integrity
    try:
        test_conn = sqlite3.connect(str(target_restore_file))
        test_cur = test_conn.cursor()
        test_cur.execute("PRAGMA integrity_check")
        res = test_cur.fetchone()
        if not res or res[0].lower() != "ok":
            test_conn.close()
            raise HTTPException(status_code=400, detail="Backup file corrupted or invalid SQLite format")

        # Verify key tables exist
        test_cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {r[0] for r in test_cur.fetchall()}
        required = {"personnel", "attendance_punches", "attendance_daily"}
        if not required.issubset(tables):
            test_conn.close()
            raise HTTPException(
                status_code=400,
                detail=f"Backup file is missing required tables: {required - tables}",
            )
        test_conn.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Integrity check failed: {e}")

    # Step 2: Create safety snapshot of live database before overwriting
    pre_restore_name = f"safety_pre_restore_{now().strftime('%Y%m%d_%H%M%S')}.db"
    pre_restore_path = BACKUP_DIR / pre_restore_name
    try:
        if live_db.exists():
            shutil.copy2(live_db, pre_restore_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create pre-restore safety copy: {e}")

    # Step 3: Perform restore using SQLite backup API into live DB
    try:
        restore_conn = sqlite3.connect(str(target_restore_file))
        live_conn = sqlite3.connect(str(live_db))
        with live_conn:
            restore_conn.backup(live_conn)
        live_conn.close()
        restore_conn.close()

        # Audit log
        audit = AuditLog(
            action="RESTORE_DATABASE",
            entity_type="database",
            entity_id=target_restore_file.name,
            old_value=pre_restore_name,
            new_value=target_restore_file.name,
            performed_by=getattr(current_user, "username", "admin"),
        )
        db.add(audit)
        await db.commit()

        counts = get_sqlite_record_counts(live_db)
        return ApiResponse(
            data={"restored_from": target_restore_file.name, "record_counts": counts},
            message=f"Database restored successfully from {target_restore_file.name}",
        )
    except Exception as e:
        logger.error("Restore failed: %s", e)
        # Attempt to roll back from safety snapshot
        if pre_restore_path.exists():
            shutil.copy2(pre_restore_path, live_db)
        raise HTTPException(status_code=500, detail=f"Database restore failed: {e}")


@router.delete("/{filename}", response_model=ApiResponse)
async def delete_backup(
    filename: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_admin),
):
    """Delete an old backup file."""
    safe_name = os.path.basename(filename)
    file_path = BACKUP_DIR / safe_name
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Backup file not found")

    file_path.unlink()

    audit = AuditLog(
        action="DELETE_BACKUP",
        entity_type="database",
        entity_id=safe_name,
        performed_by=getattr(current_user, "username", "admin"),
    )
    db.add(audit)
    await db.commit()

    return ApiResponse(message=f"Backup {safe_name} deleted successfully")
