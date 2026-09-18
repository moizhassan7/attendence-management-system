"""Diagnose and recover ZKTeco terminals that reject every fingerprint.

Read-only by default. Pass --repair to push the terminal back into normal
verify mode (cancel capture, clear event registration, start verify, enable).

    python scripts/fp_doctor.py
    python scripts/fp_doctor.py --repair
    python scripts/fp_doctor.py --ip 192.168.1.201 --repair
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from zk import ZK

from app.database import async_session_factory
from app.models.device import Device


async def load_devices() -> list[tuple[str, str, int]]:
    async with async_session_factory() as db:
        rows = (await db.execute(select(Device).order_by(Device.name))).scalars().all()
        return [(d.name, d.ip_address, d.port or 4370) for d in rows]


def diagnose(name: str, ip: str, port: int, repair: bool) -> None:
    print(f"\n=== {name}  {ip}:{port} ===")
    zk = ZK(ip, port=port, timeout=15, password=0, force_udp=False, ommit_ping=True)
    try:
        conn = zk.connect()
    except Exception as exc:
        print(f"  CONNECT FAILED: {exc}")
        return

    try:
        try:
            print(f"  firmware={conn.get_firmware_version()!r} platform={conn.get_platform()!r}")
        except Exception as exc:
            print(f"  firmware read failed: {exc}")

        users = conn.get_users() or []
        print(f"  users on device: {len(users)}")

        try:
            templates = conn.get_templates() or []
        except Exception as exc:
            print(f"  TEMPLATE READ FAILED: {exc}")
            templates = []

        valid = [t for t in templates if getattr(t, "valid", 1)]
        sizes = Counter(getattr(t, "size", 0) for t in templates)
        uids_with_tpl = {t.uid for t in valid}
        print(f"  fingerprint templates: total={len(templates)} valid={len(valid)}")
        print(f"  distinct users holding a template: {len(uids_with_tpl)}")
        print(f"  template size histogram (size: count): {dict(sorted(sizes.items())[:8])}")

        missing = [u for u in users if u.uid not in uids_with_tpl]
        print(f"  users WITHOUT any valid template: {len(missing)}")
        for u in missing[:10]:
            print(f"     uid={u.uid} pin={u.user_id!r} name={u.name!r}")

        orphan = uids_with_tpl - {u.uid for u in users}
        if orphan:
            print(f"  ORPHAN templates (template uid has no user record): {sorted(orphan)[:20]}")

        if repair:
            print("  -- repair: returning terminal to verify mode --")
            for label, fn in (
                ("reg_event(0)", lambda: conn.reg_event(0)),
                ("cancel_capture", conn.cancel_capture),
                ("verify_user (start verify)", conn.verify_user),
                ("enable_device", conn.enable_device),
                ("refresh_data", conn.refresh_data),
            ):
                try:
                    fn()
                    print(f"     ok   {label}")
                except Exception as exc:
                    print(f"     FAIL {label}: {exc}")
    finally:
        try:
            conn.disconnect()
        except Exception:
            pass


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ip", help="only this device IP")
    parser.add_argument("--repair", action="store_true", help="reset terminal to verify mode")
    args = parser.parse_args()

    devices = await load_devices()
    if args.ip:
        devices = [d for d in devices if d[1] == args.ip]
    if not devices:
        print("No matching devices.")
        return 1
    for name, ip, port in devices:
        diagnose(name, ip, port, args.repair)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
