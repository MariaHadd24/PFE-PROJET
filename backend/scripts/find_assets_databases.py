from __future__ import annotations

import os
import sys
from pathlib import Path


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ[key.strip()] = value.strip().strip('"').strip("'")


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    backend_dir = repo_root / "backend"

    env_path = backend_dir / ".env.sqlserver"
    if not env_path.exists():
        print(f"Missing env file: {env_path}")
        return 2

    load_env_file(env_path)

    # Ensure we can import app.*
    sys.path.insert(0, str(backend_dir))

    from app.sqlserver import connect  # noqa: E402

    # Enumerate DBs from master
    os.environ["SQLSERVER_DATABASE"] = "master"

    cn = connect()
    cn.autocommit = True
    cur = cn.cursor()

    cur.execute("SELECT name FROM sys.databases WHERE state_desc='ONLINE' ORDER BY name")
    dbs = [r[0] for r in cur.fetchall()]

    results: list[tuple[str, int]] = []
    for db in dbs:
        if db in {"master", "tempdb", "model", "msdb"}:
            continue
        try:
            cur.execute(f"SELECT COUNT(1) FROM [{db}].sys.tables WHERE name='assets'")
            has_assets = int(cur.fetchone()[0])
            if not has_assets:
                continue

            cur.execute(f"SELECT COUNT(1) FROM [{db}].dbo.assets")
            n = int(cur.fetchone()[0])
            results.append((db, n))
        except Exception:
            # Ignore DBs we cannot access or that don't have dbo.assets.
            continue

    cn.close()

    if not results:
        print("No user databases with dbo.assets found")
        return 0

    for db, n in sorted(results, key=lambda x: x[1], reverse=True):
        print(f"{db}: assets={n}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
