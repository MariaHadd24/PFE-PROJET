from __future__ import annotations

import os
import sys
from pathlib import Path
import traceback

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Force SQL Server mode for this script.
os.environ.setdefault("PFE_STORAGE", "sqlserver")

from app.sqlserver import connect
from app.storage import DB
from app import models


def main() -> int:
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT TOP (1) id FROM dbo.assets WHERE status = ? AND category IN (?, ?)",
            ("Available", "Workstation", "Notebook"),
        )
        row = cur.fetchone()
        if not row:
            print("No available asset found")
            return 2
        asset_id = str(row[0])

    asset = DB.assets.get(asset_id)
    if asset is None:
        print("Asset not found via repo", asset_id)
        print("Repo type:", type(DB.assets).__name__)
        return 3

    def set_status(new_status: models.AssetStatus):
        def updater(current: models.Asset):
            data = current.model_dump()
            data["status"] = new_status
            return models.Asset(**data)

        DB.assets.update(asset_id, updater)

    try:
        print("Updating", asset_id, "Available -> Assigned")
        set_status("Assigned")
        print("OK")
    except Exception as e:
        print("UPDATE_FAILED", type(e), repr(e))
        raise

    try:
        print("Reverting", asset_id, "Assigned -> Available")
        set_status("Available")
        print("OK")
    except Exception as e:
        print("REVERT_FAILED", type(e), repr(e))
        print(traceback.format_exc())
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
