from __future__ import annotations

import re
from typing import Optional


_RE_CISCO_PREFIX = re.compile(r"^c(91|92|93|94|95|96|98|83|82)", re.IGNORECASE)
_RE_WORD_WLC = re.compile(r"\bwlc\b", re.IGNORECASE)


def _clean(s: object) -> str:
    return str(s or "").strip()


def infer_cisco_network_device_type(
    *,
    model: object = None,
    description: object = None,
    category: object = None,
    supplier: object = None,
    current_type: object = None,
) -> str:
    """Infer Cisco network device type.

    Returns one of: "Router", "Switch", "Access Point", "Wireless Controller" or "".
    If current_type is already set, it is returned unchanged.
    """

    existing = _clean(current_type)
    if existing:
        return existing

    m = _clean(model)
    d = _clean(description)
    c = _clean(category)
    s = _clean(supplier)

    hay = f"{m} {d} {c} {s}".lower().strip()
    if not hay:
        return ""

    looks_cisco = (
        "cisco" in hay
        or bool(_RE_CISCO_PREFIX.search(m))
        or "air-" in hay
        or "catalyst" in hay
    )
    if not looks_cisco:
        return ""

    # Wireless Controllers
    if (
        "wireless controller" in hay
        or bool(_RE_WORD_WLC.search(hay))
        or "c9800" in hay
        or "c9800-" in hay
    ):
        return "Wireless Controller"

    # Access Points
    if (
        "access point" in hay
        or "air-" in hay
        or re.search(r"\bc91\d{2}\b", hay)
        or re.search(r"\bc91\d{2}[a-z0-9-]*\b", hay)
    ):
        return "Access Point"

    # Routers
    if (
        "router" in hay
        or re.search(r"\bc83\d{2}\b", hay)
        or re.search(r"\bc82\d{2}\b", hay)
        or re.search(r"\bisr\b", hay)
        or re.search(r"\basr\b", hay)
    ):
        return "Router"

    # Switches
    if (
        "switch" in hay
        or re.search(r"\bc(?:9200|9300|9400|9500|9600)[a-z0-9-]*\b", hay)
        or re.search(r"\bc(?:2960|3560|3650|3750|3850)[a-z0-9-]*\b", hay)
    ):
        return "Switch"

    return ""


def enrich_asset_payload_with_cisco_type(data: dict) -> dict:
    """If `type` is missing/blank and asset looks Cisco, set inferred `type`."""

    if not isinstance(data, dict):
        return data

    inferred = infer_cisco_network_device_type(
        model=data.get("model"),
        description=data.get("description"),
        category=data.get("category"),
        supplier=data.get("supplier"),
        current_type=data.get("type"),
    )

    if inferred and not _clean(data.get("type")):
        out = dict(data)
        out["type"] = inferred
        return out

    return data
