from __future__ import annotations

import os
from typing import Optional

import pyodbc


def build_connection_string(server_override: Optional[str] = None) -> str:
    driver = os.getenv("SQLSERVER_DRIVER")
    if not driver:
        available = set(pyodbc.drivers())
        for candidate in (
            "ODBC Driver 18 for SQL Server",
            "ODBC Driver 17 for SQL Server",
            "ODBC Driver 13 for SQL Server",
        ):
            if candidate in available:
                driver = candidate
                break
        driver = driver or "ODBC Driver 17 for SQL Server"
    server = server_override or os.getenv("SQLSERVER_SERVER", r".\\SQLEXPRESS")
    database = os.getenv("SQLSERVER_DATABASE", "PFE_PROJET")

    # Auth: default to Windows integrated auth
    user = os.getenv("SQLSERVER_USER")
    password = os.getenv("SQLSERVER_PASSWORD")

    encrypt = os.getenv("SQLSERVER_ENCRYPT", "yes")
    trust_server_certificate = os.getenv("SQLSERVER_TRUST_SERVER_CERTIFICATE", "yes")

    parts = [
        f"DRIVER={{{driver}}}",
        f"SERVER={server}",
        f"DATABASE={database}",
    ]

    if user:
        parts.append(f"UID={user}")
        parts.append(f"PWD={password or ''}")
    else:
        parts.append("Trusted_Connection=yes")

    # Helps local dev on SQL Express
    parts.append(f"Encrypt={encrypt}")
    parts.append(f"TrustServerCertificate={trust_server_certificate}")

    return ";".join(parts) + ";"


def connect(connection_string: Optional[str] = None) -> pyodbc.Connection:
    explicit = connection_string or os.getenv("SQLSERVER_CONNECTION_STRING")
    if explicit:
        return pyodbc.connect(explicit)

    # If the user provided a server explicitly, try it first, then a couple of
    # local-protocol fallbacks that often work when instance resolution (SQL Browser)
    # is disabled.
    #
    # Dev ergonomics: if the configured server is unreachable (common when a
    # machine-specific .env.sqlserver is copied to another PC), fall back to
    # common local instance candidates before giving up.
    env_server = os.getenv("SQLSERVER_SERVER")
    if env_server:
        server_candidates = [env_server]

        normalized = env_server.lower().replace("/", "\\")
        if normalized.endswith("\\sqlexpress"):
            server_candidates.append(r"np:\\.\pipe\MSSQL$SQLEXPRESS\sql\query")

        if normalized in (".", "localhost", "127.0.0.1"):
            server_candidates.append(r"np:\\.\pipe\sql\query")

        last_error: Optional[Exception] = None
        for server in server_candidates:
            try:
                return pyodbc.connect(build_connection_string(server_override=server))
            except Exception as e:
                last_error = e
                continue

        # If an explicit server was set but failed, attempt common local fallbacks.
        # This keeps dev scripts working even with a stale SQLSERVER_SERVER value.
        local_candidates = [
            r".\\SQLEXPRESS",
            r"localhost\\SQLEXPRESS",
            r"127.0.0.1\\SQLEXPRESS",
            r"(local)\\SQLEXPRESS",
            r"(localdb)\\MSSQLLocalDB",
            r".",
            r"localhost",
        ]

        tried = {c.lower() for c in server_candidates}
        for server in local_candidates:
            if server.lower() in tried:
                continue
            try:
                return pyodbc.connect(build_connection_string(server_override=server))
            except Exception as e:
                last_error = e
                continue

        raise last_error  # type: ignore[misc]

    # Common local aliases for SQL Express / local instances.
    candidates = [
        r".\\SQLEXPRESS",
        r"localhost\\SQLEXPRESS",
        r"127.0.0.1\\SQLEXPRESS",
        r"(local)\\SQLEXPRESS",
        r"(localdb)\\MSSQLLocalDB",
        r".",
        r"localhost",
    ]

    last_error: Optional[Exception] = None
    for server in candidates:
        try:
            return pyodbc.connect(build_connection_string(server_override=server))
        except Exception as e:
            last_error = e
            continue

    raise last_error  # type: ignore[misc]
