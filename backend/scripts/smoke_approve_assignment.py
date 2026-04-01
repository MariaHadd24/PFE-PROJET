from __future__ import annotations

import datetime
import os

import httpx


def main() -> None:
    port = (
        os.environ.get("PFE_BACKEND_PORT")
        or os.environ.get("VITE_BACKEND_PORT")
        or os.environ.get("BACKEND_PORT")
        or "8001"
    )
    base = f"http://127.0.0.1:{port}"
    today = str(datetime.date.today())

    def must_json(res: httpx.Response, label: str):
        try:
            return res.json()
        except Exception:
            raise SystemExit(f"{label} failed: HTTP {res.status_code} {res.text[:500]}")

    assets_res = httpx.get(f"{base}/assets?limit=10000", timeout=30)
    assets = must_json(assets_res, "list assets") or []

    created = None
    last_error = None
    for asset in assets:
        if str(asset.get("status") or "") != "Available":
            continue
        asset_id = str(asset.get("id") or "").strip()
        if not asset_id:
            continue

        payload = {
            "assetId": asset_id,
            "userName": "Smoke Test",
            "department": str(asset.get("department") or "IT"),
            "site": str(asset.get("site") or "Unknown"),
            "startDate": today,
            "status": "Pending",
        }

        create_res = httpx.post(f"{base}/assignments", json=payload, timeout=15)
        a = must_json(create_res, "create assignment")
        if "id" in a:
            created = a
            break
        last_error = a

    if not created:
        raise SystemExit(f"create assignment failed: {last_error}")

    # Approve via password signing
    demo_signature = (
        "data:image/svg+xml;utf8,"
        "<svg xmlns='http://www.w3.org/2000/svg' width='200' height='60'>"
        "<path d='M10,40C40,10,80,70,120,30S190,40,190,40' stroke='black' stroke-width='3' fill='none'/>"
        "</svg>"
    )

    approve = {"email": "admin@leoni.example", "password": "123456", "signatureData": demo_signature}
    approve_res = httpx.post(f"{base}/assignments/{created['id']}/approve", json=approve, timeout=15)
    r = must_json(approve_res, "approve")
    if "status" not in r:
        raise SystemExit(f"approve failed: {r}")

    print("created:", created.get("id"), created.get("status"), created.get("assetId"))
    print("approved:", r.get("id"), r.get("status"), r.get("approvedBy"), r.get("approvalSignature"))


if __name__ == "__main__":
    main()
