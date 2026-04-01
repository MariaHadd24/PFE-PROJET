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
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='assets'"
    )
    cols = [str(r[0]) for r in cur.fetchall()]
    low = {c.lower() for c in cols}

    need = [
        "description",
        "ipAddress",
        "bci",
        "bce",
        "bciCheck",
        "barcode",
        "qrCode",
        "storeLocation",
        "area",
        "department",
        "condition",
        "cabinet",
        "rack",
        "level",
        "vnc",
        "stockIn",
        "dateIn",
        "pilote",
        "stockOut",
        "dateOut",
        "immoNumber",
        "pilote1",
        "comment",
        "deviceProfile",
    ]

    print(f"assets_columns={len(cols)}")
    for n in need:
        print(f"has_{n}={n.lower() in low}")

    for n in [
        "bci",
        "bce",
        "bciCheck",
        "barcode",
        "storeLocation",
        "description",
        "ipAddress",
        "area",
        "department",
        "condition",
    ]:
        if n.lower() not in low:
            print(f"count_{n}=N/A")
            continue
        cur.execute(
            "SELECT COUNT(1) FROM dbo.assets "
            f"WHERE [{n}] IS NOT NULL AND LTRIM(RTRIM(CONVERT(nvarchar(max),[{n}])))<>''"
        )
        print(f"count_{n}={cur.fetchone()[0]}")

    cn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
