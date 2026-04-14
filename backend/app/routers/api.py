
from __future__ import annotations
# --- Génération PDF de confirmation pour test ---

from fastapi import APIRouter
router = APIRouter()
try:
    from reportlab.pdfgen import canvas
except ImportError:
    canvas = None
import datetime

@router.post("/generate-confirmation")
def generate_confirmation():
    if canvas is None:
        raise HTTPException(status_code=500, detail="reportlab n'est pas installé")
    pdf_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "pdfs"))
    os.makedirs(pdf_dir, exist_ok=True)
    filename = f"confirmation_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    pdf_path = os.path.join(pdf_dir, filename)

    c = canvas.Canvas(pdf_path)
    c.drawString(100, 750, "Confirmation d'opération")
    c.drawString(100, 730, f"Généré le {datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    c.save()

    return {"ok": True, "file": filename}
import os
import json
from datetime import date, datetime
from typing import Any, Literal, Optional
import re
import secrets

import asyncio

from fastapi import APIRouter, Body, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

import httpx

from app import models
from app.auth import hash_password, verify_password
from app.audit import record as audit_record
from app.cisco import enrich_asset_payload_with_cisco_type, infer_cisco_network_device_type
from app.audit import sanitize_details as audit_sanitize_details
from app.realtime import hub as realtime_hub
from app.routers.crud import register_crud_routes
from app.storage import DB



# --- PDF ROUTES ---
from fastapi import Response
PDF_DIR = os.path.join(os.path.dirname(__file__), '..', 'pdfs')
PDF_DIR = os.path.abspath(PDF_DIR)
os.makedirs(PDF_DIR, exist_ok=True)

@router.get("/pdfs")
def list_pdfs():
    files = []
    for fname in os.listdir(PDF_DIR):
        if fname.lower().endswith('.pdf'):
            fpath = os.path.join(PDF_DIR, fname)
            stat = os.stat(fpath)
            files.append({
                "file": fname,
                "size": f"{stat.st_size/1024:.1f} KB",
                "generatedBy": "unknown",  # À personnaliser si besoin
                "date": str(int(stat.st_mtime)),
            })
    files.sort(key=lambda x: x["date"], reverse=True)
    return files

@router.get("/pdfs/{filename}")
def download_pdf(filename: str):
    safe = filename.replace('..','').replace('/','')
    fpath = os.path.join(PDF_DIR, safe)
    if not os.path.isfile(fpath):
        raise HTTPException(status_code=404, detail="PDF not found")
    with open(fpath, "rb") as f:
        data = f.read()
    return Response(content=data, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={safe}"})

@router.delete("/pdfs/{filename}")
def delete_pdf(filename: str):
    safe = filename.replace('..','').replace('/','')
    fpath = os.path.join(PDF_DIR, safe)
    if not os.path.isfile(fpath):
        raise HTTPException(status_code=404, detail="PDF not found")
    os.remove(fpath)
    return {"ok": True}

@router.post("/pdfs/{filename}/send")
def send_pdf(filename: str, to: str = Body(..., embed=True)):
    # TODO: brancher sur votre système d'email réel
    # Pour l'instant, simule l'envoi
    safe = filename.replace('..','').replace('/','')
    fpath = os.path.join(PDF_DIR, safe)
    if not os.path.isfile(fpath):
        raise HTTPException(status_code=404, detail="PDF not found")
    # Ici, appeler send_email avec la pièce jointe fpath
    # send_email(to=to, subject="PDF", text="Voici votre PDF", attachment=fpath)
    return {"ok": True, "sent": True, "to": to}


def _require_admin(request: Request) -> None:
    role = (request.headers.get("x-actor-role") or "").strip()
    if role != "Admin":
        raise HTTPException(status_code=403, detail="Access denied")


def _compact_error(err: Exception) -> str:
    msg = str(err).replace("\r", " ").replace("\n", " ")
    msg = " ".join(msg.split())
    return msg[:400]


def _get_undo_target(entity: str):
    targets = {
        "Department": (DB.departments, models.Department),
        "Site": (DB.sites, models.Site),
        "Category": (DB.categories, models.Category),
        "Supplier": (DB.suppliers, models.Supplier),
        "Licence": (DB.licences, models.Licence),
        "UserDB": (DB.users, models.UserDB),
        "User": (DB.users, models.UserDB),
        "Asset": (DB.assets, models.Asset),
        "StockMovement": (DB.movements, models.StockMovement),
        "Assignment": (DB.assignments, models.Assignment),
        "PurchaseRequest": (DB.purchase_requests, models.PurchaseRequest),
        "PurchaseOrder": (DB.purchase_orders, models.PurchaseOrder),
        "MaintenanceTicket": (DB.maintenance_tickets, models.MaintenanceTicket),
        "Vendor": (DB.vendors, models.Vendor),
    }
    return targets.get(str(entity or "").strip())


_REDACTED = object()


def _is_redacted_marker(value: Any) -> bool:
    return isinstance(value, dict) and bool(value.get("redacted")) is True


def _map_redacted(value: Any) -> Any:
    if _is_redacted_marker(value):
        return _REDACTED
    if isinstance(value, dict):
        return {k: _map_redacted(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_map_redacted(v) for v in value]
    return value


def _replace_redacted_with_none(value: Any) -> Any:
    if value is _REDACTED:
        return None
    if isinstance(value, dict):
        return {k: _replace_redacted_with_none(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_replace_redacted_with_none(v) for v in value]
    return value


def _merge_snapshot_over_current(current_data: dict, snapshot_data: dict) -> dict:
    out = dict(current_data)
    for k, v in snapshot_data.items():
        if v is _REDACTED:
            continue
        out[k] = v
    return out


def _required_fields(model_cls) -> set[str]:
    req: set[str] = set()
    try:
        fields = getattr(model_cls, "model_fields", {})
        for name, field in fields.items():
            try:
                if field.is_required():
                    req.add(str(name))
            except Exception:
                # best-effort
                pass
    except Exception:
        pass
    return req


ASSIGNABLE_ASSET_CATEGORIES = {
    "workstation",
    "workstations",
    "ws",
    "notebook",
    "notebooks",
    "nb",
    "laptop",
    "computer",
    "printer",
    "printers",
}


def _ensure_asset_assignable(asset_id: str) -> None:
    asset = DB.assets.get(asset_id)
    if asset is None:
        raise HTTPException(status_code=409, detail="Asset not found")
    category_raw = (asset.category or "").strip()
    inferred = _asset_to_device_category(category_raw)
    if not inferred:
        raise HTTPException(
            status_code=409,
            detail=f"Asset category '{category_raw}' cannot be assigned (allowed: Workstation, Notebook, Printer)",
        )

    status = getattr(asset, "status", None)
    if status and status != "Available":
        raise HTTPException(
            status_code=409,
            detail=f"Asset is not available (current status: {status})",
        )

    def parse_date(value: object) -> Optional[date]:
        s = str(value or "").strip()
        if not s:
            return None
        # Accept ISO date or ISO datetime; keep only YYYY-MM-DD part.
        s = s.split("T", 1)[0].strip()
        try:
            return date.fromisoformat(s)
        except ValueError:
            m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
            if not m:
                return None
            dd, mm, yyyy = m.group(1), m.group(2), m.group(3)
            try:
                return date(int(yyyy), int(mm), int(dd))
            except ValueError:
                return None

    def cutoff_years_ago(years: int) -> date:
        today = date.today()
        try:
            return date(today.year - years, today.month, today.day)
        except ValueError:
            # Handle Feb 29
            return date(today.year - years, today.month, 28)

    # End-of-life is based on "mise en service" (Date OUT).
    in_service = parse_date(getattr(asset, "dateOut", None))
    if in_service is not None and in_service <= cutoff_years_ago(5):
        raise HTTPException(
            status_code=409,
            detail="Asset is obsolete (end-of-life > 5 years) and cannot be assigned",
        )

    # Even if the asset row is still Available, block duplicate assignment requests.
    # Pending requests should reserve the asset until approved/returned.
    if _asset_has_open_assignment(asset_id):
        raise HTTPException(status_code=409, detail="Asset already has a pending/active assignment")


def _set_asset_status(asset_id: str, status: models.AssetStatus) -> None:
    def updater(current: models.Asset):
        current_data = current.model_dump()
        current_data["status"] = status
        return models.Asset(**current_data)

    try:
        DB.assets.update(asset_id, updater)
    except KeyError as e:
        if str(e) == "'not_found'" or str(e) == "not_found":
            raise HTTPException(status_code=409, detail="Asset not found")
        raise


def _asset_has_open_assignment(asset_id: str, *, exclude_assignment_id: Optional[str] = None) -> bool:
    items = DB.assignments.list()
    for a in items:
        if exclude_assignment_id and str(a.id) == exclude_assignment_id:
            continue
        if not a.assetId:
            continue
        if str(a.assetId) != asset_id:
            continue
        if (a.status or "Pending") in ("Pending", "Active"):
            return True
    return False


def _asset_has_active_assignment(asset_id: str, *, exclude_assignment_id: Optional[str] = None) -> bool:
    items = DB.assignments.list()
    for a in items:
        if exclude_assignment_id and str(a.id) == exclude_assignment_id:
            continue
        if not a.assetId:
            continue
        if str(a.assetId) != asset_id:
            continue
        if (a.status or "Pending") == "Active":
            return True
    return False


def _sync_asset_statuses_from_assignments() -> dict:
    """Ensure assets are Assigned iff they have an Active assignment.

    Only flips between Available <-> Assigned, does not override InRepair/Retired.
    """

    active_asset_ids = {
        str(a.assetId)
        for a in DB.assignments.list()
        if a.assetId and (a.status or "Active") == "Active"
    }

    changed_to_assigned = 0
    changed_to_available = 0

    for asset in DB.assets.list():
        aid = str(asset.id)
        cur = getattr(asset, "status", None)

        # Keep special statuses intact.
        if cur in {"InRepair", "Retired"}:
            continue

        if aid in active_asset_ids:
            if cur != "Assigned":
                _set_asset_status(aid, "Assigned")
                changed_to_assigned += 1
        else:
            if cur == "Assigned":
                _set_asset_status(aid, "Available")
                changed_to_available += 1

    return {
        "ok": True,
        "active_assets": len(active_asset_ids),
        "changed_to_assigned": changed_to_assigned,
        "changed_to_available": changed_to_available,
    }


def _set_asset_date_out_if_missing(asset_id: str, value: str) -> None:
    """Best-effort: set asset.dateOut (mise en service) if it is currently empty."""

    def updater(current: models.Asset):
        current_data = current.model_dump()
        existing = str(current_data.get("dateOut") or "").strip()
        if existing:
            return current
        current_data["dateOut"] = value
        return models.Asset(**current_data)

    try:
        DB.assets.update(asset_id, updater)
    except Exception:
        pass


def _auto_retire_end_of_life_assets(items: list[models.Asset]) -> list[models.Asset]:
    """Auto-send to Retired any Available asset with dateOut older than 5 years.

    - Uses dateOut only (mise en service)
    - Skips assets with open assignments (Pending/Active)
    - Best-effort: never breaks listing
    """

    def parse_date(value: object) -> Optional[date]:
        s = str(value or "").strip()
        if not s:
            return None
        s = s.split("T", 1)[0].strip()
        try:
            return date.fromisoformat(s)
        except ValueError:
            m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
            if not m:
                return None
            dd, mm, yyyy = m.group(1), m.group(2), m.group(3)
            try:
                return date(int(yyyy), int(mm), int(dd))
            except ValueError:
                return None

    def cutoff_years_ago(years: int) -> date:
        today = date.today()
        try:
            return date(today.year - years, today.month, today.day)
        except ValueError:
            return date(today.year - years, today.month, 28)

    cutoff = cutoff_years_ago(5)

    for i, asset in enumerate(list(items)):
        try:
            cur_status = str(getattr(asset, "status", "") or "").strip()
            if cur_status == "Retired":
                continue

            # Auto-retire only for "Non assignée" assets.
            if cur_status and cur_status != "Available":
                continue

            aid = str(getattr(asset, "id", "") or "").strip()
            if not aid:
                continue

            if _asset_has_open_assignment(aid):
                continue

            in_service = parse_date(getattr(asset, "dateOut", None))
            if in_service is None:
                continue

            if in_service <= cutoff:
                def retire_updater(current: models.Asset):
                    current_data = current.model_dump()
                    current_data["status"] = "Retired"
                    return models.Asset(**current_data)

                updated = DB.assets.update(aid, retire_updater)
                items[i] = updated
        except Exception:
            continue

    return items


def _asset_to_device_category(asset_category: str) -> str:
    c = (asset_category or "").strip().lower()
    if "printer" in c or c in {"printer", "printers"}:
        return "Printer"
    if (
        "notebook" in c
        or "laptop" in c
        or c in {"notebook", "notebooks", "laptop", "nb"}
    ):
        return "Notebook"
    if (
        "workstation" in c
        or c in {"workstation", "workstations", "computer", "ws", "computer/ws", "desktop"}
    ):
        return "Workstation"
    return ""


@router.get("/health")
def health():
    raw = os.environ.get("PFE_STORAGE")
    storage_env = (raw or "").strip().lower() or "inmemory"
    return {
        "status": "ok",
        "storage": storage_env,
        "sqlserver": {
            "server": os.environ.get("SQLSERVER_SERVER"),
            "database": os.environ.get("SQLSERVER_DATABASE"),
        },
        "pid": os.getpid(),
        "repo": {
            "assets": type(DB.assets).__name__,
        },
    }


ALLOWED_NAV_LINKS = {
    "/dashboard",
    "/stock-inventory",
    "/assignments",
    "/orders",
    "/maintenance",
    "/admin",
    "/audit-logs",
    "/vendor-portal",
    "/reporting",
}


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(min_length=1, max_length=5000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    history: list[ChatHistoryItem] = Field(default_factory=list, max_length=20)


class ChatAction(BaseModel):
    label: str
    link: str


class ChatResponse(BaseModel):
    text: str
    actions: list[ChatAction] = Field(default_factory=list)
    model: Optional[str] = None


_APP_KEYWORDS_RE = re.compile(
    r"\b(stock|inventory|inventaire|assignment|affectation|assignments|orders|commande|commandes|achat|achats|pr\b|po\b|"
    r"purchase request|purchase order|maintenance|ticket|admin|administration|audit|log|logs|reporting|rapport|vendor|"
    r"fournisseur|dashboard|site|sites|category|categorie|categories|supplier|suppliers|department|departement|departments)\b",
    re.IGNORECASE,
)


def _is_app_query(message: str) -> bool:
    msg = (message or "").strip()
    if not msg:
        return True
    # If the user explicitly asks to navigate/open a page, that's app-related.
    if re.search(r"\b(ouvrir|open|aller|go to|navigate|navigation|page|module|lien|link)\b", msg, re.IGNORECASE):
        return True
    return _APP_KEYWORDS_RE.search(msg) is not None


def _build_system_prompt() -> str:
    routes = "\n".join(sorted(ALLOWED_NAV_LINKS))
    return (
        "You are a helpful assistant. You can answer general questions (general knowledge) and you also know this specific web application's modules and navigation. "
        "When the user asks a general question (not about the app), answer it directly and do NOT say 'out of scope' or 'not in our application'. "
        "Never claim access to private/company data.\n\n"
        "Language: answer in French. Keep answers concise and helpful.\n"
        "Latency constraint: respond in 1 to 3 short sentences when possible.\n\n"
        "Available modules and what they do:\n"
        "- Stock Inventory: assets list, import/export Excel, scan QR, configure low stock thresholds, views/columns\n"
        "- Assignments: create and view device assignments\n"
        "- Orders (Achats/Commandes): PR (Purchase Requests) and PO (Purchase Orders)\n"
        "- Maintenance: create and view maintenance tickets\n"
        "- Administration: users, sites, categories, suppliers, departments\n"
        "- Audit Logs: activity logs\n"
        "- Vendor Portal: vendor directory\n"
        "- Reporting: KPIs and reports\n\n"
        "Navigation rules:\n"
        "- Only include navigation actions when the user clearly wants to use the app (open a module, where to do X in the app).\n"
        "- If you suggest navigation, pick ONLY from these links exactly:\n"
        f"{routes}\n\n"
        "Output format (STRICT JSON only, no markdown, no extra text):\n"
        "- Always output JSON with a 'text' field.\n"
        "- 'actions' is optional and MUST be omitted or empty for general (non-app) questions.\n"
        '{"text":"...","actions":[{"label":"...","link":"/orders"}]}'
    )


def _build_general_system_prompt() -> str:
    return (
        "You answer the user's question using general knowledge in French. "
        "Do NOT mention the app unless the user asked about it. "
        "Never claim access to private/company data. "
        "Output STRICT JSON only: {\"text\":\"...\"}. "
        "Do not include any actions."
    )


async def _ollama_chat(ollama_url: str, timeout_s: float, req: dict) -> dict:
    timeout = httpx.Timeout(timeout_s, connect=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(f"{ollama_url}/api/chat", json=req)
        res.raise_for_status()
        return res.json()


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest = Body(...)):
    ollama_url = (os.getenv("PFE_OLLAMA_URL") or "http://127.0.0.1:11434").rstrip("/")
    model = (os.getenv("PFE_LLM_MODEL") or "llama3.2:3b").strip() or "llama3.2:3b"
    timeout_s = float(os.getenv("PFE_LLM_TIMEOUT_SECONDS") or "120")
    keep_alive = (os.getenv("PFE_LLM_KEEP_ALIVE") or "5m").strip() or "5m"
    max_tokens = int(os.getenv("PFE_LLM_MAX_TOKENS") or "160")
    max_ctx = int(os.getenv("PFE_LLM_CONTEXT") or "1024")

    is_app = _is_app_query(payload.message)

    system_prompt = _build_system_prompt()
    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    # Keep a short history to reduce tokens/latency.
    for h in payload.history[-6:]:
        messages.append({"role": h.role, "content": h.text})
    messages.append({"role": "user", "content": payload.message})

    req = {
        "model": model,
        "messages": messages,
        "stream": False,
        "format": "json",
        "keep_alive": keep_alive,
        "options": {
            "temperature": 0.2,
            "num_predict": max_tokens,
            "num_ctx": max_ctx,
        },
    }

    try:
        data = await _ollama_chat(ollama_url, timeout_s, req)
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=(
                "LLM unavailable. Start Ollama locally (default http://127.0.0.1:11434) and pull a model. "
                f"Error: {type(e).__name__}"
            ),
        )

    content = (
        (data.get("message") or {}).get("content")
        if isinstance(data, dict)
        else None
    )
    content = (content or "").strip()

    # Expect strict JSON. If parsing fails, fall back to plain text.
    text = content
    actions: list[ChatAction] = []
    if content.startswith("{"):
        try:
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                text = str(parsed.get("text") or "").strip() or text
                raw_actions = parsed.get("actions")
                if isinstance(raw_actions, list):
                    for a in raw_actions[:5]:
                        if not isinstance(a, dict):
                            continue
                        label = str(a.get("label") or "").strip()
                        link = str(a.get("link") or "").strip()
                        if not label or not link:
                            continue
                        if link not in ALLOWED_NAV_LINKS:
                            continue
                        actions.append(ChatAction(label=label, link=link))
        except Exception:
            # keep plain text
            pass

    # If this is not an app-related question, never return navigation actions.
    if not is_app:
        actions = []

    # If the model still refused a general question, retry once with a stricter general prompt.
    if (not is_app) and re.search(r"\b(out of scope|hors\s+sujet|pas dans notre application|pas dans l'application)\b", text, re.IGNORECASE):
        try:
            req2 = {
                "model": model,
                "messages": [
                    {"role": "system", "content": _build_general_system_prompt()},
                    {"role": "user", "content": payload.message},
                ],
                "stream": False,
                "format": "json",
                "keep_alive": keep_alive,
                "options": {
                    "temperature": 0.2,
                    "num_predict": max_tokens,
                    "num_ctx": max_ctx,
                },
            }
            data2 = await _ollama_chat(ollama_url, timeout_s, req2)
            content2 = ((data2.get("message") or {}).get("content") if isinstance(data2, dict) else None)
            content2 = (content2 or "").strip()
            if content2.startswith("{"):
                parsed2 = json.loads(content2)
                if isinstance(parsed2, dict):
                    text2 = str(parsed2.get("text") or "").strip()
                    if text2:
                        text = text2
        except Exception:
            pass

    if not text:
        text = "Je peux aider uniquement sur les fonctionnalités du site (Stock, Assignments, Orders, Maintenance, Admin, etc.)."

    return ChatResponse(text=text, actions=actions, model=model)


# Core entities used across the UI
register_crud_routes(
    router=router,
    repo=DB.departments,
    model=models.Department,
    create_model=models.DepartmentCreate,
    update_model=models.DepartmentUpdate,
    prefix="departments",
)

register_crud_routes(
    router=router,
    repo=DB.sites,
    model=models.Site,
    create_model=models.SiteCreate,
    update_model=models.SiteUpdate,
    prefix="sites",
)

register_crud_routes(
    router=router,
    repo=DB.categories,
    model=models.Category,
    create_model=models.CategoryCreate,
    update_model=models.CategoryUpdate,
    prefix="categories",
)

register_crud_routes(
    router=router,
    repo=DB.suppliers,
    model=models.Supplier,
    create_model=models.SupplierCreate,
    update_model=models.SupplierUpdate,
    prefix="suppliers",
)


# Printer toner / consumables
register_crud_routes(
    router=router,
    repo=DB.printer_toner_incidents,
    model=models.PrinterTonerIncident,
    create_model=models.PrinterTonerIncidentCreate,
    update_model=models.PrinterTonerIncidentUpdate,
    prefix="printer-toner-incidents",
)


def _norm_header(s: str) -> str:
    s = str(s or "").strip().lower()
    s = re.sub(r"[\s\-/\.'’]+", "_", s)
    s = re.sub(r"[^a-z0-9_]+", "", s)
    s = re.sub(r"_+", "_", s)
    return s.strip("_")


def _parse_iso_dt(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        # Keep midnight when only a date is known.
        return datetime(value.year, value.month, value.day)
    s = str(value).strip()
    if not s:
        return None
    s = s.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s)
    except Exception:
        try:
            # fallback: 'YYYY-MM-DD HH:MM'
            return datetime.fromisoformat(s.replace(" ", "T"))
        except Exception:
            # last resort: date-only
            try:
                d = date.fromisoformat(s[:10])
                return datetime(d.year, d.month, d.day)
            except Exception:
                return None


@router.post("/printer-toner-incidents/{item_id}/mark-intervened", response_model=models.PrinterTonerIncident)
def mark_printer_toner_incident_intervened(item_id: str):
    current = DB.printer_toner_incidents.get(item_id)
    if current is None:
        raise HTTPException(status_code=404, detail="incident_not_found")

    now_iso = datetime.now().replace(second=0, microsecond=0).isoformat()

    def updater(existing: models.PrinterTonerIncident) -> models.PrinterTonerIncident:
        d = existing.model_dump()
        d["status"] = "INTERVENUE"

        if not d.get("interventionDate"):
            d["interventionDate"] = now_iso

        claim = _parse_iso_dt(d.get("claimDate"))
        inter = _parse_iso_dt(d.get("interventionDate"))
        if claim and inter:
            delta_sec = (inter - claim).total_seconds()
            if delta_sec >= 0:
                hours = delta_sec / 3600.0
                d["duration"] = (f"{hours:.2f}").rstrip("0").rstrip(".")

        raw = d.get("raw")
        if raw is not None and isinstance(raw, dict):
            # Best-effort: update any matching header keys so the dynamic UI table stays accurate.
            for k in list(raw.keys()):
                nk = _norm_header(k)
                if nk in {
                    "date_dintervention_cbi",
                    "date_d_intervention_cbi",
                    "date_dintervention",
                    "date_d_intervention",
                    "date_intervention",
                }:
                    raw[k] = d.get("interventionDate")
                if nk in {
                    "duree_de_traitement_ticket",
                    "duree_de_traitement_ticket_",
                    "duree_traitement_ticket",
                    "duree_de_traitement",
                    "duree",
                }:
                    raw[k] = d.get("duration")
            d["raw"] = raw

        return models.PrinterTonerIncident(**d)

    return DB.printer_toner_incidents.update(item_id, updater)

register_crud_routes(
    router=router,
    repo=DB.printer_toner_entries,
    model=models.PrinterTonerEntry,
    create_model=models.PrinterTonerEntryCreate,
    update_model=models.PrinterTonerEntryUpdate,
    prefix="printer-toner-entries",
)

register_crud_routes(
    router=router,
    repo=DB.printer_toner_exits,
    model=models.PrinterTonerExit,
    create_model=models.PrinterTonerExitCreate,
    update_model=models.PrinterTonerExitUpdate,
    prefix="printer-toner-exits",
)

register_crud_routes(
    router=router,
    repo=DB.printer_toner_min_qty,
    model=models.PrinterTonerMinQty,
    create_model=models.PrinterTonerMinQtyCreate,
    update_model=models.PrinterTonerMinQtyUpdate,
    prefix="printer-toner-min-qty",
)


def _now_iso() -> str:
    return date.today().isoformat()


def _licence_create_hook(data: dict) -> dict:
    created_at = str(data.get("createdAt") or "").strip() or _now_iso()
    updated_at = str(data.get("updatedAt") or "").strip() or created_at
    data["createdAt"] = created_at
    data["updatedAt"] = updated_at
    return data


def _licence_patch_hook(current: Any, patch: dict) -> Any:
    current_data = current.model_dump() if hasattr(current, "model_dump") else dict(current)
    # Never override createdAt from patch; always bump updatedAt.
    patch = dict(patch)
    patch.pop("createdAt", None)
    patch["updatedAt"] = _now_iso()
    current_data.update(patch)
    return models.Licence(**current_data)


register_crud_routes(
    router=router,
    repo=DB.licences,
    model=models.Licence,
    create_model=models.LicenceCreate,
    update_model=models.LicenceUpdate,
    prefix="licences",
    create_fn=_licence_create_hook,
    patch_fn=_licence_patch_hook,
)


def _public_user(u: models.UserDB | models.User) -> models.User:
    data = u.model_dump() if hasattr(u, "model_dump") else dict(u)
    data.pop("passwordHash", None)
    data.pop("password", None)
    # Do not expose signature image data to clients.
    data.pop("signatureData", None)
    return models.User.model_validate(data)


_SIGNATURE_RE = re.compile(r"^\d{4,20}$")


def _normalize_signature_data(value: str | None) -> str | None:
    s = str(value or "").strip()
    if not s:
        return None
    # Expect an image data URL (png/jpeg/svg+xml). Keep validation lightweight.
    if not s.startswith("data:image/"):
        raise HTTPException(status_code=422, detail="signatureData must be an image data URL")
    # Prevent extremely large payloads from being stored accidentally.
    if len(s) > 200_000:
        raise HTTPException(status_code=422, detail="signatureData is too large")
    return s


def _normalize_signature_number(value: str | None) -> str | None:
    s = str(value or "").strip()
    if not s:
        return None
    if not _SIGNATURE_RE.match(s):
        raise HTTPException(status_code=422, detail="signatureNumber must be numeric (4-20 digits)")
    return s


def _generate_unique_signature_number() -> str:
    existing = set()
    try:
        for u in DB.users.list():
            sn = str(getattr(u, "signatureNumber", "") or "").strip()
            if sn:
                existing.add(sn)
    except Exception:
        existing = set()

    for _ in range(50):
        candidate = f"{secrets.randbelow(1_000_000):06d}"
        if candidate not in existing:
            return candidate

    # Extremely unlikely fallback
    return f"{secrets.randbelow(10_000_000):07d}"


@router.get("/users", response_model=list[models.User])
def list_users(limit: int = Query(default=200, ge=1, le=10000)):
    items = DB.users.list()
    return [_public_user(u) for u in items[:limit]]


@router.get("/users/{user_id}", response_model=models.User)
def get_user(user_id: str):
    item = DB.users.get(user_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Not found")
    return _public_user(item)


@router.post("/users", response_model=models.User)
def create_user(payload: dict = Body(...), request: Request = None):
    validated = models.UserCreate.model_validate(payload)
    data = validated.model_dump()
    user_id = data.pop("id", None)
    password = str(data.pop("password") or "").strip()

    if "signatureNumber" in data:
        data["signatureNumber"] = _normalize_signature_number(data.get("signatureNumber"))

    data["signatureData"] = _normalize_signature_data(data.get("signatureData"))
    if not data.get("signatureData"):
        raise HTTPException(status_code=422, detail="signatureData is required")

    if not password:
        raise HTTPException(status_code=409, detail="Password is required")

    password_hash = hash_password(password)

    def builder(new_id: str):
        return models.UserDB(**{"id": new_id, **data, "passwordHash": password_hash})

    try:
        created = DB.users.create(user_id, builder)

        if request is not None:
            audit_record(
                action="CREATE",
                entity="User",
                entity_id=str(getattr(created, "id", "") or "") or None,
                description=f"Created User {str(getattr(created, 'id', '') or '').strip()}".strip(),
                request=request,
                details={"payload": payload, "created": created},
            )

        return _public_user(created)
    except ValueError as e:
        msg = str(e)
        if msg == "already_exists":
            raise HTTPException(status_code=409, detail="Already exists")
        if msg.startswith("already_exists:"):
            raise HTTPException(status_code=409, detail=msg.split(":", 1)[1].strip() or "Already exists")
        raise


@router.patch("/users/{user_id}", response_model=models.User)
def patch_user(user_id: str, payload: dict = Body(...), request: Request = None):
    before = DB.users.get(user_id)
    if before is None:
        raise HTTPException(status_code=404, detail="Not found")

    validated = models.UserUpdate.model_validate(payload)
    patch = validated.model_dump(exclude_unset=True)
    password = str(patch.pop("password") or "").strip() if "password" in patch else ""
    next_hash = hash_password(password) if password else None

    if "signatureNumber" in patch:
        patch["signatureNumber"] = _normalize_signature_number(patch.get("signatureNumber"))

    if "signatureData" in patch:
        patch["signatureData"] = _normalize_signature_data(patch.get("signatureData"))
        if not patch.get("signatureData"):
            raise HTTPException(status_code=422, detail="signatureData cannot be empty")

    def updater(current: models.UserDB):
        cur = current.model_dump()
        cur.update(patch)
        if next_hash is not None:
            cur["passwordHash"] = next_hash
        return models.UserDB.model_validate(cur)

    try:
        updated = DB.users.update(user_id, updater)

        if request is not None:
            audit_record(
                action="UPDATE",
                entity="User",
                entity_id=str(user_id),
                description=f"Updated User {user_id}",
                request=request,
                details={
                    "before": before,
                    "patch": patch,
                    "changedPassword": bool(next_hash is not None),
                    "after": updated,
                },
            )

        return _public_user(updated)
    except KeyError as e:
        if str(e) == "'not_found'" or str(e) == "not_found":
            raise HTTPException(status_code=404, detail="Not found")
        raise
    except ValueError as e:
        msg = str(e)
        if msg == "already_exists":
            raise HTTPException(status_code=409, detail="Already exists")
        if msg.startswith("already_exists:"):
            raise HTTPException(status_code=409, detail=msg.split(":", 1)[1].strip() or "Already exists")
        raise


@router.delete("/users/{user_id}")
def delete_user(user_id: str, request: Request = None):
    before = DB.users.get(user_id)
    if before is None:
        raise HTTPException(status_code=404, detail="Not found")

    try:
        DB.users.delete(user_id)
    except KeyError as e:
        if str(e) == "'not_found'" or str(e) == "not_found":
            raise HTTPException(status_code=404, detail="Not found")
        raise

    if request is not None:
        audit_record(
            action="DELETE",
            entity="User",
            entity_id=str(user_id),
            description=f"Deleted User {user_id}",
            request=request,
            details={"before": before},
        )
    return {"ok": True}


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


@router.post("/auth/login", response_model=models.User)
def login(payload: LoginRequest):
    email_norm = (payload.email or "").strip().lower()
    users = DB.users.list()
    found = None
    for u in users:
        try:
            if str(getattr(u, "email", "") or "").strip().lower() == email_norm:
                found = u
                break
        except Exception:
            continue

    if found is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    stored = str(getattr(found, "passwordHash", "") or "")
    if not stored or not verify_password(payload.password, stored):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return _public_user(found)


class ChangePasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    currentPassword: str = Field(min_length=1, max_length=128)
    newPassword: str = Field(min_length=6, max_length=128)


@router.post("/auth/change-password")
def change_password(payload: ChangePasswordRequest, request: Request = None):
    email_norm = (payload.email or "").strip().lower()
    users = DB.users.list()
    found: models.UserDB | None = None
    for u in users:
        if str(getattr(u, "email", "") or "").strip().lower() == email_norm:
            found = u
            break

    if found is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    stored = str(getattr(found, "passwordHash", "") or "")
    if not stored or not verify_password(payload.currentPassword, stored):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    next_hash = hash_password(payload.newPassword)

    def updater(current: models.UserDB):
        d = current.model_dump()
        d["passwordHash"] = next_hash
        return models.UserDB.model_validate(d)

    updated = DB.users.update(str(getattr(found, "id")), updater)

    if request is not None:
        audit_record(
            action="UPDATE",
            entity="User",
            entity_id=str(getattr(found, "id")),
            description="Changed password",
            request=request,
            details={
                "email": str(getattr(updated, "email", "") or "").strip(),
                "changedPassword": True,
            },
        )
    return {"ok": True}


class ApproveAssignmentRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)
    signatureData: str = Field(min_length=10)


@router.post("/assignments/{item_id}/approve", response_model=models.Assignment)
def approve_assignment(item_id: str, payload: ApproveAssignmentRequest, request: Request = None):
    assignment = DB.assignments.get(item_id)
    if assignment is None:
        raise HTTPException(status_code=404, detail="Not found")

    current_status = (assignment.status or "Pending").strip()
    if current_status != "Pending":
        raise HTTPException(status_code=409, detail="Only Pending assignments can be approved")

    email_norm = (payload.email or "").strip().lower()
    users = DB.users.list()
    approver: models.UserDB | None = None
    for u in users:
        if str(getattr(u, "email", "") or "").strip().lower() == email_norm:
            approver = u  # type: ignore[assignment]
            break

    if approver is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    role = str(getattr(approver, "role", "Reader") or "Reader")
    if role not in ("Admin", "Manager"):
        raise HTTPException(status_code=403, detail="Access denied")

    stored = str(getattr(approver, "passwordHash", "") or "")
    if not stored or not verify_password(payload.password, stored):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    signature_data = str(getattr(approver, "signatureData", "") or "").strip()
    if not signature_data:
        raise HTTPException(
            status_code=422,
            detail="Your account has no signatureData. Ask an Admin to set your signature on your user profile.",
        )

    submitted_sig = _normalize_signature_data(payload.signatureData)
    if not submitted_sig:
        raise HTTPException(status_code=422, detail="signatureData is required")

    if submitted_sig != signature_data:
        raise HTTPException(status_code=401, detail="Signature mismatch")

    approved_by = (str(getattr(approver, "name", "") or "").strip() or str(getattr(approver, "email", "") or "").strip() or "Approver")
    today = date.today().isoformat()

    before = assignment

    def updater(current: models.Assignment):
        current_data = current.model_dump()
        current_data["status"] = "Active"
        current_data["approvedBy"] = approved_by
        current_data["approvedAt"] = today
        current_data["approvalSignature"] = signature_data

        # Preserve existing validation rules from patch_assignment.
        effective_device_category = (current_data.get("device_category") or "").strip()
        if effective_device_category == "Printer":
            if not current_data.get("assetId"):
                raise HTTPException(status_code=422, detail="assetId is required for Printer assignments")
            if not (current_data.get("area") or "").strip():
                raise HTTPException(status_code=422, detail="area is required for Printer assignments")

        if current_data.get("assetId"):
            asset_id = str(current_data.get("assetId"))
            if _asset_has_active_assignment(asset_id, exclude_assignment_id=str(item_id)):
                raise HTTPException(status_code=409, detail="Asset already has an active assignment")

        return models.Assignment(**current_data)

    updated = DB.assignments.update(item_id, updater)

    old_asset_id = str(before.assetId) if before.assetId is not None else ""
    new_asset_id = str(updated.assetId) if updated.assetId is not None else ""

    if old_asset_id and old_asset_id != new_asset_id:
        if not _asset_has_active_assignment(old_asset_id, exclude_assignment_id=str(updated.id)):
            _set_asset_status(old_asset_id, "Available")

    if new_asset_id:
        _set_asset_status(new_asset_id, "Assigned")
        _set_asset_date_out_if_missing(new_asset_id, today)

    if request is not None:
        audit_record(
            action="APPROVE",
            entity="Assignment",
            entity_id=str(item_id),
            description="Approved assignment",
            request=request,
            details={
                "approvedBy": approved_by,
                "approverEmail": str(getattr(approver, "email", "") or "").strip(),
                "before": before,
                "after": updated,
            },
        )

    return updated


def _enrich_asset_patch_with_cisco_type(current: models.Asset, patch: dict) -> models.Asset:
    merged = {**current.model_dump(), **(patch or {})}
    if not str(merged.get("type") or "").strip():
        inferred = infer_cisco_network_device_type(
            model=merged.get("model"),
            description=merged.get("description"),
            category=merged.get("category"),
            supplier=merged.get("supplier"),
            current_type=merged.get("type"),
        )
        if inferred:
            merged["type"] = inferred
    return models.Asset(**merged)

register_crud_routes(
    router=router,
    repo=DB.assets,
    model=models.Asset,
    create_model=models.AssetCreate,
    update_model=models.AssetUpdate,
    prefix="assets",
    create_fn=enrich_asset_payload_with_cisco_type,
    patch_fn=_enrich_asset_patch_with_cisco_type,
    list_fn=_auto_retire_end_of_life_assets,
)

register_crud_routes(
    router=router,
    repo=DB.movements,
    model=models.StockMovement,
    create_model=models.StockMovementCreate,
    update_model=models.StockMovementUpdate,
    prefix="movements",
)


@router.get("/assignments", response_model=list[models.Assignment])
def list_assignments(limit: int = Query(default=200, ge=1, le=1000)):
    items = DB.assignments.list()
    return items[:limit]


@router.delete("/assignments")
def delete_all_assignments(request: Request = None):
    items = DB.assignments.list()

    # Restore asset availability for any ACTIVE assignments before deleting.
    for item in items:
        try:
            if item.assetId and (item.status or "Active") == "Active":
                _set_asset_status(str(item.assetId), "Available")
        except HTTPException:
            # Ignore missing assets; proceed with deleting the assignment rows.
            pass

    deleted = 0
    for item in items:
        try:
            DB.assignments.delete(str(item.id))
            deleted += 1
        except KeyError:
            continue

    if request is not None:
        audit_record(
            action="DELETE",
            entity="Assignment",
            entity_id=None,
            description=f"Deleted all assignments ({deleted})",
            request=request,
            details={"deleted": deleted},
        )

    return {"ok": True, "deleted": deleted}


@router.post("/assignments", response_model=models.Assignment)
def create_assignment(payload: dict = Body(...), request: Request = None):
    validated = models.AssignmentCreate.model_validate(payload)
    data = validated.model_dump()
    item_id = data.pop("id", None)

    asset_id = data.get("assetId")
    if asset_id:
        _ensure_asset_assignable(asset_id)
    else:
        if not data.get("device_category"):
            raise HTTPException(status_code=422, detail="device_category is required when assetId is not provided")

        if (data.get("device_category") or "") == "Printer":
            raise HTTPException(status_code=422, detail="assetId is required for Printer assignments")

    if asset_id and not data.get("device_category"):
        asset = DB.assets.get(asset_id)
        if asset is not None:
            inferred = _asset_to_device_category(asset.category)
            if inferred:
                data["device_category"] = inferred

    effective_device_category = (data.get("device_category") or "").strip()

    if effective_device_category == "Printer":
        if not asset_id:
            raise HTTPException(status_code=422, detail="assetId is required for Printer assignments")
        if not (data.get("area") or "").strip():
            raise HTTPException(status_code=422, detail="area is required for Printer assignments")

    if not data.get("assignment_date") and data.get("startDate"):
        data["assignment_date"] = data.get("startDate")

    if not data.get("userName"):
        if effective_device_category == "Printer":
            data["userName"] = (data.get("area") or "Unknown")
        else:
            data["userName"] = (
                (data.get("full_name") or data.get("username") or data.get("user") or "Unknown")
            )

    if not data.get("department"):
        if effective_device_category == "Printer":
            data["department"] = "Area"
        else:
            data["department"] = data.get("service") or "Unknown"

    if not data.get("site"):
        if asset_id:
            asset = DB.assets.get(asset_id)
            if asset is not None and getattr(asset, "site", None):
                data["site"] = asset.site
        if not data.get("site"):
            data["site"] = "Unknown"

    if not data.get("startDate"):
        data["startDate"] = data.get("assignment_date") or data.get("acquisition_date") or date.today().isoformat()

    if not data.get("status"):
        data["status"] = "Pending"

    incoming_status = (data.get("status") or "Pending").strip()
    if incoming_status == "Active":
        if not (data.get("approvedBy") or "").strip():
            raise HTTPException(status_code=422, detail="approvedBy is required when status is Active")
        if not (data.get("approvalSignature") or "").strip():
            raise HTTPException(status_code=422, detail="approvalSignature is required when status is Active")
        if not data.get("approvedAt"):
            data["approvedAt"] = date.today().isoformat()

    def builder(new_id: str):
        return models.Assignment(**{"id": new_id, **data})

    try:
        created = DB.assignments.create(item_id, builder)
        if created.assetId and (created.status or "Pending") == "Active":
            _set_asset_status(str(created.assetId), "Assigned")
            _set_asset_date_out_if_missing(str(created.assetId), str(created.approvedAt or date.today().isoformat()))

        if request is not None:
            audit_record(
                action="CREATE",
                entity="Assignment",
                entity_id=str(getattr(created, "id", "") or "") or None,
                description=f"Created Assignment {str(getattr(created, 'id', '') or '').strip()}".strip(),
                request=request,
                details={"payload": payload, "created": created},
            )

        return created
    except ValueError as e:
        msg = str(e)
        if msg == "already_exists":
            raise HTTPException(status_code=409, detail="Already exists")
        if msg.startswith("already_exists:"):
            raise HTTPException(status_code=409, detail=msg.split(":", 1)[1].strip() or "Already exists")
        raise


@router.get("/assignments/{item_id}", response_model=models.Assignment)
def get_assignment(item_id: str):
    item = DB.assignments.get(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Not found")
    return item


@router.patch("/assignments/{item_id}", response_model=models.Assignment)
def patch_assignment(item_id: str, payload: dict = Body(...), request: Request = None):
    before = DB.assignments.get(item_id)
    if before is None:
        raise HTTPException(status_code=404, detail="Not found")

    validated = models.AssignmentUpdate.model_validate(payload)
    patch = validated.model_dump(exclude_unset=True)

    def updater(current: models.Assignment):
        current_data = current.model_dump()

        if "assetId" in patch and patch["assetId"] is not None:
            incoming = str(patch["assetId"])
            existing = str(current.assetId) if current.assetId is not None else ""
            if incoming and incoming != existing:
                _ensure_asset_assignable(incoming)

        current_data.update(patch)

        effective_device_category = (current_data.get("device_category") or "").strip()
        if effective_device_category == "Printer":
            if not current_data.get("assetId"):
                raise HTTPException(status_code=422, detail="assetId is required for Printer assignments")
            if not (current_data.get("area") or "").strip():
                raise HTTPException(status_code=422, detail="area is required for Printer assignments")

        if not current_data.get("userName"):
            if effective_device_category == "Printer":
                current_data["userName"] = (current_data.get("area") or "Unknown")
            else:
                current_data["userName"] = (
                    (current_data.get("full_name") or current_data.get("username") or current_data.get("user") or "Unknown")
                )

        if not current_data.get("department"):
            if effective_device_category == "Printer":
                current_data["department"] = "Area"
            else:
                current_data["department"] = current_data.get("service") or "Unknown"

        if not current_data.get("site"):
            if current_data.get("assetId"):
                asset = DB.assets.get(str(current_data.get("assetId")))
                if asset is not None and getattr(asset, "site", None):
                    current_data["site"] = asset.site
            if not current_data.get("site"):
                current_data["site"] = "Unknown"

        if not current_data.get("startDate"):
            current_data["startDate"] = (
                current_data.get("assignment_date")
                or current_data.get("acquisition_date")
                or date.today().isoformat()
            )

        if not current_data.get("status"):
            current_data["status"] = "Pending"

        desired_status = (current_data.get("status") or "Pending").strip()
        prev_status = (before.status or "Active").strip()

        if desired_status == "Active" and prev_status != "Active":
            if not (current_data.get("approvedBy") or "").strip():
                raise HTTPException(status_code=422, detail="approvedBy is required when activating an assignment")
            if not (current_data.get("approvalSignature") or "").strip():
                raise HTTPException(status_code=422, detail="approvalSignature is required when activating an assignment")
            if not current_data.get("approvedAt"):
                current_data["approvedAt"] = date.today().isoformat()

            # Prevent approving if some other assignment already activated this asset.
            if current_data.get("assetId"):
                asset_id = str(current_data.get("assetId"))
                if _asset_has_active_assignment(asset_id, exclude_assignment_id=str(item_id)):
                    raise HTTPException(status_code=409, detail="Asset already has an active assignment")

        if desired_status == "Returned":
            if not current_data.get("returnDate"):
                current_data["returnDate"] = date.today().isoformat()

        return models.Assignment(**current_data)

    try:
        updated = DB.assignments.update(item_id, updater)

        old_asset_id = str(before.assetId) if before.assetId is not None else ""
        new_asset_id = str(updated.assetId) if updated.assetId is not None else ""
        old_status = before.status or "Active"
        new_status = updated.status or "Active"

        if old_asset_id and old_asset_id != new_asset_id:
            if not _asset_has_active_assignment(old_asset_id, exclude_assignment_id=str(updated.id)):
                _set_asset_status(old_asset_id, "Available")

        if new_asset_id:
            if new_status == "Active":
                _set_asset_status(new_asset_id, "Assigned")
                _set_asset_date_out_if_missing(new_asset_id, str(updated.approvedAt or date.today().isoformat()))
            else:
                if not _asset_has_active_assignment(new_asset_id, exclude_assignment_id=str(updated.id)):
                    _set_asset_status(new_asset_id, "Available")

        if request is not None:
            audit_record(
                action="UPDATE",
                entity="Assignment",
                entity_id=str(item_id),
                description=f"Updated Assignment {item_id}",
                request=request,
                details={"before": before, "patch": patch, "after": updated},
            )

        return updated
    except KeyError as e:
        if str(e) == "'not_found'" or str(e) == "not_found":
            raise HTTPException(status_code=404, detail="Not found")
        raise


@router.delete("/assignments/{item_id}")
def delete_assignment(item_id: str, request: Request = None):
    item = DB.assignments.get(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Not found")

    try:
        DB.assignments.delete(item_id)
    except KeyError as e:
        if str(e) == "'not_found'" or str(e) == "not_found":
            raise HTTPException(status_code=404, detail="Not found")
        raise

    if item.assetId and (item.status or "Active") == "Active":
        asset_id = str(item.assetId)
        if not _asset_has_active_assignment(asset_id, exclude_assignment_id=str(item.id)):
            _set_asset_status(asset_id, "Available")

    if request is not None:
        audit_record(
            action="DELETE",
            entity="Assignment",
            entity_id=str(item_id),
            description=f"Deleted Assignment {item_id}",
            request=request,
            details={"before": item},
        )

    return {"ok": True}

register_crud_routes(
    router=router,
    repo=DB.purchase_requests,
    model=models.PurchaseRequest,
    create_model=models.PurchaseRequestCreate,
    update_model=models.PurchaseRequestUpdate,
    prefix="purchase-requests",
)

register_crud_routes(
    router=router,
    repo=DB.purchase_orders,
    model=models.PurchaseOrder,
    create_model=models.PurchaseOrderCreate,
    update_model=models.PurchaseOrderUpdate,
    prefix="purchase-orders",
)

register_crud_routes(
    router=router,
    repo=DB.maintenance_tickets,
    model=models.MaintenanceTicket,
    create_model=models.MaintenanceTicketCreate,
    update_model=models.MaintenanceTicketUpdate,
    prefix="maintenance-tickets",
)


def _audit_log_public(item: Any):
    try:
        if isinstance(item, models.AuditLog):
            return item.model_copy(update={"details": audit_sanitize_details(item.details) if item.details is not None else None})
    except Exception:
        return item
    return item


def _audit_logs_public(items: list[Any]) -> list[Any]:
    out: list[Any] = []
    for it in items:
        out.append(_audit_log_public(it))
    return out

register_crud_routes(
    router=router,
    repo=DB.audit_logs,
    model=models.AuditLog,
    create_model=models.AuditLogCreate,
    update_model=models.AuditLogUpdate,
    prefix="audit-logs",
    list_fn=_audit_logs_public,
    get_fn=_audit_log_public,
)


@router.post("/audit-logs/{log_id}/undo")
def undo_audit_log(log_id: str, request: Request = None):
    if request is None:
        raise HTTPException(status_code=400, detail="Missing request")

    _require_admin(request)

    log = DB.audit_logs.get(log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Not found")

    action = str(getattr(log, "action", "") or "").strip().upper()
    if action not in ("CREATE", "UPDATE", "DELETE"):
        raise HTTPException(status_code=409, detail="Only CREATE/UPDATE/DELETE audit logs can be undone")

    entity = str(getattr(log, "entity", "") or "").strip()
    entity_id = str(getattr(log, "entityId", "") or "").strip()

    details = getattr(log, "details", None) or {}
    if not entity_id and isinstance(details, dict):
        created = details.get("created") or details.get("after") or details.get("payload")
        if isinstance(created, dict):
            entity_id = str(created.get("id") or "").strip()

    if not entity or not entity_id:
        raise HTTPException(status_code=422, detail="Audit log has no entity/entityId")

    target = _get_undo_target(entity)
    if target is None:
        raise HTTPException(status_code=409, detail=f"Undo is not supported for entity '{entity}'")

    repo, model_cls = target

    before = details.get("before") if isinstance(details, dict) else None
    if action in ("UPDATE", "DELETE") and before is None:
        raise HTTPException(status_code=409, detail="Audit log has no 'before' snapshot to restore")

    mapped_snapshot_data = None
    if action in ("UPDATE", "DELETE"):
        if hasattr(before, "model_dump"):
            before_data = before.model_dump()  # type: ignore[attr-defined]
        else:
            before_data = before

        if not isinstance(before_data, dict):
            raise HTTPException(status_code=409, detail="Invalid 'before' snapshot")

        raw_snapshot_data = dict(before_data)
        raw_snapshot_data["id"] = str(raw_snapshot_data.get("id") or entity_id)
        mapped_snapshot_data = _map_redacted(raw_snapshot_data)

    def _validate_or_raise(data: dict):
        try:
            return model_cls.model_validate(data)
        except Exception as e:
            raise HTTPException(status_code=409, detail=f"Unable to validate snapshot: {_compact_error(e)}")

    def _builder_from_data(data: dict):
        snapshot = _validate_or_raise(data)

        def _builder(new_id: str):
            d = snapshot.model_dump()
            d["id"] = new_id
            return model_cls.model_validate(d)

        return snapshot, _builder

    applied = ""
    result_item = None

    try:
        existing = repo.get(entity_id)
        if action == "CREATE":
            if existing is None:
                # Idempotent: entity is already gone, treat as already undone.
                result_item = None
                applied = "NOOP"
            else:
                # Undo CREATE by deleting the created entity.
                repo.delete(entity_id)
                result_item = existing
                applied = "DELETE"
        elif action == "DELETE":
            if existing is not None:
                raise HTTPException(status_code=409, detail="Entity already exists; cannot restore")

            restored_data = _replace_redacted_with_none(mapped_snapshot_data)

            # If required fields are missing due to redaction, fail with a clear message.
            required = _required_fields(model_cls)
            redacted_required = [k for k, v in mapped_snapshot_data.items() if k in required and v is _REDACTED]
            if redacted_required:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Snapshot is incomplete (redacted required fields): "
                        + ", ".join(sorted(set(redacted_required)))
                    )[:400],
                )

            snapshot, builder = _builder_from_data(restored_data)
            result_item = repo.create(entity_id, builder)
            applied = "RESTORE"
        else:
            if existing is None:
                # If the record was later deleted, best-effort restore.
                restored_data = _replace_redacted_with_none(mapped_snapshot_data)
                required = _required_fields(model_cls)
                redacted_required = [k for k, v in mapped_snapshot_data.items() if k in required and v is _REDACTED]
                if redacted_required:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "Snapshot is incomplete (redacted required fields): "
                            + ", ".join(sorted(set(redacted_required)))
                        )[:400],
                    )

                snapshot, builder = _builder_from_data(restored_data)
                result_item = repo.create(entity_id, builder)
                applied = "RESTORE"
            else:
                current_data = existing.model_dump() if hasattr(existing, "model_dump") else dict(existing)
                merged_data = _merge_snapshot_over_current(current_data, mapped_snapshot_data)
                snapshot = _validate_or_raise(merged_data)
                result_item = repo.update(entity_id, lambda _cur: snapshot)
                applied = "REVERT"
    except HTTPException:
        raise
    except ValueError as e:
        msg = str(e)
        if msg.startswith("already_exists"):
            raise HTTPException(status_code=409, detail=msg)
        raise HTTPException(status_code=409, detail=_compact_error(e))
    except KeyError as e:
        if str(e) == "'not_found'" or str(e) == "not_found":
            raise HTTPException(status_code=404, detail="Not found")
        raise
    except Exception as e:
        raise HTTPException(status_code=409, detail=_compact_error(e))

    try:
        audit_record(
            action="UNDO",
            entity=entity,
            entity_id=entity_id,
            description=f"Undo {action} via audit log {log_id}",
            request=request,
            details={
                "logId": log_id,
                "originalAction": action,
                "applied": applied,
                "restored": result_item,
            },
        )
    except Exception:
        pass

    return {
        "ok": True,
        "applied": applied,
        "entity": entity,
        "entityId": entity_id,
    }

register_crud_routes(
    router=router,
    repo=DB.vendors,
    model=models.Vendor,
    create_model=models.VendorCreate,
    update_model=models.VendorUpdate,
    prefix="vendors",
)


@router.websocket("/ws")
async def ws_events(ws: WebSocket):
    await realtime_hub.connect(ws)
    try:
        while True:
            try:
                # Clients usually don't send anything; use timeout to push keepalives.
                await asyncio.wait_for(ws.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                await ws.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await realtime_hub.disconnect(ws)
