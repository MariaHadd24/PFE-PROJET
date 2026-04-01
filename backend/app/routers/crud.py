from typing import Any, Callable, Optional, Type

from fastapi import APIRouter, Body, HTTPException, Query, Request
from pydantic import BaseModel

from app.repo import Repo
from app.audit import record as audit_record


def _http_409_already_exists() -> HTTPException:
    return HTTPException(status_code=409, detail="Already exists")


def _http_409(detail: str) -> HTTPException:
    return HTTPException(status_code=409, detail=detail)


def _http_404_not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Not found")


def register_crud_routes(
    *,
    router: APIRouter,
    repo: Repo,
    model: Type[BaseModel],
    create_model: Type[BaseModel],
    update_model: Type[BaseModel],
    prefix: str,
    id_field: str = "id",
    allow_seed: bool = False,
    list_name: Optional[str] = None,
    create_fn: Optional[Callable[[dict], dict]] = None,
    patch_fn: Optional[Callable[[Any, Any], Any]] = None,
    list_fn: Optional[Callable[[list[Any]], list[Any]]] = None,
    get_fn: Optional[Callable[[Any], Any]] = None,
) -> None:
    """Register a small CRUD surface.

    - GET    /{prefix}
    - POST   /{prefix}
    - GET    /{prefix}/{id}
    - PATCH  /{prefix}/{id}
    - DELETE /{prefix}/{id}

    IDs are strings; create accepts optional id.
    """

    list_route = f"/{prefix}"
    item_route = f"/{prefix}/{{item_id}}"

    @router.get(list_route, response_model=list[model])
    def list_items(limit: int = Query(default=200, ge=1, le=10000)):
        items = repo.list()
        if list_fn is not None:
            try:
                items = list_fn(list(items))
            except Exception:
                # Best-effort: never break listing if the hook fails.
                pass
        return items[:limit]

    @router.post(list_route, response_model=model)
    def create_item(payload: dict = Body(...), request: Request = None):
        validated = create_model.model_validate(payload)
        data = validated.model_dump()
        if create_fn is not None:
            try:
                data = create_fn(dict(data))
            except Exception:
                # Best-effort: never break create if the hook fails.
                pass
        item_id = data.pop(id_field, None)

        def builder(new_id: str):
            return model(**{id_field: new_id, **data})

        try:
            created = repo.create(item_id, builder)

            if prefix != "audit-logs" and request is not None:
                new_id = str(getattr(created, id_field, "") or "")
                audit_record(
                    action="CREATE",
                    entity=model.__name__,
                    entity_id=new_id or None,
                    description=f"Created {model.__name__} {new_id or ''}".strip(),
                    request=request,
                    details={"payload": payload, "created": created},
                )

            return created
        except ValueError as e:
            msg = str(e)
            if msg == "already_exists":
                raise _http_409_already_exists()
            if msg.startswith("already_exists:"):
                raise _http_409(msg.split(":", 1)[1].strip() or "Already exists")
            raise

    @router.get(item_route, response_model=model)
    def get_item(item_id: str):
        item = repo.get(item_id)
        if item is None:
            raise _http_404_not_found()

        if get_fn is not None:
            try:
                item = get_fn(item)
            except Exception:
                pass
        return item

    @router.patch(item_route, response_model=model)
    def patch_item(item_id: str, payload: dict = Body(...), request: Request = None):
        validated = update_model.model_validate(payload)
        patch = validated.model_dump(exclude_unset=True)

        before = repo.get(item_id)
        if before is None:
            raise _http_404_not_found()

        def updater(current: Any):
            if patch_fn is not None:
                return patch_fn(current, patch)
            # Works for Pydantic models
            current_data = current.model_dump()
            current_data.update(patch)
            return model(**current_data)

        try:
            updated = repo.update(item_id, updater)

            if prefix != "audit-logs" and request is not None:
                audit_record(
                    action="UPDATE",
                    entity=model.__name__,
                    entity_id=str(item_id),
                    description=f"Updated {model.__name__} {item_id}",
                    request=request,
                    details={"before": before, "patch": patch, "after": updated},
                )

            return updated
        except ValueError as e:
            msg = str(e)
            if msg == "already_exists":
                raise _http_409_already_exists()
            if msg.startswith("already_exists:"):
                raise _http_409(msg.split(":", 1)[1].strip() or "Already exists")
        except KeyError as e:
            if str(e) == "'not_found'" or str(e) == "not_found":
                raise _http_404_not_found()
            raise

    @router.delete(item_route)
    def delete_item(item_id: str, request: Request = None):
        before = repo.get(item_id)
        if before is None:
            raise _http_404_not_found()
        try:
            repo.delete(item_id)
        except KeyError as e:
            if str(e) == "'not_found'" or str(e) == "not_found":
                raise _http_404_not_found()
            raise

        if prefix != "audit-logs" and request is not None:
            audit_record(
                action="DELETE",
                entity=model.__name__,
                entity_id=str(item_id),
                description=f"Deleted {model.__name__} {item_id}",
                request=request,
                details={"before": before},
            )
        return {"ok": True}
