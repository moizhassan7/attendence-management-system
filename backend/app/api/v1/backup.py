"""Database backup and restore — SQLite snapshots or PostgreSQL ZIP dumps."""

from __future__ import annotations

import hashlib
import io
import json
import logging
import os
import shutil
import sqlite3
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.config import get_settings
from app.database import Base, async_session_factory, engine, get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.common import ApiResponse
from app.utils.timezone import now

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/backup", tags=["backup"])

BACKUP_DIR = Path("backups")
REQUIRED_TABLES = {"personnel", "attendance_punches", "attendance_daily"}
SUMMARY_TABLES = (
    "personnel",
    "attendance_daily",
    "attendance_punches",
    "users",
    "devices",
    "departments",
    "ranks",
)


def _is_sqlite() -> bool:
    return "sqlite" in get_settings().database_url.lower()


def _postgres_url():
    raw = (
        get_settings()
        .database_url.replace("postgresql+asyncpg://", "postgresql://")
        .replace("postgresql+psycopg://", "postgresql://")
    )
    return make_url(raw)


def _table_names() -> list[str]:
    import app.models  # noqa: F401

    return [table.name for table in Base.metadata.sorted_tables]


def ensure_backup_dir() -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    return BACKUP_DIR


def calculate_sha256(filepath: Path) -> str:
    sha = hashlib.sha256()
    with open(filepath, "rb") as handle:
        while chunk := handle.read(8192):
            sha.update(chunk)
    return sha.hexdigest()


def format_bytes(size: int) -> str:
    value = float(size)
    for unit in ["B", "KB", "MB", "GB"]:
        if value < 1024.0:
            return f"{value:.1f} {unit}"
        value /= 1024.0
    return f"{value:.1f} TB"


def _summary_counts(counts: dict[str, int]) -> dict[str, int]:
    return {name: counts.get(name, 0) for name in SUMMARY_TABLES}


def get_sqlite_path() -> Path:
    url = get_settings().database_url
    raw = url.split("///", 1)[1] if "///" in url else url.split("://", 1)[-1]
    path = Path(raw)
    if not path.is_absolute():
        path = Path.cwd() / path
    return path.resolve()


def get_sqlite_record_counts(db_file: Path) -> dict[str, int]:
    counts: dict[str, int] = {}
    if not db_file.exists():
        return counts
    try:
        conn = sqlite3.connect(f"file:{db_file}?mode=ro", uri=True)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [
            row[0]
            for row in cursor.fetchall()
            if not row[0].startswith("sqlite") and not row[0].startswith("alembic")
        ]
        for table in tables:
            try:
                cursor.execute(f'SELECT count(*) FROM "{table}"')
                counts[table] = cursor.fetchone()[0]
            except sqlite3.Error:
                continue
        conn.close()
    except Exception as exc:
        logger.warning("Failed to get counts from %s: %s", db_file, exc)
    return counts


async def _pg_connect() -> asyncpg.Connection:
    url = _postgres_url()
    return await asyncpg.connect(
        host=url.host,
        port=url.port or 5432,
        user=url.username,
        password=url.password,
        database=url.database,
    )


async def _pg_counts(conn: asyncpg.Connection) -> dict[str, int]:
    counts: dict[str, int] = {}
    for table in _table_names():
        try:
            counts[table] = int(await conn.fetchval(f'SELECT count(*) FROM "{table}"'))
        except Exception:
            continue
    return counts


def _zip_counts(path: Path) -> dict[str, int]:
    try:
        with zipfile.ZipFile(path, "r") as archive:
            manifest = json.loads(archive.read("manifest.json"))
            return dict(manifest.get("record_counts") or {})
    except Exception:
        return {}


def _file_payload(path: Path) -> dict[str, Any]:
    stat = path.stat()
    if path.suffix.lower() == ".zip":
        counts = _zip_counts(path)
    else:
        counts = get_sqlite_record_counts(path)
    return {
        "filename": path.name,
        "size_bytes": stat.st_size,
        "size_formatted": format_bytes(stat.st_size),
        "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "sha256": calculate_sha256(path),
        "record_counts": counts,
        "summary": _summary_counts(counts),
    }


async def _write_audit(action: str, entity_id: str, performed_by: str, **extra: str | None) -> None:
    async with async_session_factory() as session:
        session.add(
            AuditLog(
                action=action,
                entity_type="database",
                entity_id=entity_id,
                old_value=extra.get("old_value"),
                new_value=extra.get("new_value"),
                performed_by=performed_by,
            )
        )
        await session.commit()


def _checkpoint_wal(db_file: Path) -> None:
    conn = sqlite3.connect(str(db_file))
    try:
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        conn.commit()
    finally:
        conn.close()


async def _live_database_info() -> dict[str, Any]:
    if _is_sqlite():
        live_db = get_sqlite_path()
        counts = get_sqlite_record_counts(live_db) if live_db.exists() else {}
        return {
            "engine": "sqlite",
            "path": live_db.name,
            "exists": live_db.exists(),
            "size_bytes": live_db.stat().st_size if live_db.exists() else 0,
            "size_formatted": format_bytes(live_db.stat().st_size) if live_db.exists() else "0 B",
            "record_counts": counts,
            "summary": _summary_counts(counts),
        }

    url = _postgres_url()
    conn = await _pg_connect()
    try:
        size = int(await conn.fetchval("SELECT pg_database_size(current_database())"))
        counts = await _pg_counts(conn)
    finally:
        await conn.close()
    return {
        "engine": "postgresql",
        "path": url.database or "postgres",
        "exists": True,
        "size_bytes": size,
        "size_formatted": format_bytes(size),
        "record_counts": counts,
        "summary": _summary_counts(counts),
    }


async def _create_postgres_zip(dest: Path) -> dict[str, int]:
    conn = await _pg_connect()
    try:
        counts = await _pg_counts(conn)
        with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for table in _table_names():
                buffer = io.BytesIO()
                await conn.copy_from_query(
                    f'SELECT * FROM "{table}"',
                    output=buffer,
                    format="csv",
                    header=True,
                )
                archive.writestr(f"tables/{table}.csv", buffer.getvalue())
            archive.writestr(
                "manifest.json",
                json.dumps(
                    {
                        "engine": "postgresql",
                        "created_at": now().isoformat(),
                        "tables": _table_names(),
                        "record_counts": counts,
                    },
                    indent=2,
                ),
            )
        return counts
    finally:
        await conn.close()


def _validate_sqlite_file(path: Path) -> None:
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        cur = conn.cursor()
        cur.execute("PRAGMA integrity_check")
        result = cur.fetchone()
        if not result or str(result[0]).lower() != "ok":
            conn.close()
            raise HTTPException(status_code=400, detail="Backup file is corrupted or not a valid SQLite database")
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cur.fetchall()}
        conn.close()
        missing = REQUIRED_TABLES - tables
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Backup file is missing required tables: {', '.join(sorted(missing))}",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Integrity check failed: {exc}") from exc


def _validate_zip_file(path: Path) -> None:
    if not zipfile.is_zipfile(path):
        raise HTTPException(status_code=400, detail="Backup file is not a valid ZIP archive")
    with zipfile.ZipFile(path, "r") as archive:
        names = set(archive.namelist())
        if "manifest.json" not in names:
            raise HTTPException(status_code=400, detail="Backup ZIP is missing manifest.json")
        missing = [f"tables/{table}.csv" for table in REQUIRED_TABLES if f"tables/{table}.csv" not in names]
        if missing:
            raise HTTPException(status_code=400, detail=f"Backup ZIP is missing: {', '.join(missing)}")


async def _restore_postgres_zip(path: Path) -> dict[str, int]:
    _validate_zip_file(path)
    conn = await _pg_connect()
    try:
        await conn.execute("SET session_replication_role = replica")
        tables = _table_names()
        quoted = ", ".join(f'"{name}"' for name in tables)
        if quoted:
            await conn.execute(f"TRUNCATE {quoted} RESTART IDENTITY CASCADE")
        with zipfile.ZipFile(path, "r") as archive:
            for table in tables:
                member = f"tables/{table}.csv"
                if member not in archive.namelist():
                    continue
                payload = archive.read(member)
                if not payload.strip():
                    continue
                header = payload.splitlines()[0].decode("utf-8") if payload else ""
                if header.strip() == "" or header.count(",") == 0 and header.strip() == "":
                    # empty table still has header
                    pass
                await conn.copy_to_table(
                    table,
                    source=io.BytesIO(payload),
                    format="csv",
                    header=True,
                )
        await conn.execute("SET session_replication_role = DEFAULT")
        return await _pg_counts(conn)
    except Exception:
        await conn.execute("SET session_replication_role = DEFAULT")
        raise
    finally:
        await conn.close()


@router.get("", response_model=ApiResponse)
async def list_backups(
    current_user: User = Depends(require_admin),
) -> ApiResponse:
    """List live database info and available backup files."""
    ensure_backup_dir()
    live_info = await _live_database_info()
    files = list(BACKUP_DIR.glob("*.db")) + list(BACKUP_DIR.glob("*.zip"))
    backups = [_file_payload(path) for path in sorted(files, key=os.path.getmtime, reverse=True) if path.is_file()]
    return ApiResponse(data={"live_database": live_info, "backups": backups})


@router.post("/create", response_model=ApiResponse)
async def create_backup(
    current_user: User = Depends(require_admin),
) -> ApiResponse:
    """Create a consistent snapshot of the live database."""
    ensure_backup_dir()
    timestamp_str = now().strftime("%Y%m%d_%H%M%S")

    if _is_sqlite():
        live_db = get_sqlite_path()
        if not live_db.exists():
            raise HTTPException(status_code=404, detail="Live database file not found")
        backup_filename = f"pts_attendance_backup_{timestamp_str}.db"
        backup_path = BACKUP_DIR / backup_filename
        try:
            _checkpoint_wal(live_db)
            src_conn = sqlite3.connect(str(live_db))
            dst_conn = sqlite3.connect(str(backup_path))
            try:
                with dst_conn:
                    src_conn.backup(dst_conn)
            finally:
                dst_conn.close()
                src_conn.close()
        except Exception as exc:
            if backup_path.exists():
                backup_path.unlink()
            raise HTTPException(status_code=500, detail=f"Backup creation failed: {exc}") from exc
    else:
        backup_filename = f"pts_attendance_backup_{timestamp_str}.zip"
        backup_path = BACKUP_DIR / backup_filename
        try:
            await _create_postgres_zip(backup_path)
        except Exception as exc:
            if backup_path.exists():
                backup_path.unlink()
            logger.exception("PostgreSQL backup failed")
            raise HTTPException(status_code=500, detail=f"Backup creation failed: {exc}") from exc

    payload = _file_payload(backup_path)
    await _write_audit(
        "CREATE_BACKUP",
        backup_filename,
        getattr(current_user, "username", "admin"),
        new_value=json.dumps({"size": payload["size_bytes"], "sha256": payload["sha256"]}),
    )
    return ApiResponse(data=payload, message=f"Backup {backup_filename} created successfully")


@router.get("/download/{filename}")
async def download_backup(
    filename: str,
    current_user: User = Depends(require_admin),
):
    """Download an existing backup file."""
    safe_name = os.path.basename(filename)
    file_path = BACKUP_DIR / safe_name
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Backup file not found")
    media = "application/zip" if file_path.suffix.lower() == ".zip" else "application/octet-stream"
    return FileResponse(path=str(file_path), filename=safe_name, media_type=media)


def _save_uploaded_backup(file: UploadFile) -> Path:
    original = os.path.basename(file.filename or "")
    lower = original.lower()
    if not original or not (lower.endswith(".db") or lower.endswith(".zip")):
        raise HTTPException(status_code=400, detail="Upload a .zip (PostgreSQL) or .db (SQLite) backup")
    safe_name = f"uploaded_restore_{now().strftime('%Y%m%d_%H%M%S')}_{original}"
    target = BACKUP_DIR / safe_name
    with open(target, "wb") as out:
        shutil.copyfileobj(file.file, out)
    if not target.exists() or target.stat().st_size == 0:
        if target.exists():
            target.unlink()
        raise HTTPException(status_code=400, detail="Uploaded backup file is empty")
    return target


async def _apply_restore(target: Path, performed_by: str) -> ApiResponse:
    pre_restore_name = f"safety_pre_restore_{now().strftime('%Y%m%d_%H%M%S')}"
    pre_restore_path = BACKUP_DIR / (pre_restore_name + (".db" if _is_sqlite() else ".zip"))

    try:
        if _is_sqlite():
            live_db = get_sqlite_path()
            _validate_sqlite_file(target)
            if live_db.exists():
                _checkpoint_wal(live_db)
                shutil.copy2(live_db, pre_restore_path)
            await engine.dispose()
            restore_conn = sqlite3.connect(str(target))
            live_conn = sqlite3.connect(str(live_db))
            try:
                with live_conn:
                    restore_conn.backup(live_conn)
            finally:
                live_conn.close()
                restore_conn.close()
            counts = get_sqlite_record_counts(live_db)
        else:
            _validate_zip_file(target)
            await _create_postgres_zip(pre_restore_path)
            counts = await _restore_postgres_zip(target)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Restore failed")
        if not _is_sqlite() and pre_restore_path.exists():
            try:
                await _restore_postgres_zip(pre_restore_path)
            except Exception:
                logger.exception("Failed to roll back PostgreSQL from safety copy")
        elif _is_sqlite() and pre_restore_path.exists():
            try:
                shutil.copy2(pre_restore_path, get_sqlite_path())
            except Exception:
                logger.exception("Failed to roll back SQLite from safety copy")
        raise HTTPException(status_code=500, detail=f"Database restore failed: {exc}") from exc

    await _write_audit(
        "RESTORE_DATABASE",
        target.name,
        performed_by,
        old_value=pre_restore_path.name,
        new_value=target.name,
    )
    return ApiResponse(
        data={
            "restored_from": target.name,
            "safety_copy": pre_restore_path.name,
            "record_counts": counts,
            "summary": _summary_counts(counts),
        },
        message=f"Database restored from {target.name}. Reload the app to see updated records.",
    )


@router.post("/restore/upload", response_model=ApiResponse)
async def restore_backup_upload(
    file: Annotated[UploadFile, File(...)],
    current_user: User = Depends(require_admin),
) -> ApiResponse:
    """Restore from an uploaded .zip (PostgreSQL) or .db (SQLite) file."""
    ensure_backup_dir()
    target = _save_uploaded_backup(file)
    return await _apply_restore(target, getattr(current_user, "username", "admin"))


@router.post("/restore", response_model=ApiResponse)
async def restore_backup(
    filename: Annotated[str | None, Query()] = None,
    file: UploadFile | None = File(None),
    current_user: User = Depends(require_admin),
) -> ApiResponse:
    """Restore the live database from a listed backup or an uploaded file."""
    ensure_backup_dir()
    performed_by = getattr(current_user, "username", "admin")
    has_upload = file is not None and bool(file.filename)

    if has_upload:
        target = _save_uploaded_backup(file)
    elif filename:
        target = BACKUP_DIR / os.path.basename(filename)
        if not target.exists():
            raise HTTPException(status_code=404, detail="Specified backup file not found")
    else:
        raise HTTPException(status_code=400, detail="Provide a backup filename or upload a backup file")

    return await _apply_restore(target, performed_by)


@router.delete("/{filename}", response_model=ApiResponse)
async def delete_backup(
    filename: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Delete a backup file from disk."""
    safe_name = os.path.basename(filename)
    if safe_name.startswith("safety_pre_restore_"):
        raise HTTPException(
            status_code=400,
            detail="Keep safety copies until you confirm the restore succeeded",
        )
    file_path = BACKUP_DIR / safe_name
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Backup file not found")

    file_path.unlink()
    db.add(
        AuditLog(
            action="DELETE_BACKUP",
            entity_type="database",
            entity_id=safe_name,
            performed_by=getattr(current_user, "username", "admin"),
        )
    )
    await db.commit()
    return ApiResponse(message=f"Backup {safe_name} deleted successfully")
