from __future__ import annotations

import base64
import os
import smtplib
from email.message import EmailMessage
from typing import Optional

import httpx


def _env_bool(name: str, default: bool = False) -> bool:
    raw = str(os.getenv(name, "")).strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "y", "on"}


def _env_str(name: str) -> str:
    return str(os.getenv(name, "")).strip()


def _env_choice(name: str, default: str, allowed: set[str]) -> str:
    raw = _env_str(name).lower()
    if not raw:
        return default
    return raw if raw in allowed else default


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii")


def _get_smtp_config() -> dict:
    host = _env_str("PFE_SMTP_HOST")
    port_raw = _env_str("PFE_SMTP_PORT")
    user = _env_str("PFE_SMTP_USER")
    password = _env_str("PFE_SMTP_PASSWORD")
    from_addr = _env_str("PFE_SMTP_FROM") or user

    if not host or not from_addr:
        return {"enabled": False}

    try:
        port = int(port_raw) if port_raw else 587
    except ValueError:
        port = 587

    use_tls = _env_bool("PFE_SMTP_TLS", True)
    use_ssl = _env_bool("PFE_SMTP_SSL", False)

    return {
        "enabled": True,
        "provider": "smtp",
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "from": from_addr,
        "tls": use_tls,
        "ssl": use_ssl,
    }


def _get_graph_config() -> dict:
    # Microsoft Graph (application permissions) using client credentials.
    tenant_id = _env_str("PFE_GRAPH_TENANT_ID")
    client_id = _env_str("PFE_GRAPH_CLIENT_ID")
    client_secret = _env_str("PFE_GRAPH_CLIENT_SECRET")
    from_addr = _env_str("PFE_GRAPH_FROM")

    if not tenant_id or not client_id or not client_secret or not from_addr:
        return {"enabled": False, "provider": "graph"}

    # Accept common tenant keywords (e.g. "common" / "organizations" / "consumers")
    # but in practice application permissions require an org tenant.
    return {
        "enabled": True,
        "provider": "graph",
        "tenant_id": tenant_id,
        "client_id": client_id,
        "client_secret": client_secret,
        "from": from_addr,
    }


def _get_gmail_config() -> dict:
    # Gmail API via OAuth (refresh token).
    # Works well for consumer Gmail accounts without needing Azure/M365.
    client_id = _env_str("PFE_GMAIL_CLIENT_ID")
    client_secret = _env_str("PFE_GMAIL_CLIENT_SECRET")
    refresh_token = _env_str("PFE_GMAIL_REFRESH_TOKEN")
    from_addr = _env_str("PFE_GMAIL_FROM")

    if not client_id or not client_secret or not refresh_token or not from_addr:
        return {"enabled": False, "provider": "gmail"}

    token_uri = _env_str("PFE_GMAIL_TOKEN_URI") or "https://oauth2.googleapis.com/token"
    return {
        "enabled": True,
        "provider": "gmail",
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "from": from_addr,
        "token_uri": token_uri,
    }


def _get_provider() -> str:
    return _env_choice("PFE_EMAIL_PROVIDER", "smtp", {"smtp", "graph", "gmail"})


def get_effective_config_safe() -> dict:
    """Return the currently-selected provider configuration without secrets."""

    provider = _get_provider()
    if provider == "graph":
        cfg = _get_graph_config()
    elif provider == "gmail":
        cfg = _get_gmail_config()
    else:
        cfg = _get_smtp_config()

    return {k: v for k, v in cfg.items() if k not in {"password", "client_secret", "refresh_token"}}


def is_configured() -> bool:
    provider = _get_provider()
    if provider == "graph":
        cfg = _get_graph_config()
    elif provider == "gmail":
        cfg = _get_gmail_config()
    else:
        cfg = _get_smtp_config()
    return bool(cfg.get("enabled"))


def _graph_get_token(cfg: dict, timeout_s: int) -> Optional[str]:
    tenant_id = cfg.get("tenant_id")
    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"

    data = {
        "client_id": cfg.get("client_id"),
        "client_secret": cfg.get("client_secret"),
        "grant_type": "client_credentials",
        "scope": "https://graph.microsoft.com/.default",
    }

    try:
        with httpx.Client(timeout=timeout_s) as client:
            resp = client.post(token_url, data=data)
            resp.raise_for_status()
            payload = resp.json()
            return str(payload.get("access_token") or "") or None
    except Exception:
        return None


def _send_email_graph(*, to: str, subject: str, text: str, timeout_s: int = 8) -> bool:
    cfg = _get_graph_config()
    if not cfg.get("enabled"):
        return False

    to_addr = str(to or "").strip()
    if not to_addr or "@" not in to_addr:
        return False

    token = _graph_get_token(cfg, timeout_s)
    if not token:
        return False

    from_addr = str(cfg.get("from") or "").strip()
    if not from_addr:
        return False

    url = f"https://graph.microsoft.com/v1.0/users/{from_addr}/sendMail"
    payload = {
        "message": {
            "subject": str(subject or "").strip()[:200] or "Notification",
            "body": {"contentType": "Text", "content": str(text or "")},
            "toRecipients": [{"emailAddress": {"address": to_addr}}],
        },
        "saveToSentItems": True,
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=timeout_s) as client:
            resp = client.post(url, json=payload, headers=headers)
            # Graph returns 202 Accepted on success.
            if resp.status_code in (200, 202):
                return True
            return False
    except Exception:
        return False


def _gmail_refresh_access_token(cfg: dict, timeout_s: int) -> Optional[str]:
    token_uri = str(cfg.get("token_uri") or "https://oauth2.googleapis.com/token").strip()
    data = {
        "client_id": cfg.get("client_id"),
        "client_secret": cfg.get("client_secret"),
        "refresh_token": cfg.get("refresh_token"),
        "grant_type": "refresh_token",
    }

    try:
        with httpx.Client(timeout=timeout_s) as client:
            resp = client.post(token_uri, data=data)
            resp.raise_for_status()
            payload = resp.json()
            return str(payload.get("access_token") or "") or None
    except Exception:
        return None


def _send_email_gmail(*, to: str, subject: str, text: str, timeout_s: int = 8) -> bool:
    cfg = _get_gmail_config()
    if not cfg.get("enabled"):
        return False

    to_addr = str(to or "").strip()
    if not to_addr or "@" not in to_addr:
        return False

    from_addr = str(cfg.get("from") or "").strip()
    if not from_addr or "@" not in from_addr:
        return False

    token = _gmail_refresh_access_token(cfg, timeout_s)
    if not token:
        return False

    msg = EmailMessage()
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg["Subject"] = str(subject or "").strip()[:200] or "Notification"
    msg.set_content(str(text or "").strip() or "")

    raw = _b64url(msg.as_bytes())
    url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"raw": raw}

    try:
        with httpx.Client(timeout=timeout_s) as client:
            resp = client.post(url, json=payload, headers=headers)
            return resp.status_code in (200, 202)
    except Exception:
        return False


def send_email(*, to: str, subject: str, text: str, timeout_s: int = 5) -> bool:
    provider = _get_provider()
    if provider == "graph":
        return _send_email_graph(to=to, subject=subject, text=text, timeout_s=max(8, timeout_s))
    if provider == "gmail":
        return _send_email_gmail(to=to, subject=subject, text=text, timeout_s=max(8, timeout_s))

    cfg = _get_smtp_config()
    if not cfg.get("enabled"):
        return False

    to_addr = str(to or "").strip()
    if not to_addr or "@" not in to_addr:
        return False

    msg = EmailMessage()
    msg["From"] = cfg["from"]
    msg["To"] = to_addr
    msg["Subject"] = str(subject or "").strip()[:200] or "Notification"
    msg.set_content(str(text or "").strip() or "")

    try:
        if cfg.get("ssl"):
            server: smtplib.SMTP = smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=timeout_s)
        else:
            server = smtplib.SMTP(cfg["host"], cfg["port"], timeout=timeout_s)

        try:
            server.ehlo()
            if cfg.get("tls") and not cfg.get("ssl"):
                server.starttls()
                server.ehlo()

            if cfg.get("user") and cfg.get("password"):
                server.login(cfg["user"], cfg["password"])

            server.send_message(msg)
            return True
        finally:
            try:
                server.quit()
            except Exception:
                pass
    except Exception:
        return False
