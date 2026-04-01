from __future__ import annotations

import os
import sys
from datetime import date
from pathlib import Path

# Ensure `backend/` is importable when running from `backend/scripts/`.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.sqlserver import connect


def main() -> int:
    # Force SQL Server mode for this script
    os.environ.setdefault("PFE_STORAGE", "sqlserver")

    with connect() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT TOP (1) id, site, category FROM dbo.assets WHERE status = ? AND category IN (?, ?)",
            ("Available", "Workstation", "Notebook"),
        )
        row = cur.fetchone()
        if not row:
            print("No available Workstation/Notebook asset found.")
            return 2
        asset_id, site, category = row[0], row[1], row[2]

    payload = {
        "id": None,
        "assetId": str(asset_id),
        "userName": "Test User",
        "username": "test.user",
        "department": "IT",
        "site": str(site or "Unknown"),
        "startDate": date.today().isoformat(),
        "status": "Active",
        "device_category": "Workstation" if str(category) == "Workstation" else "Notebook",
    }

    # Import after env is set
    from app import models
    from app.storage import DB

    validated = models.AssignmentCreate.model_validate(payload)
    data = validated.model_dump()
    item_id = data.pop("id", None)

    def builder(new_id: str):
        return models.Assignment(**{"id": new_id, **data})

    try:
        created = DB.assignments.create(item_id, builder)
        print("CREATED", created.model_dump())
        return 0
    except Exception as e:
        print("ERROR_TYPE", type(e))
        print("ERROR", repr(e))
        print("ERROR_STR", str(e))
        raise


if __name__ == "__main__":
    raise SystemExit(main())
