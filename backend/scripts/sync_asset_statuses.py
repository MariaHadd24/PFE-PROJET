from __future__ import annotations

import os
import sys
from pathlib import Path

# Ensure `backend/` is importable when running from `backend/scripts/`.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ[k.strip()] = v.strip()


def main() -> int:
    # Force SQL Server mode for this script
    os.environ.setdefault("PFE_STORAGE", "sqlserver")

    env_path = BACKEND_ROOT / ".env.sqlserver"
    load_env_file(env_path)

    from app.seed import sync_asset_statuses_from_assignments

    sync_asset_statuses_from_assignments()
    print("ok: synced asset statuses from assignments")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
