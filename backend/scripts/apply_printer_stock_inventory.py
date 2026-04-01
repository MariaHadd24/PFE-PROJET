from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Dict, Iterable, List, Optional

import httpx


@dataclass(frozen=True)
class PrinterInput:
    brand: str
    model: str
    serial_number: str
    status_condition: Optional[str] = None  # e.g. "New" -> maps to asset.condition
    asset_number: Optional[str] = None  # maps to asset.immoNumber
    reception_date: Optional[str] = None  # maps to asset.dateIn + acquisitionDate
    area: Optional[str] = None
    responsible: Optional[str] = None  # maps to asset.pilote
    check_mark: Optional[str] = None  # maps to asset.bciCheck
    check_date: Optional[str] = None  # kept in comment (if reception_date exists)
    owner: Optional[str] = None  # maps to asset.department
    printer_name: Optional[str] = None  # maps to asset.assetTag
    site: Optional[str] = None  # maps to asset.site
    ip: Optional[str] = None  # maps to asset.ipAddress


def _clean(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    v = str(s).strip()
    return v or None


def _parse_iso_date(s: Optional[str]) -> Optional[date]:
    s = _clean(s)
    if not s:
        return None
    # accept YYYY-MM-DD or DD/MM/YYYY
    if "-" in s and len(s) >= 10:
        try:
            return date.fromisoformat(s[:10])
        except Exception:
            return None
    if "/" in s:
        parts = s.split("/")
        if len(parts) >= 3:
            try:
                dd = int(parts[0])
                mm = int(parts[1])
                yyyy = int(parts[2])
                return date(yyyy, mm, dd)
            except Exception:
                return None
    return None


def _warranty_from(acq: Optional[date]) -> str:
    if acq is None:
        return "2030-01-01"
    # Simple default: 1 year warranty
    return str(acq + timedelta(days=365))


def _non_empty_fields(d: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for k, v in d.items():
        if v is None:
            continue
        if isinstance(v, str) and not v.strip():
            continue
        out[k] = v
    return out


def _get(client: httpx.Client, base: str, path: str) -> Any:
    r = client.get(f"{base}{path}")
    r.raise_for_status()
    return r.json()


def _post(client: httpx.Client, base: str, path: str, payload: Dict[str, Any]) -> Any:
    r = client.post(f"{base}{path}", json=payload)
    r.raise_for_status()
    return r.json()


def _patch(client: httpx.Client, base: str, path: str, payload: Dict[str, Any]) -> Any:
    r = client.patch(f"{base}{path}", json=payload)
    r.raise_for_status()
    return r.json()


def _iter_assets_by_serial(assets: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    by_sn: Dict[str, Dict[str, Any]] = {}
    for a in assets:
        sn = str(a.get("serialNumber") or "").strip()
        if not sn:
            continue
        by_sn[sn.lower()] = a
    return by_sn


def build_printers() -> List[PrinterInput]:
    # Source: user-provided bullet list (March 9, 2026)
    return [
        PrinterInput(
            brand="ZEBRA",
            model="ZT421",
            serial_number="99J251701862",
            status_condition="New",
            asset_number="70076",
            reception_date="2025-11-04",
            area="AS2",
            responsible="SABIR",
            check_mark="✓",
            check_date="12/11/2025",
            owner="C-NEO",
        ),
        PrinterInput(
            brand="ZEBRA",
            model="ZT421",
            serial_number="99J251701860",
            status_condition="New",
            asset_number="70076",
            reception_date="2025-11-04",
            area="AS2",
            responsible="SABIR",
            check_mark="✓",
            check_date="12/11/2025",
            owner="C-NEO",
        ),
        PrinterInput(
            brand="ZEBRA",
            model="ZT421",
            serial_number="99J251701858",
            status_condition="New",
            asset_number="70076",
            reception_date="2025-11-04",
            area="AS2",
            responsible="SABIR",
            check_mark="✓",
            check_date="12/11/2025",
            owner="C-NEO",
        ),
        PrinterInput(
            brand="HP",
            model="Pro Shredder",
            serial_number="21010352",
            status_condition="New",
            area="AS2",
            responsible="SABIR",
            check_mark="✓",
            check_date="17/09/2025",
        ),
        PrinterInput(
            brand="HP",
            model="HP Color LaserJet MFP E78523",
            serial_number="CZBBT7Z0QH",
            printer_name="PRMA6010",
            area="Open_Space",
            site="MA6",
            ip="10.57.134.10",
        ),
        PrinterInput(
            brand="HP",
            model="HP Color LaserJet MFP X58045",
            serial_number="CZBBT80078",
            printer_name="PRMA6011",
            area="Open_Space",
            site="MA6",
            ip="10.57.134.11",
        ),
        PrinterInput(
            brand="HP",
            model="HP Color LaserJet MFP E78523",
            serial_number="CZBBT7Z0QL",
            printer_name="PRMA6013",
            area="bureau Maintenance",
            site="MA6",
            ip="10.57.134.13",
        ),
        PrinterInput(
            brand="HP",
            model="HP Color LaserJet MFP X58045",
            serial_number="CZBBT80003",
            printer_name="PRMA6014",
            area="bureau logistique",
            site="MA6",
            ip="10.57.134.14",
        ),
        PrinterInput(
            brand="HP",
            model="HP Color LaserJet MFP E78523",
            serial_number="CZBBT720QJ",
            printer_name="PRMA6016",
            area="Open_Space",
            site="MA6",
            ip="10.57.134.16",
        ),
    ]


def main() -> int:
    api_base = os.getenv("PFE_API_BASE_URL") or "http://127.0.0.1:5173/api"

    printers = build_printers()

    timeout = httpx.Timeout(15.0, connect=5.0)
    with httpx.Client(timeout=timeout) as client:
        health = _get(client, api_base, "/health")
        storage = str(health.get("storage") or "")
        if storage.lower() != "sqlserver":
            print(f"WARN: backend storage is {storage!r} (expected 'sqlserver').")

        assets = _get(client, api_base, "/assets?limit=10000")
        if not isinstance(assets, list):
            raise RuntimeError("Unexpected /assets response")

        by_sn = _iter_assets_by_serial(assets)

        updated = 0
        created = 0
        missing_required_for_create: List[str] = []

        for p in printers:
            sn = _clean(p.serial_number)
            if not sn:
                continue

            existing = by_sn.get(sn.lower())

            acq = _parse_iso_date(p.reception_date) or _parse_iso_date(p.check_date)
            acq_str = str(acq) if acq else "2025-01-01"

            # Map user fields -> Asset fields used by Stock Inventory
            patch_payload = _non_empty_fields(
                {
                    "serialNumber": sn,
                    "category": "Printer",
                    "type": _clean(p.brand),
                    "model": _clean(p.model),
                    "ipAddress": _clean(p.ip),
                    "area": _clean(p.area),
                    "department": _clean(p.owner),
                    "condition": _clean(p.status_condition),
                    "immoNumber": _clean(p.asset_number),
                    "dateIn": str(_parse_iso_date(p.reception_date) or "")[:10] or None,
                    "pilote": _clean(p.responsible),
                    "bciCheck": _clean(p.check_mark),
                    "comment": _clean(
                        f"CheckDate: {p.check_date}" if p.check_date and p.reception_date else (f"Check: {p.check_mark} {p.check_date}" if p.check_date or p.check_mark else None)
                    ),
                    "assetTag": _clean(p.printer_name),
                    "site": _clean(p.site),
                }
            )

            if existing is not None:
                asset_id = str(existing.get("id"))

                # Never blank out required-ish fields if user didn’t specify them.
                patch_payload.pop("assetTag", None) if not _clean(p.printer_name) else None
                patch_payload.pop("site", None) if not _clean(p.site) else None

                _patch(client, api_base, f"/assets/{asset_id}", patch_payload)
                updated += 1
                continue

            # Create a new asset if not found
            asset_tag = _clean(p.printer_name) or _clean(p.asset_number) or sn
            site = _clean(p.site) or "MA6"
            supplier = _clean(p.brand) or "Unknown"

            create_payload: Dict[str, Any] = {
                "assetTag": asset_tag,
                "serialNumber": sn,
                "macAddress": None,
                "ipAddress": _clean(p.ip),
                "area": _clean(p.area),
                "department": _clean(p.owner),
                "condition": _clean(p.status_condition),
                "model": _clean(p.model) or "Unknown",
                "type": _clean(p.brand),
                "deviceProfile": None,
                "category": "Printer",
                "supplier": supplier,
                "site": site,
                "status": "Available",
                "warrantyEndDate": _warranty_from(acq),
                "acquisitionDate": acq_str,
                "value": 0.0,
                "dateIn": str(_parse_iso_date(p.reception_date) or "")[:10] or None,
                "pilote": _clean(p.responsible),
                "bciCheck": _clean(p.check_mark),
                "immoNumber": _clean(p.asset_number),
                "comment": _clean(
                    f"CheckDate: {p.check_date}" if p.check_date and p.reception_date else (f"Check: {p.check_mark} {p.check_date}" if p.check_date or p.check_mark else None)
                ),
            }

            create_payload = _non_empty_fields(create_payload)

            # Create requires some mandatory keys. Validate quickly.
            required = [
                "assetTag",
                "serialNumber",
                "model",
                "category",
                "supplier",
                "site",
                "warrantyEndDate",
                "acquisitionDate",
                "value",
            ]
            if any(k not in create_payload for k in required):
                missing_required_for_create.append(sn)
                continue

            _post(client, api_base, "/assets", create_payload)
            created += 1

        print(f"OK printers_upsert: updated={updated} created={created} total={len(printers)}")
        if missing_required_for_create:
            print("WARN could_not_create_missing_required:")
            for sn in missing_required_for_create:
                print(f"  - {sn}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
