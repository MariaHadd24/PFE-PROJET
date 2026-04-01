from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Force SQL Server mode for this script.
os.environ.setdefault("PFE_STORAGE", "sqlserver")

from app.sqlserver import connect  # noqa: E402
from app.cisco import infer_cisco_network_device_type  # noqa: E402


def main() -> int:
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, model, description, category, supplier, [type] FROM dbo.assets"
        )
        rows = cur.fetchall()

        updated = 0
        skipped = 0

        for (asset_id, model, description, category, supplier, current_type) in rows:
            existing = str(current_type or "").strip()
            if existing:
                skipped += 1
                continue

            inferred = infer_cisco_network_device_type(
                model=model,
                description=description,
                category=category,
                supplier=supplier,
                current_type=current_type,
            )
            if not inferred:
                skipped += 1
                continue

            cur.execute(
                "UPDATE dbo.assets SET [type] = ? WHERE id = ?",
                (inferred, str(asset_id)),
            )
            updated += 1

        conn.commit()

    print(f"Updated Cisco types: {updated}")
    print(f"Skipped: {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
