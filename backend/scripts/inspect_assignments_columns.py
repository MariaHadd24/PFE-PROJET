from __future__ import annotations

import os
import sys
from pathlib import Path


def load_env_file(path: Path) -> None:
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ[k.strip()] = v.strip()


def main() -> int:
    backend_dir = Path(__file__).resolve().parents[1]
    env_path = backend_dir / ".env.sqlserver"
    if env_path.exists():
        load_env_file(env_path)

    sys.path.insert(0, str(backend_dir))

    from app.sqlserver import connect

    cn = connect()
    cur = cn.cursor()

    cur.execute(
        "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE "
        "FROM INFORMATION_SCHEMA.COLUMNS "
        "WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='assignments' "
        "ORDER BY ORDINAL_POSITION"
    )
    rows = cur.fetchall()
    if not rows:
        print("assignments: MISSING TABLE")
        return 2

    cols = [str(r[0]) for r in rows]
    low = {c.lower() for c in cols}

    print(f"assignments_columns={len(cols)}")
    for name, dtype, nullable in rows:
        print(f"- {name} {dtype} nullable={nullable}")

    need = [
        "id",
        "assetId",
        "userName",
        "department",
        "site",
        "startDate",
        "returnDate",
        "status",
        "approvedBy",
        "device_category",
    ]
    for n in need:
        print(f"has_{n}={n.lower() in low}")

    cn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
