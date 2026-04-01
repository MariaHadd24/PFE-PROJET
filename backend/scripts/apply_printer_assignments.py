from __future__ import annotations

import argparse
import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

import httpx


def _to_str(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    return str(v).strip()


def _norm_serial(v: Any) -> str:
    s = _to_str(v)
    if not s:
        return ""
    return re.sub(r"[^A-Za-z0-9]", "", s).upper()


def _parse_date_to_iso(v: Any) -> Optional[str]:
    raw = _to_str(v)
    if not raw:
        return None

    # ISO
    try:
        dt = datetime.fromisoformat(raw)
        return dt.date().isoformat()
    except ValueError:
        pass

    # dd/mm/yyyy
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", raw)
    if m:
        d = int(m.group(1))
        mo = int(m.group(2))
        y = int(m.group(3))
        try:
            return date(y, mo, d).isoformat()
        except ValueError:
            return None

    return None


def _pick_active_assignment(assignments: List[Dict[str, Any]], asset_id: str) -> Optional[Dict[str, Any]]:
    active = [
        a
        for a in assignments
        if str(a.get("assetId") or "") == asset_id
        and str(a.get("status") or "Active").strip().lower() != "returned"
    ]
    if not active:
        return None

    # Prefer printer assignment if present
    for a in active:
        if str(a.get("device_category") or "").strip() == "Printer":
            return a

    # Otherwise keep the most recent by startDate/assignment_date, best-effort
    def key(a: Dict[str, Any]) -> Tuple[str, str]:
        return (
            str(a.get("startDate") or ""),
            str(a.get("assignment_date") or ""),
        )

    active.sort(key=key, reverse=True)
    return active[0]


def main() -> int:
    ap = argparse.ArgumentParser(description="Upsert Printer assignments with area via API")
    ap.add_argument(
        "--base-url",
        default="http://127.0.0.1:5173/api",
        help="API base URL (default: http://127.0.0.1:5173/api)",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Print intended operations without calling the API",
    )
    args = ap.parse_args()

    base_url = args.base_url.rstrip("/")

    # Serial number is the stable key we were given.
    # assignment_date: optional (if provided in the list)
    printers = [
        {
            "serial": "99J251701862",
            "area": "AS2",
            "assignment_date": "12/11/2025",
        },
        {
            "serial": "99J251701860",
            "area": "AS2",
            "assignment_date": "12/11/2025",
        },
        {
            "serial": "99J251701858",
            "area": "AS2",
            "assignment_date": "12/11/2025",
        },
        {
            "serial": "21010352",
            "area": "AS2",
            "assignment_date": "17/09/2025",
        },
        {
            "serial": "CZBBT7Z0QH",
            "area": "Open_Space",
        },
        {
            "serial": "CZBBT80078",
            "area": "Open_Space",
        },
        {
            "serial": "CZBBT7Z0QL",
            "area": "bureau Maintenance",
        },
        {
            "serial": "CZBBT80003",
            "area": "bureau logistique",
        },
        {
            "serial": "CZBBT720QJ",
            "area": "Open_Space",
        },
    ]

    created = 0
    updated = 0
    skipped = 0
    missing_assets: List[str] = []
    failed: List[str] = []

    with httpx.Client(timeout=30.0) as client:
        if not args.dry_run:
            health = client.get(f"{base_url}/health")
            health.raise_for_status()
            hj = health.json()
            print(
                f"health: status={hj.get('status')} storage={hj.get('storage')} sqlserver={hj.get('sqlserver')}"
            )

        assets_by_serial: Dict[str, str] = {}
        if not args.dry_run:
            res_assets = client.get(f"{base_url}/assets", params={"limit": 10000})
            res_assets.raise_for_status()
            assets = res_assets.json()
            for a in assets:
                serial_norm = _norm_serial(a.get("serialNumber"))
                if serial_norm:
                    assets_by_serial[serial_norm] = str(a.get("id"))
            print(f"assets: loaded={len(assets)} mapped_by_serial={len(assets_by_serial)}")

        assignments: List[Dict[str, Any]] = []
        if not args.dry_run:
            res_asg = client.get(f"{base_url}/assignments", params={"limit": 1000})
            res_asg.raise_for_status()
            assignments = res_asg.json()
            print(f"assignments: loaded={len(assignments)}")

        for p in printers:
            serial_norm = _norm_serial(p.get("serial"))
            area = _to_str(p.get("area")).strip()
            if not serial_norm or not area:
                skipped += 1
                continue

            asset_id = assets_by_serial.get(serial_norm) if assets_by_serial else None
            if not asset_id:
                missing_assets.append(serial_norm)
                continue

            assignment_date_iso = _parse_date_to_iso(p.get("assignment_date"))

            existing = _pick_active_assignment(assignments, asset_id) if assignments else None

            if existing is not None:
                patch: Dict[str, Any] = {
                    "device_category": "Printer",
                    "area": area,
                    "status": "Active",
                }
                if assignment_date_iso:
                    patch["assignment_date"] = assignment_date_iso
                    patch["startDate"] = assignment_date_iso

                if args.dry_run:
                    print(f"PATCH assignment {existing.get('id')} assetId={asset_id} serial={serial_norm} area={area}")
                    updated += 1
                else:
                    try:
                        r = client.patch(f"{base_url}/assignments/{existing.get('id')}", json=patch)
                        r.raise_for_status()
                        updated += 1
                    except Exception as e:
                        failed.append(f"serial={serial_norm} patch_error={e}")
                continue

            # Create new active assignment
            new_id = f"PRN-{serial_norm}"
            payload: Dict[str, Any] = {
                "id": new_id,
                "assetId": asset_id,
                "device_category": "Printer",
                "area": area,
                "status": "Active",
            }
            if assignment_date_iso:
                payload["assignment_date"] = assignment_date_iso
                payload["startDate"] = assignment_date_iso

            if args.dry_run:
                print(f"CREATE assignment {new_id} assetId={asset_id} serial={serial_norm} area={area}")
                created += 1
                continue

            try:
                r = client.post(f"{base_url}/assignments", json=payload)
                if r.status_code == 409:
                    # If it already exists by id, patch it.
                    pr = client.patch(f"{base_url}/assignments/{new_id}", json={"area": area, "device_category": "Printer", "status": "Active"})
                    pr.raise_for_status()
                    updated += 1
                else:
                    r.raise_for_status()
                    created += 1
            except Exception as e:
                failed.append(f"serial={serial_norm} create_error={e}")

        print("\nsummary:")
        print(f"  created={created} updated={updated} skipped={skipped}")
        print(f"  missing_assets={len(missing_assets)} failed={len(failed)}")

        if missing_assets:
            print("missing_assets_serials:")
            for s in missing_assets:
                print(f"  - {s}")

        if failed:
            print("failed:")
            for s in failed:
                print(f"  - {s}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
