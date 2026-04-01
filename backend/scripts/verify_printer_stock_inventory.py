from __future__ import annotations

import os
from typing import Any, Dict, List

import httpx

SERIALS: List[str] = [
    "99J251701862",
    "99J251701860",
    "99J251701858",
    "21010352",
    "CZBBT7Z0QH",
    "CZBBT80078",
    "CZBBT7Z0QL",
    "CZBBT80003",
    "CZBBT720QJ",
]


def main() -> int:
    api_base = os.getenv("PFE_API_BASE_URL") or "http://127.0.0.1:5173/api"

    with httpx.Client(timeout=15.0) as client:
        assets = client.get(f"{api_base}/assets?limit=10000").json()
        by_sn: Dict[str, Dict[str, Any]] = {}
        for a in assets:
            sn = str(a.get("serialNumber") or "").strip()
            if sn:
                by_sn[sn.lower()] = a

        missing = 0
        for sn in SERIALS:
            a = by_sn.get(sn.lower())
            if not a:
                print(f"MISSING {sn}")
                missing += 1
                continue

            summary = {
                "id": a.get("id"),
                "category": a.get("category"),
                "type": a.get("type"),
                "model": a.get("model"),
                "serialNumber": a.get("serialNumber"),
                "assetTag": a.get("assetTag"),
                "area": a.get("area"),
                "department": a.get("department"),
                "condition": a.get("condition"),
                "site": a.get("site"),
                "ipAddress": a.get("ipAddress"),
                "dateIn": a.get("dateIn"),
                "pilote": a.get("pilote"),
                "bciCheck": a.get("bciCheck"),
                "immoNumber": a.get("immoNumber"),
                "comment": a.get("comment"),
            }
            print(summary)

        if missing:
            print(f"WARN missing={missing}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
