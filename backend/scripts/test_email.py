from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import smtplib
from email.message import EmailMessage

# Allow running from either repo root or backend/.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.emailer import is_configured, send_email


def _debug_attempt_send(*, to_addr: str, subject: str, text: str) -> bool:
    try:
        from app import emailer

        safe_cfg = emailer.get_effective_config_safe()
        print("debug email config:", safe_cfg)

        provider = str(safe_cfg.get("provider") or "smtp")
        if provider == "graph":
            ok = emailer.send_email(to=to_addr, subject=subject, text=text)
            if not ok:
                raise RuntimeError("Graph send failed (check tenant/app permissions and admin consent)")
            return True
        if provider == "gmail":
            try:
                ok = emailer.send_email(to=to_addr, subject=subject, text=text)
                if not ok:
                    print("debug gmail error: L'envoi a échoué (voir logs backend/app/emailer.py pour plus de détails). Mauvais refresh_token, quota, ou problème d'API possible.")
                return ok
            except Exception as e:
                print("debug gmail exception:", repr(e))
                return False
        # SMTP fallback debug (manual flow to surface auth/TLS errors).
        cfg = emailer._get_smtp_config()  # type: ignore[attr-defined]
        msg = EmailMessage()
        msg["From"] = cfg.get("from")
        msg["To"] = to_addr
        msg["Subject"] = subject
        msg.set_content(text)
        timeout_s = 10
        if cfg.get("ssl"):
            server: smtplib.SMTP = smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=timeout_s)
        else:
            server = smtplib.SMTP(cfg["host"], cfg["port"], timeout=timeout_s)
        try:
            server.set_debuglevel(0)
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
    except Exception as e:
        print("debug smtp error:", repr(e))
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Send a test email using PFE_SMTP_* env vars")
    parser.add_argument("--to", dest="to", default=os.getenv("PFE_SMTP_TEST_TO") or "")
    parser.add_argument("--subject", dest="subject", default="PFE Project - SMTP test")
    parser.add_argument(
        "--text",
        dest="text",
        default="This is a test email sent by the PFE backend SMTP helper.",
    )
    parser.add_argument("--debug", action="store_true", help="Print SMTP diagnostics if sending fails")
    args = parser.parse_args()

    if not is_configured():
        print("SMTP is not configured. Set PFE_SMTP_HOST/PFE_SMTP_USER/PFE_SMTP_PASSWORD (and optionally PFE_SMTP_FROM).")
        return 2

    to_addr = (args.to or os.getenv("PFE_SMTP_USER") or "").strip()
    if not to_addr:
        print("Missing recipient: pass --to or set PFE_SMTP_TEST_TO")
        return 2

    ok = send_email(to=to_addr, subject=args.subject, text=args.text)
    if not ok and args.debug:
        ok = _debug_attempt_send(to_addr=to_addr, subject=args.subject, text=args.text)
    print("sent" if ok else "failed")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
