"""Upsert a printer master list into the app via the REST API.

Why this exists:
- The Assignments dropdown only shows assets that exist in `/api/assets`.
- If printers are present in a separate Excel/stock file but were never imported
  to the backend storage, they cannot appear in the UI.

This script is intentionally:
- Small and dependency-free (stdlib only)
- Idempotent: create if missing, PATCH if exists

Usage (PowerShell):
  python backend/scripts/import_hp_printers_prma_via_api.py

Optional:
  $env:API_BASE_URL = 'http://localhost:5173/api'   # via Vite proxy
  $env:API_BASE_URL = 'http://localhost:8000/api'   # backend directly
"""

from __future__ import annotations

import datetime as _dt
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any, Dict, Iterable, List, Optional, Tuple


def _json_request(method: str, url: str, payload: Optional[Dict[str, Any]] = None, timeout_s: int = 15) -> Tuple[int, Any]:
    data = None
    headers = {"Accept": "application/json"}

    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"

    req = urllib.request.Request(url=url, data=data, method=method.upper(), headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            content_type = (resp.headers.get("content-type") or "").lower()
            if "application/json" in content_type and raw.strip():
                return resp.status, json.loads(raw)
            return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(raw) if raw.strip().startswith("{") else raw
        except Exception:
            return e.code, raw


def _health_ok(base_url: str) -> bool:
    status, data = _json_request("GET", f"{base_url.rstrip('/')}/health", payload=None)
    return status == 200 and isinstance(data, dict) and data.get("status") == "ok"


def _pick_base_url() -> str:
    env = (os.environ.get("API_BASE_URL") or "").strip()
    if env:
        return env.rstrip("/")

    # Prefer the fullstack dev server (Vite) proxy when running locally.
    candidates = ["http://localhost:5173/api", "http://localhost:8000/api"]
    for c in candidates:
        try:
            if _health_ok(c):
                return c
        except Exception:
            continue

    # Fallback to the first candidate; the user can override with API_BASE_URL.
    return candidates[0]


def _today_iso() -> str:
    return _dt.date.today().isoformat()


def _parse_date_iso(raw: str) -> str:
    s = str(raw or "").strip()
    if not s:
        return ""
    # Accept ISO already
    try:
        if len(s) >= 10 and s[4] == "-" and s[7] == "-":
            _dt.date.fromisoformat(s[:10])
            return s[:10]
    except Exception:
        pass

    # FR format dd/mm/yyyy
    try:
        if "/" in s:
            dd, mm, yyyy = s.split("/", 2)
            d = _dt.date(int(yyyy), int(mm), int(dd))
            return d.isoformat()
    except Exception:
        pass
    return ""


def _warranty_plus_years(years: int = 3, *, from_date_iso: Optional[str] = None) -> str:
    d = _dt.date.today()
    base = str(from_date_iso or "").strip()
    if base:
        try:
            d = _dt.date.fromisoformat(base)
        except Exception:
            pass
    try:
        return d.replace(year=d.year + years).isoformat()
    except ValueError:
        # Feb 29th edge case
        return (d + _dt.timedelta(days=365 * years)).isoformat()


def _master_printers() -> List[Dict[str, Any]]:
    """Exact list provided by the user.

    Mapping notes:
    - Printer name -> assetTag
    - SN -> serialNumber
    - Site/Location -> site
    - Area -> area
    - Responsable -> pilote (extended stock field)
    - System -> description
    - Code -> barcode (extended stock field)
    - Status "New" -> condition "New" and status "Available" (selectable)
    - Date -> acquisitionDate and dateIn when relevant
    """

    def hp_prma(*, assetTag: str, model: str, serialNumber: str, ipAddress: str, area: str, site: str) -> Dict[str, Any]:
        acq = _today_iso()
        warranty = _warranty_plus_years(3, from_date_iso=acq)
        return {
            "assetTag": assetTag,
            "serialNumber": serialNumber,
            "ipAddress": ipAddress,
            "area": area,
            "model": model,
            "type": "HP",
            "category": "Printer",
            "supplier": "HP",
            "site": site,
            "status": "Available",
            "condition": "New",
            "warrantyEndDate": warranty,
            "acquisitionDate": acq,
            "value": 0.0,
        }

    def zebra(*, serialNumber: str, code: str, date_fr: str, responsable: str, site: str, system: str) -> Dict[str, Any]:
        acq = _parse_date_iso(date_fr) or _today_iso()
        warranty = _warranty_plus_years(3, from_date_iso=acq)
        # Keep a stable unique assetTag that doesn't collide (code can repeat).
        tag = f"SN-{serialNumber}"
        return {
            "assetTag": tag,
            "serialNumber": serialNumber,
            "area": None,
            "model": "ZEBRA ZT421",
            "type": "ZEBRA",
            "category": "Printer",
            "supplier": "ZEBRA",
            "site": site,
            "status": "Available",
            "condition": "New",
            "acquisitionDate": acq,
            "warrantyEndDate": warranty,
            "value": 0.0,
            "barcode": code,
            "pilote": responsable,
            "description": f"System: {system}",
            "stockIn": "Yes",
            "dateIn": acq,
        }

    def shredder(*, serialNumber: str, date_fr: str, responsable: str, site: str) -> Dict[str, Any]:
        acq = _parse_date_iso(date_fr) or _today_iso()
        warranty = _warranty_plus_years(3, from_date_iso=acq)
        tag = f"SN-{serialNumber}"
        return {
            "assetTag": tag,
            "serialNumber": serialNumber,
            "model": "HP Pro Shredder",
            "type": "HP",
            "category": "Printer",
            "supplier": "HP",
            "site": site,
            "status": "Available",
            "condition": "New",
            "acquisitionDate": acq,
            "warrantyEndDate": warranty,
            "value": 0.0,
            "pilote": responsable,
            "description": "Imported from master list (treated as Printer per user request)",
            "stockIn": "Yes",
            "dateIn": acq,
        }

    return [
        hp_prma(
            assetTag="PRMA6010",
            model="HP Color LaserJet MFP E78523",
            serialNumber="CZBBT7Z0QH",
            ipAddress="10.57.134.10",
            area="Open_Space",
            site="MA6",
        ),
        hp_prma(
            assetTag="PRMA6011",
            model="HP Color LaserJet MFP X58045",
            serialNumber="CZBBT80078",
            ipAddress="10.57.134.11",
            area="Open_Space",
            site="MA6",
        ),
        hp_prma(
            assetTag="PRMA6013",
            model="HP Color LaserJet MFP E78523",
            serialNumber="CZBBT7Z0QL",
            ipAddress="10.57.134.13",
            area="bureau Maintenance",
            site="MA6",
        ),
        hp_prma(
            assetTag="PRMA6014",
            model="HP Color LaserJet MFP X58045",
            serialNumber="CZBBT80003",
            ipAddress="10.57.134.14",
            area="bureau logistique",
            site="MA6",
        ),
        hp_prma(
            assetTag="PRMA6016",
            model="HP Color LaserJet MFP E78523",
            serialNumber="CZBBT720QJ",
            ipAddress="10.57.134.16",
            area="Open_Space",
            site="MA6",
        ),
        zebra(
            serialNumber="99J251701862",
            code="70076",
            date_fr="12/11/2025",
            responsable="SABIR",
            site="AS2",
            system="C-NEO",
        ),
        zebra(
            serialNumber="99J251701860",
            code="70076",
            date_fr="12/11/2025",
            responsable="SABIR",
            site="AS2",
            system="C-NEO",
        ),
        zebra(
            serialNumber="99J251701858",
            code="70076",
            date_fr="12/11/2025",
            responsable="SABIR",
            site="AS2",
            system="C-NEO",
        ),
        shredder(
            serialNumber="21010352",
            date_fr="17/09/2025",
            responsable="SABIR",
            site="AS2",
        ),
    ]


def _short_err(data: Any) -> str:
    if isinstance(data, dict):
        detail = data.get("detail")
        if isinstance(detail, str):
            return detail
        return json.dumps(data, ensure_ascii=False)
    return str(data).strip()

def upsert_printers(base_url: str, printers: Iterable[Dict[str, Any]]) -> int:
    created = 0
    updated = 0
    skipped = 0
    failed = 0

    status, assets = _json_request("GET", f"{base_url.rstrip('/')}/assets?limit=10000")
    if status != 200 or not isinstance(assets, list):
        print(f"[WARN] Unable to list existing assets: HTTP {status}: {_short_err(assets)}")
        assets = []

    by_tag: Dict[str, Dict[str, Any]] = {}
    by_sn: Dict[str, Dict[str, Any]] = {}
    for a in assets:
        if not isinstance(a, dict):
            continue
        t = str(a.get("assetTag") or "").strip().lower()
        s = str(a.get("serialNumber") or "").strip().lower()
        if t:
            by_tag[t] = a
        if s:
            by_sn[s] = a

    def _find_existing(pr: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        t = str(pr.get("assetTag") or "").strip().lower()
        s = str(pr.get("serialNumber") or "").strip().lower()
        return by_tag.get(t) or by_sn.get(s)

    def _can_recreate_identity(pr: Dict[str, Any]) -> bool:
        # Only allow recreate for items without existing relationships.
        # We keep this conservative and limited to the few printer items we manage here.
        desired_tag = str(pr.get("assetTag") or "").strip().upper()
        return desired_tag.startswith("SN-")

    for pr in printers:
        asset_tag = str(pr.get("assetTag") or "").strip()
        serial = str(pr.get("serialNumber") or "").strip()
        if not asset_tag or not serial:
            print("[SKIP] Missing assetTag/serialNumber")
            skipped += 1
            continue

        # Try create first
        st, data = _json_request("POST", f"{base_url.rstrip('/')}/assets", payload=pr)
        if st in (200, 201):
            print(f"[OK] Created {asset_tag}")
            created += 1
            continue

        if st != 409:
            print(f"[ERR] {asset_tag}: HTTP {st}: {_short_err(data)}")
            failed += 1
            continue

        # Exists -> patch (or recreate if identity is wrong)
        existing = _find_existing(pr)
        asset_id = str((existing or {}).get("id") or "").strip()
        if not asset_id:
            print(f"[SKIP] Exists but cannot resolve id for PATCH: {asset_tag}")
            skipped += 1
            continue

        existing_tag = str((existing or {}).get("assetTag") or "").strip()
        if existing_tag and existing_tag != asset_tag and _can_recreate_identity(pr):
            desired_tag_key = asset_tag.strip().lower()
            occupied = by_tag.get(desired_tag_key)
            if occupied and str(occupied.get("id") or "").strip() != asset_id:
                print(f"[SKIP] Cannot recreate {asset_tag}: desired assetTag already used")
                skipped += 1
                continue

            # Delete the wrong-identity record then recreate with the desired tag.
            dst, ddata = _json_request("DELETE", f"{base_url.rstrip('/')}/assets/{asset_id}")
            if dst != 200:
                print(f"[ERR] DELETE {existing_tag} (id={asset_id}): HTTP {dst}: {_short_err(ddata)}")
                failed += 1
                continue

            cst, cdata = _json_request("POST", f"{base_url.rstrip('/')}/assets", payload=pr)
            if cst in (200, 201):
                print(f"[OK] Recreated {asset_tag} (was {existing_tag})")
                created += 1
                # refresh local caches
                if isinstance(cdata, dict):
                    by_tag[asset_tag.strip().lower()] = cdata
                    by_sn[serial.strip().lower()] = cdata
                continue
            print(f"[ERR] Recreate {asset_tag}: HTTP {cst}: {_short_err(cdata)}")
            failed += 1
            continue

        patch = dict(pr)
        patch.pop("id", None)
        patch.pop("assetTag", None)
        patch.pop("serialNumber", None)

        pst, pdata = _json_request("PATCH", f"{base_url.rstrip('/')}/assets/{asset_id}", payload=patch)
        if pst == 200:
            print(f"[OK] Updated {asset_tag}")
            updated += 1
        else:
            print(f"[ERR] PATCH {asset_tag}: HTTP {pst}: {_short_err(pdata)}")
            failed += 1

    print(f"\nDone. created={created} updated={updated} skipped={skipped} failed={failed}")
    return 0


def main() -> int:
    base_url = _pick_base_url()
    print(f"Using API base URL: {base_url}")

    try:
        status, health = _json_request("GET", f"{base_url.rstrip('/')}/health", payload=None)
        if status != 200 or not isinstance(health, dict) or health.get("status") != "ok":
            print("[WARN] /health did not return ok; the API may be down or base URL is wrong.")
        else:
            storage = str(health.get("storage") or "").strip().lower()
            if storage == "inmemory":
                print(
                    "[WARN] API storage is 'inmemory'. Imported assets will NOT persist after a restart. "
                    "If you want persistence, start the SQL Server backend (task: 'Init DB + Run Fullstack (SQL Server)') "
                    "then re-run this script."
                )
    except Exception as e:
        print(f"[WARN] Cannot reach /health: {e}")

    printers = _master_printers()
    return upsert_printers(base_url, printers)


if __name__ == "__main__":
    raise SystemExit(main())
