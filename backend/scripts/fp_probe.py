"""Deep probe for fingerprints a bulk template dump cannot see.

get_templates() reads the FingerTmp data table in one shot. Command 88
(get_user_template) asks the terminal for one user's finger directly. If the
per-user read returns data the bulk read missed, the fingerprints are on the
terminal and only our reading of them is broken.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from zk import ZK, const

TARGETS = [
    ("PTS Staff", "192.168.1.201"),
    ("TR-1", "192.168.1.205"),
]


def connect(ip: str):
    return ZK(ip, port=4370, timeout=25, password=0, ommit_ping=True).connect()


def probe(name: str, ip: str, sample: int) -> None:
    print(f"\n================ {name} ({ip}) ================")
    conn = connect(ip)
    try:
        users = conn.get_users() or []
        conn.read_sizes()
        print(f"device counters: users={conn.users} fingers={conn.fingers} "
              f"dummy={conn.dummy} cards={conn.cards} faces={conn.faces}")
        print(f"device name={conn.get_device_name()!r} serial={conn.get_serialnumber()!r}")

        # Raw size of each data table the terminal will hand over.
        for label, fct in (("FingerTmp", const.FCT_FINGERTMP), ("UserData", const.FCT_UDATA)):
            try:
                data, size = conn.read_with_buffer(const.CMD_DB_RRQ, fct)
                print(f"  table {label:9} raw bytes={size}")
            except Exception as exc:
                print(f"  table {label:9} read failed: {exc}")

        bulk = conn.get_templates() or []
        print(f"  bulk get_templates() -> {len(bulk)} templates")

        # Per-user direct read on the first N users.
        print(f"  per-user command 88 read on first {sample} users:")
        found = 0
        checked = 0
        for user in users[:sample]:
            hits = []
            for fid in range(10):
                try:
                    finger = conn.get_user_template(uid=user.uid, temp_id=fid)
                except Exception as exc:
                    print(f"     uid={user.uid} fid={fid} ERROR {exc}")
                    break
                if finger and getattr(finger, "template", b""):
                    hits.append((fid, finger.size))
            checked += 1
            if hits:
                found += 1
                print(f"     uid={user.uid:>4} pin={str(user.user_id)[:20]:<20} "
                      f"name={str(user.name)[:22]:<22} FOUND {hits}")
            else:
                print(f"     uid={user.uid:>4} pin={str(user.user_id)[:20]:<20} "
                      f"name={str(user.name)[:22]:<22} none")
        print(f"  --> per-user read found fingerprints for {found}/{checked} users")
    finally:
        try:
            conn.disconnect()
        except Exception:
            pass


if __name__ == "__main__":
    sample = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    for name, ip in TARGETS:
        try:
            probe(name, ip, sample)
        except Exception as exc:
            print(f"\n{name} ({ip}) probe failed: {exc}")
