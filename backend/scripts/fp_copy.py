"""Copy fingerprint templates between ZKTeco terminals by PIN.

Fingerprint templates live only on terminal hardware. Pushing a user profile to
a second terminal does NOT copy the finger, so that terminal shows the ID but
rejects every scan. This copies the templates across.

Source and target must run the same fingerprint algorithm (same platform and
firmware), otherwise the templates are not portable.

    # back up every terminal's fingerprints to backups/ (writes nothing)
    python scripts/fp_copy.py

    # show what could be restored onto a terminal
    python scripts/fp_copy.py --to 192.168.1.201

    # actually write the templates
    python scripts/fp_copy.py --to 192.168.1.201 --apply
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from zk import ZK
from zk.finger import Finger

from app.database import async_session_factory
from app.models.device import Device
from app.services.pin_match import MIN_TRUNCATED_PIN_LEN, normalize_pin

BACKUP_DIR = Path(__file__).resolve().parents[1] / "backups"


def pin_matches(a: str, b: str) -> bool:
    """Exact PIN, or one side is a truncation of the other (terminal PIN width)."""
    a, b = normalize_pin(a), normalize_pin(b)
    if not a or not b:
        return False
    if a == b:
        return True
    short, long = (a, b) if len(a) < len(b) else (b, a)
    return len(short) >= MIN_TRUNCATED_PIN_LEN and long.startswith(short)


def connect(ip: str, port: int, timeout: int = 20):
    zk = ZK(ip, port=port, timeout=timeout, password=0, force_udp=False, ommit_ping=True)
    return zk.connect()


def read_terminal(name: str, ip: str, port: int) -> dict:
    """Pull users + all fingerprint templates from one terminal."""
    print(f"  reading {name} ({ip}) ...", flush=True)
    conn = connect(ip, port)
    try:
        users = conn.get_users() or []
        templates = conn.get_templates() or []
        platform = ""
        firmware = ""
        try:
            platform = conn.get_platform() or ""
            firmware = conn.get_firmware_version() or ""
        except Exception:
            pass
    finally:
        try:
            conn.disconnect()
        except Exception:
            pass

    pin_by_uid = {u.uid: normalize_pin(u.user_id) for u in users}
    by_pin: dict[str, list[Finger]] = {}
    for tpl in templates:
        if not getattr(tpl, "valid", 1) or not tpl.template:
            continue
        pin = pin_by_uid.get(tpl.uid)
        if not pin:
            continue
        by_pin.setdefault(pin, []).append(tpl)
    print(
        f"    {name}: users={len(users)} templates={len(templates)} "
        f"pins_with_finger={len(by_pin)} platform={platform!r} fw={firmware!r}"
    )
    return {
        "name": name,
        "ip": ip,
        "platform": platform,
        "firmware": firmware,
        "users": users,
        "by_pin": by_pin,
    }


def write_backup(sources: list[dict]) -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    path = BACKUP_DIR / f"fingerprints-{datetime.now():%Y%m%d-%H%M%S}.json"
    payload = {
        "captured_at": datetime.now().isoformat(),
        "terminals": [
            {
                "name": src["name"],
                "ip": src["ip"],
                "platform": src["platform"],
                "firmware": src["firmware"],
                "users": [
                    {
                        "uid": u.uid,
                        "user_id": str(u.user_id),
                        "name": u.name,
                        "privilege": u.privilege,
                        "password": u.password,
                        "group_id": str(u.group_id),
                        "card": u.card,
                    }
                    for u in src["users"]
                ],
                "templates": {
                    pin: [f.json_pack() for f in fingers]
                    for pin, fingers in src["by_pin"].items()
                },
            }
            for src in sources
        ],
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    print(f"\nBackup written: {path}  ({path.stat().st_size / 1_048_576:.1f} MB)")
    return path


async def load_devices() -> list[tuple[str, str, int]]:
    async with async_session_factory() as db:
        rows = (await db.execute(select(Device).order_by(Device.name))).scalars().all()
        return [(d.name, d.ip_address, d.port or 4370) for d in rows]


def build_pin_index(sources: list[dict]) -> dict[str, tuple[str, list[Finger]]]:
    """PIN -> (source terminal name, fingers). Richest template set wins."""
    index: dict[str, tuple[str, list[Finger]]] = {}
    for src in sources:
        for pin, fingers in src["by_pin"].items():
            current = index.get(pin)
            if current is None or len(fingers) > len(current[1]):
                index[pin] = (src["name"], fingers)
    return index


def lookup(pin: str, index: dict[str, tuple[str, list[Finger]]]) -> tuple[str, list[Finger]] | None:
    hit = index.get(pin)
    if hit:
        return hit
    matches = [(k, v) for k, v in index.items() if pin_matches(k, pin)]
    if len(matches) == 1:
        return matches[0][1]
    if matches:
        # Longest shared prefix is the most specific match.
        matches.sort(key=lambda kv: len(kv[0]), reverse=True)
        return matches[0][1]
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--to", help="target terminal IP (omit to only take a backup)")
    parser.add_argument("--from", dest="sources", nargs="*", help="source IPs (default: all others)")
    parser.add_argument("--apply", action="store_true", help="write templates (default: dry run)")
    parser.add_argument("--limit", type=int, default=0, help="only write the first N users")
    args = parser.parse_args()

    devices = asyncio.run(load_devices())

    if not args.to:
        print("Backup mode: dumping every terminal, writing nothing")
        write_backup([read_terminal(*d) for d in devices])
        return 0

    target = next((d for d in devices if d[1] == args.to), None)
    if target is None:
        print(f"Target {args.to} is not a configured device.")
        return 1
    source_list = [
        d for d in devices
        if d[1] != args.to and (not args.sources or d[1] in args.sources)
    ]
    if not source_list:
        print("No source terminals.")
        return 1

    print("Reading source terminals")
    sources = [read_terminal(*d) for d in source_list]
    write_backup(sources)

    index = build_pin_index(sources)
    print(f"\nTemplate library: {len(index)} PINs with at least one finger")

    target_name, target_ip, target_port = target
    print(f"\nReading target {target_name} ({target_ip})")
    tgt = read_terminal(target_name, target_ip, target_port)

    platforms = {s["platform"] for s in sources if s["platform"]}
    if tgt["platform"] and platforms and tgt["platform"] not in platforms:
        print(
            f"  WARNING: target platform {tgt['platform']!r} differs from sources {platforms}. "
            "Templates may be rejected."
        )

    have = set(tgt["by_pin"])
    todo: list[tuple[object, str, list[Finger]]] = []
    unmatched: list[str] = []
    for user in tgt["users"]:
        pin = normalize_pin(user.user_id)
        if pin in have:
            continue
        hit = lookup(pin, index)
        if hit is None:
            unmatched.append(f"{pin} ({user.name})")
            continue
        todo.append((user, hit[0], hit[1]))

    print(f"\nTarget already has fingerprints for {len(have)} PINs")
    print(f"Can restore: {len(todo)} users")
    print(f"No source fingerprint found: {len(unmatched)} users")
    for item in unmatched[:15]:
        print(f"   - {item}")
    if len(unmatched) > 15:
        print(f"   ... and {len(unmatched) - 15} more")

    if not args.apply:
        print("\nDry run. Re-run with --apply to write these templates.")
        return 0
    if not todo:
        print("\nNothing to write.")
        return 0

    if args.limit:
        todo = todo[: args.limit]
    print(f"\nWriting {len(todo)} users to {target_name} ...")
    conn = connect(target_ip, target_port, timeout=30)
    written = 0
    failed: list[str] = []
    try:
        conn.get_users()  # sets user_packet_size, required by save_user_template
        try:
            conn.disable_device()
        except Exception as exc:
            print(f"  could not disable terminal ({exc}); continuing")
        started = time.time()
        for position, (user, src_name, fingers) in enumerate(todo, start=1):
            payload = [
                Finger(uid=user.uid, fid=f.fid, valid=1, template=f.template)
                for f in fingers
            ]
            try:
                conn.save_user_template(user, payload)
                written += 1
            except Exception as exc:
                failed.append(f"{user.user_id} ({user.name}): {exc}")
            if position % 20 == 0 or position == len(todo):
                rate = position / max(0.1, time.time() - started)
                print(
                    f"  {position}/{len(todo)} written={written} failed={len(failed)} "
                    f"({rate:.1f}/s)",
                    flush=True,
                )
    finally:
        for label, fn in (
            ("enable_device", conn.enable_device),
            ("refresh_data", conn.refresh_data),
            ("cancel_capture", conn.cancel_capture),
            ("verify_user", conn.verify_user),
        ):
            try:
                fn()
            except Exception as exc:
                print(f"  cleanup {label} failed: {exc}")
        try:
            conn.disconnect()
        except Exception:
            pass

    print(f"\nDone. written={written} failed={len(failed)}")
    for item in failed[:15]:
        print(f"   FAIL {item}")

    print("\nVerifying target ...")
    check = read_terminal(target_name, target_ip, target_port)
    print(f"  {target_name} now has fingerprints for {len(check['by_pin'])} PINs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
