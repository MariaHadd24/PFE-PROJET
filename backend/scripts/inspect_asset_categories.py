from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path


def main() -> int:
    backend_dir = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(backend_dir))

    from app.sqlserver import connect

    cn = connect()
    cur = cn.cursor()
    cur.execute("SELECT category FROM dbo.assets")
    rows = cur.fetchall()
    cn.close()

    cats = [str(r[0]).strip() for r in rows if r and r[0] is not None]
    counts = Counter(cats)

    print(f"unique_categories={len(counts)}")
    for cat, c in counts.most_common(100):
        print(f"{c:4}  {cat}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
