from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Iterable, List


def load_env_file(path: Path) -> None:
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ[key] = value


_GO_RE = re.compile(r"(?im)^\s*GO\s*$")


def _split_sql(sql_text: str) -> List[str]:
    text = sql_text.replace("\ufeff", "")
    # Split on GO (common in SQL Server scripts)
    parts = _GO_RE.split(text)
    statements: List[str] = []

    for part in parts:
        chunk = part.strip()
        if not chunk:
            continue

        # Most of our schema file is safe to split on ';'
        for stmt in chunk.split(";"):
            s = stmt.strip()
            if not s:
                continue
            statements.append(s)

    return statements


def _escape_db_name(db: str) -> str:
    # Used in CREATE DATABASE [name]
    return db.replace("]", "]] ")


def _is_already_exists_error(err: Exception) -> bool:
    msg = str(err).lower()
    return (
        "there is already an object named" in msg
        or "already exists" in msg
        or "cannot create" in msg and "because it already exists" in msg
        or "violation of primary key" in msg
    )


def _print_counts(connect, tables: Iterable[str]) -> None:
    try:
        cn = connect()
        cur = cn.cursor()
        for t in tables:
            cur.execute(f"SELECT COUNT(1) FROM dbo.[{t}]")
            n = cur.fetchone()[0]
            print(f"{t}: {n}")
        cn.close()
    except Exception as e:
        print(f"(counts skipped) {type(e).__name__}: {e}")

def _ensure_assets_extended_columns(connect) -> None:
    """Ensure dbo.assets has the extended Stock Inventory columns.

    The schema file uses CREATE TABLE and will be skipped if the table exists,
    so we apply additive ALTER TABLE migrations here.
    """

    columns = [
        ("ipAddress", "NVARCHAR(50) NULL"),
        ("area", "NVARCHAR(200) NULL"),
        ("department", "NVARCHAR(200) NULL"),
        ("condition", "NVARCHAR(50) NULL"),
        ("description", "NVARCHAR(MAX) NULL"),
        ("bci", "NVARCHAR(100) NULL"),
        ("bce", "NVARCHAR(100) NULL"),
        ("bciCheck", "NVARCHAR(100) NULL"),
        ("vnc", "NVARCHAR(100) NULL"),
        ("stockIn", "NVARCHAR(20) NULL"),
        ("dateIn", "DATE NULL"),
        ("pilote", "NVARCHAR(200) NULL"),
        ("stockOut", "NVARCHAR(20) NULL"),
        ("dateOut", "DATE NULL"),
        ("immoNumber", "NVARCHAR(100) NULL"),
        ("pilote1", "NVARCHAR(200) NULL"),
        ("comment", "NVARCHAR(MAX) NULL"),
        ("barcode", "NVARCHAR(100) NULL"),
        ("qrCode", "NVARCHAR(100) NULL"),
        ("storeLocation", "NVARCHAR(200) NULL"),
        ("cabinet", "NVARCHAR(200) NULL"),
        ("rack", "NVARCHAR(200) NULL"),
        ("level", "NVARCHAR(50) NULL"),
    ]

    cn = connect()
    cur = cn.cursor()

    cur.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='assets'",
    )
    existing = {str(r[0]).lower() for r in cur.fetchall()}

    added = 0
    for name, ddl in columns:
        if name.lower() in existing:
            continue
        cur.execute(f"ALTER TABLE dbo.assets ADD [{name}] {ddl}")
        cn.commit()
        added += 1

    cn.close()
    if added:
        print(f"Assets migration: {added} column(s) added")


def _ensure_users_password_hash_column(connect) -> None:
    """Ensure dbo.users has passwordHash column (additive migration)."""

    cn = connect()
    cur = cn.cursor()
    cur.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='users'",
    )
    existing = {str(r[0]).lower() for r in cur.fetchall()}

    if "passwordhash" not in existing:
        cur.execute("ALTER TABLE dbo.users ADD [passwordHash] NVARCHAR(512) NULL")
        cn.commit()
        print("Users migration: passwordHash column added")

    cn.close()


def _ensure_users_signature_number_column(connect) -> None:
    """Ensure dbo.users has signatureNumber column (additive migration)."""

    cn = connect()
    cur = cn.cursor()
    cur.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='users'",
    )
    existing = {str(r[0]).lower() for r in cur.fetchall()}

    if "signaturenumber" not in existing:
        cur.execute("ALTER TABLE dbo.users ADD [signatureNumber] NVARCHAR(20) NULL")
        cn.commit()
        print("Users migration: signatureNumber column added")

    if "signaturedata" not in existing:
        cur.execute("ALTER TABLE dbo.users ADD [signatureData] NVARCHAR(MAX) NULL")
        cn.commit()
        print("Users migration: signatureData column added")

    cn.close()


def _ensure_sites_extended_columns(connect) -> None:
    """Ensure dbo.sites has optional zone/city/codeIt columns (additive migration)."""

    columns = [
        ("codeIt", "NVARCHAR(50) NULL"),
        ("zone", "NVARCHAR(200) NULL"),
        ("city", "NVARCHAR(200) NULL"),
    ]

    cn = connect()
    cur = cn.cursor()
    cur.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='sites'",
    )
    existing = {str(r[0]).lower() for r in cur.fetchall()}

    added = 0
    for name, ddl in columns:
        if name.lower() in existing:
            continue
        cur.execute(f"ALTER TABLE dbo.sites ADD [{name}] {ddl}")
        cn.commit()
        added += 1

    cn.close()
    if added:
        print(f"Sites migration: {added} column(s) added")


def _ensure_assignments_extended_columns(connect) -> None:
    """Ensure dbo.assignments supports Printer assignments + approval workflow.

    - Adds nullable [area] column (additive).
    - Adds approval metadata columns: [approvedAt], [approvalSignature] (additive).
    - Updates CK_assignments_device_category to include 'Printer'.
    - Updates CK_assignments_status to include 'Pending'.
    """

    cn = connect()
    cur = cn.cursor()

    cur.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='assignments'",
    )
    existing = {str(r[0]).lower() for r in cur.fetchall()}

    if "area" not in existing:
        cur.execute("ALTER TABLE dbo.assignments ADD [area] NVARCHAR(200) NULL")
        cn.commit()
        print("Assignments migration: area column added")

    if "approvedby" not in existing:
        cur.execute("ALTER TABLE dbo.assignments ADD [approvedBy] NVARCHAR(200) NULL")
        cn.commit()
        print("Assignments migration: approvedBy column added")

    if "approvedat" not in existing:
        cur.execute("ALTER TABLE dbo.assignments ADD [approvedAt] DATETIME2(0) NULL")
        cn.commit()
        print("Assignments migration: approvedAt column added")

    if "approvalsignature" not in existing:
        cur.execute("ALTER TABLE dbo.assignments ADD [approvalSignature] NVARCHAR(MAX) NULL")
        cn.commit()
        print("Assignments migration: approvalSignature column added")
    else:
        # Ensure approvalSignature can store image data URLs.
        try:
            cur.execute(
                "SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='assignments' AND COLUMN_NAME='approvalSignature'"
            )
            row = cur.fetchone()
            if row:
                data_type = str(row[0] or "").lower()
                max_len = row[1]
                # NVARCHAR(MAX) reports -1 in INFORMATION_SCHEMA.
                if data_type == "nvarchar" and max_len != -1:
                    cur.execute("ALTER TABLE dbo.assignments ALTER COLUMN [approvalSignature] NVARCHAR(MAX) NULL")
                    cn.commit()
                    print("Assignments migration: approvalSignature widened to NVARCHAR(MAX)")
        except Exception as e:
            print(f"Assignments migration (approvalSignature widen) skipped: {type(e).__name__}: {e}")

    # Ensure the status check constraint includes Pending.
    try:
        cur.execute(
            "SELECT name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.assignments') AND name = 'CK_assignments_status'"
        )
        row = cur.fetchone()
        if row:
            cur.execute("ALTER TABLE dbo.assignments DROP CONSTRAINT CK_assignments_status")
            cn.commit()

        cur.execute(
            "ALTER TABLE dbo.assignments ADD CONSTRAINT CK_assignments_status "
            "CHECK (status IN ('Pending','Active','Returned'))"
        )
        cn.commit()
        print("Assignments migration: CK_assignments_status updated")
    except Exception as e:
        print(f"Assignments migration (status constraint) skipped: {type(e).__name__}: {e}")

    # Ensure the device_category check constraint allows Printer.
    try:
        cur.execute(
            "SELECT name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.assignments') AND name = 'CK_assignments_device_category'"
        )
        row = cur.fetchone()
        if row:
            cur.execute("ALTER TABLE dbo.assignments DROP CONSTRAINT CK_assignments_device_category")
            cn.commit()

        cur.execute(
            "ALTER TABLE dbo.assignments ADD CONSTRAINT CK_assignments_device_category "
            "CHECK (device_category IS NULL OR device_category IN ('Workstation','Notebook','Printer'))"
        )
        cn.commit()
        print("Assignments migration: CK_assignments_device_category updated")
    except Exception as e:
        # Constraint changes may fail if the table/constraint doesn't exist yet; keep init resilient.
        print(f"Assignments migration (constraint) skipped: {type(e).__name__}: {e}")

    cn.close()


def _ensure_printer_toner_incidents_raw_columns(connect) -> None:
    """Ensure dbo.printer_toner_incidents stores full Excel rows.

    Adds:
    - raw NVARCHAR(MAX) NULL (JSON object: header->value)
    - rawHeaders NVARCHAR(MAX) NULL (JSON array: header order)
    """

    cn = connect()
    cur = cn.cursor()

    try:
        cur.execute(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='printer_toner_incidents'",
        )
        existing = {str(r[0]).lower() for r in cur.fetchall()}
    except Exception as e:
        cn.close()
        print(f"Printer toner incidents migration skipped: {type(e).__name__}: {e}")
        return

    if "raw" not in existing:
        cur.execute("ALTER TABLE dbo.printer_toner_incidents ADD [raw] NVARCHAR(MAX) NULL")
        cn.commit()
        print("Printer toner incidents migration: raw column added")

    if "rawheaders" not in existing:
        cur.execute("ALTER TABLE dbo.printer_toner_incidents ADD [rawHeaders] NVARCHAR(MAX) NULL")
        cn.commit()
        print("Printer toner incidents migration: rawHeaders column added")

    # Ensure JSON check constraints exist (best-effort)
    try:
        cur.execute(
            "SELECT name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.printer_toner_incidents') AND name = 'CK_printer_toner_incidents_raw_json'"
        )
        if cur.fetchone() is None:
            cur.execute(
                "ALTER TABLE dbo.printer_toner_incidents ADD CONSTRAINT CK_printer_toner_incidents_raw_json "
                "CHECK ([raw] IS NULL OR ISJSON([raw]) = 1)"
            )
            cn.commit()
            print("Printer toner incidents migration: raw JSON constraint added")
    except Exception as e:
        print(f"Printer toner incidents migration (raw constraint) skipped: {type(e).__name__}: {e}")

    try:
        cur.execute(
            "SELECT name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.printer_toner_incidents') AND name = 'CK_printer_toner_incidents_rawHeaders_json'"
        )
        if cur.fetchone() is None:
            cur.execute(
                "ALTER TABLE dbo.printer_toner_incidents ADD CONSTRAINT CK_printer_toner_incidents_rawHeaders_json "
                "CHECK ([rawHeaders] IS NULL OR ISJSON([rawHeaders]) = 1)"
            )
            cn.commit()
            print("Printer toner incidents migration: rawHeaders JSON constraint added")
    except Exception as e:
        print(f"Printer toner incidents migration (rawHeaders constraint) skipped: {type(e).__name__}: {e}")

    cn.close()


def _ensure_printer_toner_incidents_status_column(connect) -> None:
    """Ensure dbo.printer_toner_incidents has a status column.

    Adds:
    - status NVARCHAR(20) NOT NULL DEFAULT 'NON_INTERVENUE'
    And a check constraint restricting values.
    """

    cn = connect()
    cur = cn.cursor()

    try:
        cur.execute(
            "SELECT COLUMN_NAME, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='printer_toner_incidents'",
        )
        cols = {str(r[0]).lower(): str(r[1]).upper() for r in cur.fetchall()}
    except Exception as e:
        cn.close()
        print(f"Printer toner incidents status migration skipped: {type(e).__name__}: {e}")
        return

    if "status" not in cols:
        cur.execute(
            "ALTER TABLE dbo.printer_toner_incidents ADD [status] NVARCHAR(20) NOT NULL "
            "CONSTRAINT DF_printer_toner_incidents_status DEFAULT ('NON_INTERVENUE')"
        )
        cn.commit()
        print("Printer toner incidents migration: status column added")
    else:
        # Ensure existing NULLs are backfilled, and make it NOT NULL if needed.
        try:
            cur.execute(
                "UPDATE dbo.printer_toner_incidents SET [status] = 'NON_INTERVENUE' WHERE [status] IS NULL"
            )
            cn.commit()
        except Exception:
            pass

        if cols.get("status") == "YES":
            try:
                cur.execute("ALTER TABLE dbo.printer_toner_incidents ALTER COLUMN [status] NVARCHAR(20) NOT NULL")
                cn.commit()
                print("Printer toner incidents migration: status set to NOT NULL")
            except Exception as e:
                print(f"Printer toner incidents migration (status not null) skipped: {type(e).__name__}: {e}")

    # Ensure check constraint exists (best-effort)
    try:
        cur.execute(
            "SELECT name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.printer_toner_incidents') AND name = 'CK_printer_toner_incidents_status'"
        )
        if cur.fetchone() is None:
            cur.execute(
                "ALTER TABLE dbo.printer_toner_incidents ADD CONSTRAINT CK_printer_toner_incidents_status "
                "CHECK ([status] IN ('NON_INTERVENUE','INTERVENUE'))"
            )
            cn.commit()
            print("Printer toner incidents migration: status check constraint added")
    except Exception as e:
        print(f"Printer toner incidents migration (status constraint) skipped: {type(e).__name__}: {e}")

    cn.close()


def _ensure_printer_toner_incidents_datetime_columns(connect) -> None:
    """Ensure claimDate/interventionDate store date+time.

    Updates:
    - claimDate DATE -> DATETIME2(0)
    - interventionDate DATE -> DATETIME2(0)

    Existing DATE values are kept (time becomes 00:00).
    """

    cn = connect()
    cur = cn.cursor()

    try:
        cur.execute(
            "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='printer_toner_incidents' "
            "AND COLUMN_NAME IN ('claimDate','interventionDate')"
        )
        cols = {str(r[0]): str(r[1]).lower() for r in cur.fetchall()}
    except Exception as e:
        cn.close()
        print(f"Printer toner incidents datetime migration skipped: {type(e).__name__}: {e}")
        return

    def ensure_dt(col: str) -> None:
        dtype = cols.get(col)
        if not dtype:
            return
        if dtype == "date":
            try:
                cur.execute(f"ALTER TABLE dbo.printer_toner_incidents ALTER COLUMN [{col}] DATETIME2(0) NULL")
                cn.commit()
                print(f"Printer toner incidents migration: {col} altered to DATETIME2")
            except Exception as e:
                # If an index depends on the column, drop/recreate it.
                msg = str(e)
                if col == "claimDate" and ("dependent on column" in msg.lower() or "alter table alter column" in msg.lower()):
                    try:
                        cur.execute(
                            "IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.printer_toner_incidents') AND name = 'IX_printer_toner_incidents_claimDate') "
                            "DROP INDEX IX_printer_toner_incidents_claimDate ON dbo.printer_toner_incidents"
                        )
                        cn.commit()
                        cur.execute(
                            "ALTER TABLE dbo.printer_toner_incidents ALTER COLUMN [claimDate] DATETIME2(0) NULL"
                        )
                        cn.commit()
                        cur.execute(
                            "CREATE INDEX IX_printer_toner_incidents_claimDate ON dbo.printer_toner_incidents(claimDate)"
                        )
                        cn.commit()
                        print("Printer toner incidents migration: claimDate altered to DATETIME2 (index rebuilt)")
                        return
                    except Exception as e2:
                        print(
                            f"Printer toner incidents migration (claimDate rebuild) skipped: {type(e2).__name__}: {e2}"
                        )
                        return

                print(f"Printer toner incidents migration ({col}) skipped: {type(e).__name__}: {e}")

    ensure_dt("claimDate")
    ensure_dt("interventionDate")

    cn.close()

def main() -> int:
    backend_dir = Path(__file__).resolve().parents[1]
    repo_root = backend_dir.parent

    env_path = backend_dir / ".env.sqlserver"
    if env_path.exists():
        load_env_file(env_path)

    # Ensure SQL Server mode for seed_data
    os.environ["PFE_STORAGE"] = (os.environ.get("PFE_STORAGE") or "sqlserver")

    target_db = (os.environ.get("SQLSERVER_DATABASE") or "PFE_PROJET").strip() or "PFE_PROJET"

    sys.path.insert(0, str(backend_dir))

    try:
        from app.sqlserver import connect
    except Exception as e:
        print(f"Failed to import app.sqlserver: {e}")
        return 3

    # 1) Create database if missing (connect to master)
    prev_db = os.environ.get("SQLSERVER_DATABASE")
    os.environ["SQLSERVER_DATABASE"] = "master"

    try:
        cn = connect()
        cn.autocommit = True
        cur = cn.cursor()
        safe_db = target_db.replace("'", "''")
        cur.execute(
            "DECLARE @db sysname = N'"
            + safe_db
            + "';\n"
            + "IF DB_ID(@db) IS NULL\n"
            + "BEGIN\n"
            + "  DECLARE @sql nvarchar(max) = N'CREATE DATABASE ' + QUOTENAME(@db);\n"
            + "  EXEC(@sql);\n"
            + "END"
        )
        cn.close()
        print(f"Database ensured: {target_db}")
    except Exception as e:
        print(f"Failed to create/ensure database '{target_db}': {type(e).__name__}: {e}")
        return 4
    finally:
        if prev_db is not None:
            os.environ["SQLSERVER_DATABASE"] = prev_db
        else:
            os.environ["SQLSERVER_DATABASE"] = target_db

    # 2) Execute schema
    schema_path = repo_root / "database" / "sqlserver_schema.sql"
    if not schema_path.exists():
        print(f"Schema file not found: {schema_path}")
        return 2

    schema_sql = schema_path.read_text(encoding="utf-8")
    statements = _split_sql(schema_sql)
    if not statements:
        print("No SQL statements found in schema")
        return 2

    try:
        cn = connect()
        cur = cn.cursor()
        applied = 0
        skipped = 0
        for stmt in statements:
            try:
                cur.execute(stmt)
                cn.commit()
                applied += 1
            except Exception as e:
                if _is_already_exists_error(e):
                    skipped += 1
                    continue
                raise
        cn.close()
        print(f"Schema applied. Statements: {applied} applied, {skipped} skipped")
    except Exception as e:
        print(f"Failed to apply schema: {type(e).__name__}: {e}")
        return 5

    # 2b) Additive migrations for existing databases
    try:
        _ensure_assets_extended_columns(connect)
    except Exception as e:
        print(f"Assets migration failed: {type(e).__name__}: {e}")
        return 5

    try:
        _ensure_users_password_hash_column(connect)
    except Exception as e:
        print(f"Users migration failed: {type(e).__name__}: {e}")
        return 5

    try:
        _ensure_users_signature_number_column(connect)
    except Exception as e:
        print(f"Users migration (signatureNumber) failed: {type(e).__name__}: {e}")
        return 5

    try:
        _ensure_sites_extended_columns(connect)
    except Exception as e:
        print(f"Sites migration failed: {type(e).__name__}: {e}")
        return 5

    try:
        _ensure_assignments_extended_columns(connect)
    except Exception as e:
        print(f"Assignments migration failed: {type(e).__name__}: {e}")
        return 5

    try:
        _ensure_printer_toner_incidents_raw_columns(connect)
    except Exception as e:
        print(f"Printer toner incidents migration failed: {type(e).__name__}: {e}")
        return 5

    try:
        _ensure_printer_toner_incidents_status_column(connect)
    except Exception as e:
        print(f"Printer toner incidents status migration failed: {type(e).__name__}: {e}")
        return 5

    try:
        _ensure_printer_toner_incidents_datetime_columns(connect)
    except Exception as e:
        print(f"Printer toner incidents datetime migration failed: {type(e).__name__}: {e}")
        return 5
    # 3) Seed data (inserts demo data into SQL tables)
    try:
        from app.seed import seed_data

        seed_data()
        print("Seed complete")
    except Exception as e:
        print(f"Seed failed: {type(e).__name__}: {e}")
        return 6

    _print_counts(
        connect,
        tables=(
            "departments",
            "sites",
            "categories",
            "suppliers",
            "users",
            "assets",
            "stock_movements",
            "assignments",
            "maintenance_tickets",
            "audit_logs",
            "vendors",
            "printer_toner_incidents",
            "printer_toner_entries",
            "printer_toner_exits",
            "printer_toner_min_qty",
        ),
    )

    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
