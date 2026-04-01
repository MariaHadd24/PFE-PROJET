from __future__ import annotations

import argparse
import json
import os
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

import httpx


class _OAuthHandler(BaseHTTPRequestHandler):
    server_version = "PFEGmailOAuth/1.0"

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        code = (qs.get("code") or [""])[0]
        error = (qs.get("error") or [""])[0]

        if error:
            self.server.code = None  # type: ignore[attr-defined]
            self.server.error = error  # type: ignore[attr-defined]
            self.send_response(400)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(f"OAuth error: {error}\n".encode("utf-8"))
            return

        if code:
            self.server.code = code  # type: ignore[attr-defined]
            self.server.error = None  # type: ignore[attr-defined]
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"OK. You can close this tab and return to the terminal.\n")
            return

        self.send_response(400)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"Missing code parameter.\n")

    def log_message(self, fmt: str, *args) -> None:
        # Keep terminal clean.
        return


def _env(name: str) -> str:
    return str(os.getenv(name, "")).strip()


def _load_client_from_json(path: str) -> tuple[str, str]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Google downloads wrap under installed/web.
    container = data.get("installed") or data.get("web") or {}
    client_id = str(container.get("client_id") or "").strip()
    client_secret = str(container.get("client_secret") or "").strip()
    if not client_id or not client_secret:
        raise ValueError("client_id/client_secret not found in credentials JSON")
    return client_id, client_secret


def _exchange_code_for_tokens(*, code: str, client_id: str, client_secret: str, redirect_uri: str) -> dict:
    token_uri = _env("PFE_GMAIL_TOKEN_URI") or "https://oauth2.googleapis.com/token"
    data = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }

    with httpx.Client(timeout=20) as client:
        resp = client.post(token_uri, data=data)
        resp.raise_for_status()
        return resp.json()


def main() -> int:
    parser = argparse.ArgumentParser(description="Obtain Gmail API refresh token (local redirect)")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument(
        "--credentials-json",
        dest="credentials_json",
        default=_env("PFE_GMAIL_CREDENTIALS_JSON"),
        help="Path to Google OAuth credentials JSON downloaded from Google Cloud",
    )
    parser.add_argument(
        "--from",
        dest="from_addr",
        default=_env("PFE_GMAIL_FROM"),
        help="Sender Gmail address (used later for sending)",
    )
    args = parser.parse_args()

    if not args.credentials_json or not os.path.exists(args.credentials_json):
        print("Missing credentials JSON. Provide --credentials-json <path> or set PFE_GMAIL_CREDENTIALS_JSON")
        return 2

    client_id, client_secret = _load_client_from_json(args.credentials_json)

    redirect_uri = f"http://127.0.0.1:{args.port}/callback"
    scope = "https://www.googleapis.com/auth/gmail.send"

    auth_params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scope,
        "access_type": "offline",
        "prompt": "consent",
    }
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(auth_params)

    httpd: HTTPServer = HTTPServer(("127.0.0.1", args.port), _OAuthHandler)
    httpd.code = None  # type: ignore[attr-defined]
    httpd.error = None  # type: ignore[attr-defined]

    def serve() -> None:
        httpd.handle_request()

    t = threading.Thread(target=serve, daemon=True)
    t.start()

    print("Open this URL in your browser and authorize the app:")
    print(auth_url)
    print("\nWaiting for redirect...")

    deadline = time.time() + 180
    while time.time() < deadline and getattr(httpd, "code", None) is None and getattr(httpd, "error", None) is None:
        time.sleep(0.2)

    code = getattr(httpd, "code", None)
    err = getattr(httpd, "error", None)

    if err:
        print("OAuth error:", err)
        return 1

    if not code:
        print("Timed out waiting for OAuth redirect. Try again or choose a different --port.")
        return 1

    try:
        tokens = _exchange_code_for_tokens(
            code=code,
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri,
        )
    except Exception as e:
        print("Token exchange failed:", repr(e))
        return 1

    refresh_token = str(tokens.get("refresh_token") or "").strip()
    if not refresh_token:
        print("No refresh_token returned. Ensure you used access_type=offline and prompt=consent, and you are not reusing an old consent.")
        return 1

    print("\nSUCCESS")
    print("Set these env vars (do NOT commit them):")
    print('  PFE_EMAIL_PROVIDER="gmail"')
    print(f'  PFE_GMAIL_CLIENT_ID="{client_id}"')
    print(f'  PFE_GMAIL_CLIENT_SECRET="{client_secret}"')
    print(f'  PFE_GMAIL_REFRESH_TOKEN="{refresh_token}"')
    if args.from_addr:
        print(f'  PFE_GMAIL_FROM="{args.from_addr}"')
    else:
        print('  PFE_GMAIL_FROM="<your-gmail-address>"')

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
