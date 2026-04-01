from __future__ import annotations

import os
from datetime import date, datetime, timezone
from typing import Any, Dict, Optional

from fastapi import Request
from pydantic import BaseModel

from app import models
from app.storage import DB


def _looks_like_email(value: Any) -> bool:
    s = str(value or "").strip()
    return bool(s) and "@" in s and "." in s


def _env_bool(name: str, default: bool = False) -> bool:
    raw = str(os.getenv(name, "")).strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "y", "on"}


def _send_notification_emails(*, title: str, message: str, action_link: str, recipient_email: str = None, explanation: str = None) -> None:
    """Best-effort email broadcast for in-app notifications.

    - No-op if SMTP isn't configured.
    - Does not raise.
    """

    try:
        from app.emailer import is_configured, send_email

        if not is_configured():
            print("[NOTIF-EMAIL] Email system not configured, skipping.")
            return

        app_base = str(os.getenv("PFE_APP_BASE_URL", "http://localhost:5173")).strip().rstrip("/")
        url = f"{app_base}{action_link}" if action_link.startswith("/") else f"{app_base}/{action_link}"

        subject = str(title or "Notification").strip()
        # Ajout d'une explication personnalisée si fournie
        explication = explanation or "Vous avez reçu une nouvelle notification sur la plateforme."
        body = f"{explication}\n\n{message}\n\nVoir le détail : {url}\n"

        if recipient_email:
            # Envoi ciblé à un seul utilisateur
            print(f"[NOTIF-EMAIL] Tentative d'envoi à : {recipient_email}")
            if _looks_like_email(recipient_email):
                try:
                    send_email(to=str(recipient_email), subject=subject, text=body)
                    print(f"[NOTIF-EMAIL] Email envoyé à : {recipient_email}")
                except Exception as e:
                    print(f"[NOTIF-EMAIL] ECHEC envoi à : {recipient_email} | Exception: {e}")
            else:
                print(f"[NOTIF-EMAIL] Adresse email invalide : {recipient_email}")
            return

        # Sinon, comportement par défaut (broadcast)
        role_filter_enabled = _env_bool("PFE_EMAIL_ROLE_FILTER", False)
        all_users = list(DB.users.list())
        print("[NOTIF-EMAIL] Dump complet des utilisateurs backend:")
        for u in all_users:
            print(f"  - {u}")
        all_emails = []
        for u in all_users:
            try:
                user_email = getattr(u, "email", None)
            except Exception:
                user_email = None
            if not _looks_like_email(user_email):
                continue
            all_emails.append(user_email)
        print(f"[NOTIF-EMAIL] Utilisateurs ciblés pour broadcast: {all_emails}")
        for user_email in all_emails:
            if role_filter_enabled:
                pass
            print(f"[NOTIF-EMAIL] Tentative d'envoi à (broadcast): {user_email}")
            try:
                send_email(to=str(user_email), subject=subject, text=body)
                print(f"[NOTIF-EMAIL] Email envoyé à (broadcast): {user_email}")
            except Exception as e:
                print(f"[NOTIF-EMAIL] ECHEC envoi à (broadcast): {user_email} | Exception: {e}")
    except Exception:
        return


_SENSITIVE_KEYS = {
    "password",
    "passwordHash",
    "signatureData",
    "signatureNumber",
    "approvalSignature",
}


def _now_iso() -> str:
    # Use UTC for consistency; repo will parse into DATETIME2.
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds")


def _initials(name: str) -> str:
    parts = [p for p in (name or "").strip().split() if p]
    if not parts:
        return ""
    return (parts[0][:1] + (parts[-1][:1] if len(parts) > 1 else "")).upper()[:10]


def _client_ip(request: Request) -> str:
    xff = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if xff:
        return xff[:45]
    if request.client and request.client.host:
        return str(request.client.host)[:45]
    return "127.0.0.1"


def _to_plain(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, BaseModel):
        return value.model_dump()
    return value


def _to_jsonable(value: Any) -> Any:
    value = _to_plain(value)

    if value is None:
        return None

    if isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, (date, datetime)):
        try:
            return value.isoformat()
        except Exception:
            return str(value)

    if isinstance(value, dict):
        return {str(k): _to_jsonable(v) for k, v in value.items()}

    if isinstance(value, list):
        return [_to_jsonable(v) for v in value]

    if isinstance(value, tuple):
        return [_to_jsonable(v) for v in value]

    # Fallback: keep it readable/serializable.
    return str(value)


def _sanitize(value: Any) -> Any:
    value = _to_plain(value)

    if isinstance(value, dict):
        out: Dict[str, Any] = {}
        for k, v in value.items():
            if k in _SENSITIVE_KEYS:
                if v is None:
                    out[k] = None
                else:
                    s = str(v)
                    out[k] = {"redacted": True, "len": len(s)}
                continue
            out[k] = _sanitize(v)
        return out

    if isinstance(value, list):
        return [_sanitize(v) for v in value]

    return value


def sanitize_details(details: Any) -> Any:
    return _sanitize(details)


def record(
    *,
    action: str,
    entity: str,
    entity_id: Optional[str],
    description: str,
    request: Request,
    details: Optional[Dict[str, Any]] = None,
    result: models.AuditLogResult = "Success",
) -> None:
    """Best-effort audit log.

    Never raises: failures shouldn't block the main operation.
    """

    try:
        actor_email = (request.headers.get("x-actor-email") or "").strip()
        actor_name = (request.headers.get("x-actor-name") or "").strip()
        actor_role = (request.headers.get("x-actor-role") or "").strip() or None

        user_label = actor_name or actor_email or "Unknown"

        payload = models.AuditLog(
            id="",  # filled by repo.create
            timestamp=_now_iso(),
            user=user_label,
            userRole=actor_role,
            userInitials=_initials(actor_name or actor_email),
            action=str(action),
            entity=str(entity),
            entityId=str(entity_id) if entity_id else None,
            description=str(description) if description else None,
            result=result,
            ip=_client_ip(request),
            # Store RAW snapshots for rollback; sanitize on read for UI.
            details=_to_jsonable(details) if details is not None else None,
        )

        created = DB.audit_logs.create(None, lambda new_id: payload.model_copy(update={"id": new_id}))

        # Notify connected clients so they can refresh without a full page reload.
        try:
            from app.realtime import notify

            notify(
                {
                    "type": "invalidate",
                    "entity": str(entity),
                    "entityId": str(entity_id) if entity_id else None,
                    "action": str(action),
                    "auditLogId": str(getattr(created, "id", "") or "") or None,
                }
            )

            # Shared notifications (best-effort): broadcast human-friendly events.
            try:
                if str(action) == "CREATE":
                    audit_log_id = str(getattr(created, "id", "") or "")
                    payload_plain = _to_jsonable(details) if details is not None else None
                    created_obj = payload_plain.get("created") if isinstance(payload_plain, dict) else None

                    def safe_str(v: Any) -> str:
                        s = str(v or "").strip()
                        return s

                    def send_notification(
                        *,
                        category: str,
                        title: str,
                        message: str,
                        action_link: str,
                        action_label: str,
                        level: str = "success",
                        recipient_email: str = None,
                        explanation: str = None,
                    ) -> None:
                        notify(
                            {
                                "type": "notification",
                                "id": f"audit:{audit_log_id}:notification" if audit_log_id else None,
                                "timestamp": _now_iso(),
                                "category": category,
                                "level": level,
                                "title": title,
                                "message": message,
                                "action": {"label": action_label, "link": action_link},
                            }
                        )

                        # Envoi d'email ciblé uniquement aux utilisateurs concernés
                        try:
                            import threading
                            if recipient_email:
                                print(f"[NOTIF-EMAIL] Envoi ciblé à : {recipient_email} pour notification: {title}")
                                threading.Thread(
                                    target=_send_notification_emails,
                                    kwargs={
                                        "title": title,
                                        "message": message,
                                        "action_link": action_link,
                                        "recipient_email": recipient_email,
                                        "explanation": explanation,
                                    },
                                    daemon=True,
                                ).start()
                            else:
                                print(f"[NOTIF-EMAIL] Aucun destinataire ciblé pour notification: {title}")
                        except Exception as e:
                            print(f"[NOTIF-EMAIL] ECHEC envoi ciblé: {e}")
                            _send_notification_emails(
                                title=title,
                                message=message,
                                action_link=action_link,
                                recipient_email=recipient_email,
                                explanation=explanation,
                            )

                    if str(entity) == "PurchaseRequest" and isinstance(created_obj, dict):
                        pr_id = safe_str(created_obj.get("id") or entity_id)
                        dept = safe_str(created_obj.get("department"))
                        budget = created_obj.get("budget")
                        requester_email = safe_str(created_obj.get("requesterEmail") or created_obj.get("email") or "")
                        parts = [p for p in [pr_id, dept] if p]
                        msg = " - ".join(parts) if parts else "Purchase Request created"
                        if budget is not None and str(budget) != "":
                            msg = f"{msg} (Budget: {budget})"
                        send_notification(
                            category="request",
                            title="New Purchase Request",
                            message=msg,
                            action_link="/orders",
                            action_label="View orders",
                            recipient_email=requester_email,
                            explanation="Vous venez de recevoir une nouvelle demande d'achat sur la plateforme. Cliquez sur le lien pour voir les détails.",
                        )

                    if str(entity) == "PurchaseOrder" and isinstance(created_obj, dict):
                        po_id = safe_str(created_obj.get("id") or entity_id)
                        supplier = safe_str(created_obj.get("supplier"))
                        total = created_obj.get("total")
                        requester_email = safe_str(created_obj.get("requesterEmail") or created_obj.get("email") or "")
                        parts = [p for p in [po_id, supplier] if p]
                        msg = " - ".join(parts) if parts else "Purchase Order created"
                        if total is not None and str(total) != "":
                            msg = f"{msg} (Total: {total})"
                        send_notification(
                            category="order",
                            title="New Purchase Order",
                            message=msg,
                            action_link="/orders",
                            action_label="View orders",
                            recipient_email=requester_email,
                            explanation="Vous venez de recevoir une nouvelle commande sur la plateforme. Cliquez sur le lien pour voir les détails.",
                        )

                    if str(entity) == "Assignment" and isinstance(created_obj, dict):
                        status = safe_str(created_obj.get("status") or "Pending")
                        if status in {"Pending", ""}:
                            assignment_id = safe_str(created_obj.get("id") or entity_id)
                            asset_id = safe_str(created_obj.get("assetId"))
                            user_name = safe_str(created_obj.get("userName") or created_obj.get("full_name") or created_obj.get("username"))
                            user_email = safe_str(created_obj.get("email") or created_obj.get("userEmail") or "")
                            parts = [p for p in [assignment_id, asset_id, user_name] if p]
                            msg = " - ".join(parts) if parts else "Assignment request created"
                            explication = "Vous venez de recevoir une nouvelle affectation sur la plateforme. Cliquez sur le lien pour voir les détails."
                            send_notification(
                                category="request",
                                title="Nouvelle affectation",
                                message=msg,
                                action_link="/assignments",
                                action_label="Voir les affectations",
                                recipient_email=user_email,
                                explanation=explication,
                            )
            except Exception:
                pass
        except Exception:
            pass
    except Exception:
        return
