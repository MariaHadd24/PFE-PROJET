from __future__ import annotations

import base64
import hashlib
import hmac
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class PasswordHash:
    scheme: str
    iterations: int
    salt_b64: str
    digest_b64: str

    def format(self) -> str:
        return f"{self.scheme}${self.iterations}${self.salt_b64}${self.digest_b64}"


_SCHEME = "pbkdf2_sha256"
_DEFAULT_ITERATIONS = 310_000


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64d(s: str) -> bytes:
    padded = s + "=" * ((4 - (len(s) % 4)) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def hash_password(password: str, *, iterations: int = _DEFAULT_ITERATIONS) -> str:
    pwd = (password or "").encode("utf-8")
    if not pwd:
        raise ValueError("password_empty")

    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", pwd, salt, int(iterations))
    ph = PasswordHash(
        scheme=_SCHEME,
        iterations=int(iterations),
        salt_b64=_b64e(salt),
        digest_b64=_b64e(dk),
    )
    return ph.format()


def parse_password_hash(stored: str) -> PasswordHash | None:
    raw = (stored or "").strip()
    if not raw:
        return None

    parts = raw.split("$")
    if len(parts) != 4:
        return None

    scheme, iters, salt_b64, digest_b64 = parts
    if scheme != _SCHEME:
        return None

    try:
        iterations = int(iters)
        if iterations <= 0:
            return None
    except Exception:
        return None

    # Basic sanity for base64 payloads.
    if not salt_b64 or not digest_b64:
        return None

    return PasswordHash(scheme=scheme, iterations=iterations, salt_b64=salt_b64, digest_b64=digest_b64)


def verify_password(password: str, stored: str) -> bool:
    parsed = parse_password_hash(stored)
    if parsed is None:
        return False

    try:
        salt = _b64d(parsed.salt_b64)
        expected = _b64d(parsed.digest_b64)
    except Exception:
        return False

    pwd = (password or "").encode("utf-8")
    dk = hashlib.pbkdf2_hmac("sha256", pwd, salt, parsed.iterations)
    return hmac.compare_digest(dk, expected)
