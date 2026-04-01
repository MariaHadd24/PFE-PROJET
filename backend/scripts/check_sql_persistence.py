import os
import sys
from pathlib import Path


def load_env_file(path: Path) -> None:
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ[key] = value


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    backend_dir = repo_root / "backend"

    env_path = backend_dir / ".env.sqlserver"
    if not env_path.exists():
        print(f"Missing env file: {env_path}")
        return 2

    load_env_file(env_path)

    sys.path.insert(0, str(backend_dir))

    try:
        from app.sqlserver import connect
    except Exception as e:
        print(f"Failed to import app.sqlserver: {e}")
        return 3

    cn = connect()
    cur = cn.cursor()

    checks = [
        ("assignments", "asn-e2e-001"),
        ("maintenance_tickets", "mt-e2e-001"),
        ("vendors", "ven-e2e-002"),
    ]

    ok = True
    for table, id_ in checks:
        cur.execute(f"SELECT COUNT(1) FROM dbo.[{table}] WHERE [id]=?", (id_,))
        n = cur.fetchone()[0]
        print(f"{table} {id_}: {n}")
        ok = ok and (n == 1)

    cn.close()

    if ok:
        print("OK")
        return 0

    print("Missing rows: at least one COUNT != 1")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
