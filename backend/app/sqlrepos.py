from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Tuple, Type, TypeVar

from pydantic import BaseModel

from app.repo import Repo
from app.sqlserver import connect

T = TypeVar("T", bound=BaseModel)


def _is_unique_violation(err: Exception) -> bool:
    msg = str(err).lower()
    return (
        "cannot insert duplicate key" in msg
        or "violation of unique key" in msg
        or "duplicate" in msg
        or "unique" in msg
        or "violation of primary key" in msg
    )


def _compact_sql_error(err: Exception) -> str:
    # Try to keep a readable single-line message for API clients.
    msg = str(err).replace("\r", " ").replace("\n", " ")
    msg = " ".join(msg.split())
    return msg[:400]


def _q(ident: str) -> str:
    # SQL Server identifier quoting
    return f"[{ident.replace(']', ']]')}]"


def _qt(table: str, schema: str = "dbo") -> str:
    return f"{_q(schema)}.{_q(table)}"


def _parse_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    s = str(value).strip()
    if not s:
        return None
    # accept YYYY-MM-DD or full ISO
    s10 = s[:10]
    return date.fromisoformat(s10)


def _parse_dt(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    s = str(value).strip()
    if not s:
        return None
    s = s.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        # fallback: 'YYYY-MM-DD HH:MM'
        dt = datetime.fromisoformat(s.replace(" ", "T"))

    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _row_to_dict(cursor, row) -> Dict[str, Any]:
    cols = [c[0] for c in cursor.description]
    return dict(zip(cols, row))


@dataclass
class SQLServerRepo(Repo[T]):
    table: str
    model: Type[T]
    id_field: str = "id"
    date_fields: Tuple[str, ...] = ()
    datetime_fields: Tuple[str, ...] = ()
    json_fields: Tuple[str, ...] = ()
    bool_fields: Tuple[str, ...] = ()
    exclude_fields: Tuple[str, ...] = ()
    _columns_cache: Optional[set[str]] = field(default=None, init=False, repr=False)

    def _get_columns(self, conn, *, schema: str = "dbo") -> set[str]:
        if self._columns_cache is not None:
            return self._columns_cache

        cur = conn.cursor()
        cur.execute(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
            (schema, self.table),
        )
        cols = {str(r[0]).lower() for r in cur.fetchall()}
        # Keep a small cache; this repo instance lives for the app lifetime.
        self._columns_cache = cols
        return cols

    def _filter_to_known_columns(self, conn, data: Dict[str, Any]) -> Dict[str, Any]:
        """Drop keys that don't exist as SQL columns.

        This makes the API tolerant to model evolution when the SQL schema
        hasn't been migrated yet.
        """

        cols = self._get_columns(conn)
        filtered = {k: v for k, v in data.items() if str(k).lower() in cols}

        # If the table schema changed during runtime (e.g., init script added columns),
        # our cached column list may be stale. Refresh once to avoid silently dropping
        # newly-added fields.
        if len(filtered) < len(data) and self._columns_cache is not None:
            self._columns_cache = None
            cols = self._get_columns(conn)
            filtered = {k: v for k, v in data.items() if str(k).lower() in cols}

        return filtered

    def _deserialize(self, data: Dict[str, Any]) -> T:
        for k in self.date_fields:
            if k in data and data[k] is not None:
                if isinstance(data[k], (date, datetime)):
                    data[k] = str(data[k])[:10]
                else:
                    data[k] = str(data[k])[:10]

        for k in self.datetime_fields:
            if k in data and data[k] is not None:
                dt = _parse_dt(data[k])
                data[k] = dt.isoformat(timespec="seconds") if dt else str(data[k])

        for k in self.json_fields:
            if k in data and data[k] is not None and not isinstance(data[k], (dict, list)):
                try:
                    data[k] = json.loads(str(data[k]))
                except Exception:
                    data[k] = None

        for k in self.bool_fields:
            if k in data:
                data[k] = bool(data[k])

        return self.model.model_validate(data)

    def _serialize(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        out = {k: v for k, v in payload.items() if k not in set(self.exclude_fields)}
        for k in self.date_fields:
            if k in out:
                d = _parse_date(out[k])
                out[k] = d
        for k in self.datetime_fields:
            if k in out:
                out[k] = _parse_dt(out[k])
        for k in self.json_fields:
            if k in out:
                out[k] = None if out[k] is None else json.dumps(out[k], ensure_ascii=False)
        for k in self.bool_fields:
            if k in out:
                out[k] = 1 if bool(out[k]) else 0
        return out

    def list(self) -> List[T]:
        with connect() as conn:
            cur = conn.cursor()
            cur.execute(f"SELECT * FROM {_qt(self.table)}")
            rows = cur.fetchall()
            return [self._deserialize(_row_to_dict(cur, r)) for r in rows]

    def get(self, item_id: str) -> Optional[T]:
        with connect() as conn:
            cur = conn.cursor()
            cur.execute(
                f"SELECT * FROM {_qt(self.table)} WHERE {_q(self.id_field)} = ?",
                (item_id,),
            )
            row = cur.fetchone()
            if row is None:
                return None
            return self._deserialize(_row_to_dict(cur, row))

    def create(self, item_id: Optional[str], builder: Callable[[str], T]) -> T:
        final_id = item_id
        if final_id is None:
            import uuid

            final_id = f"{self.table[:3]}-{uuid.uuid4().hex[:8]}"

        item = builder(final_id)
        with connect() as conn:
            data = self._filter_to_known_columns(conn, self._serialize(item.model_dump()))
            cols = list(data.keys())
            placeholders = ",".join(["?"] * len(cols))
            col_sql = ",".join([_q(c) for c in cols])
            values = [data[c] for c in cols]
            cur = conn.cursor()
            try:
                cur.execute(
                    f"INSERT INTO {_qt(self.table)} ({col_sql}) VALUES ({placeholders})",
                    values,
                )
                conn.commit()
            except Exception as e:
                if _is_unique_violation(e):
                    raise ValueError(f"already_exists:{_compact_sql_error(e)}")
                raise
        return item

    def update(self, item_id: str, updater: Callable[[Any], T]) -> T:
        current = self.get(item_id)
        if current is None:
            raise KeyError("not_found")

        updated = updater(current)
        with connect() as conn:
            data = self._filter_to_known_columns(conn, self._serialize(updated.model_dump()))
            data.pop(self.id_field, None)

            if not data:
                return updated

            set_sql = ",".join([f"{_q(k)} = ?" for k in data.keys()])
            values = list(data.values()) + [item_id]
            cur = conn.cursor()
            try:
                cur.execute(
                    f"UPDATE {_qt(self.table)} SET {set_sql} WHERE {_q(self.id_field)} = ?",
                    values,
                )
                if cur.rowcount == 0:
                    raise KeyError("not_found")
                conn.commit()
            except Exception as e:
                if _is_unique_violation(e):
                    raise ValueError(f"already_exists:{_compact_sql_error(e)}")
                raise

        return updated

    def delete(self, item_id: str) -> None:
        with connect() as conn:
            cur = conn.cursor()
            cur.execute(
                f"DELETE FROM {_qt(self.table)} WHERE {_q(self.id_field)} = ?",
                (item_id,),
            )
            if cur.rowcount == 0:
                raise KeyError("not_found")
            conn.commit()

    def seed(self, items: Iterable[T], get_id: Callable[[T], str]) -> None:
        for item in items:
            try:
                self.create(get_id(item), lambda _id, it=item: it)
            except ValueError:
                continue


@dataclass
class AssignmentRepo(SQLServerRepo[T]):
    """Assignments repo with column mapping.

    SQL Server commonly uses a case-insensitive collation, so having both
    `userName` and `username` columns collides. The schema stores the assignee
    display name as `assigneeName` while the API keeps the historical `userName`.
    """

    def _serialize(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        out = super()._serialize(payload)
        # API -> DB
        # IMPORTANT: SQL Server identifiers are commonly case-insensitive, so
        # `userName` collides with the real `username` column at INSERT time.
        # Map to `assigneeName` then drop `userName` to avoid duplicate columns.
        if "userName" in out:
            if "assigneeName" not in out or out.get("assigneeName") in (None, ""):
                out["assigneeName"] = out.get("userName")
            out.pop("userName", None)
        return out

    def _deserialize(self, data: Dict[str, Any]) -> T:
        # DB -> API
        if "assigneeName" in data and "userName" not in data:
            data["userName"] = data.get("assigneeName")
        return super()._deserialize(data)


@dataclass
class PurchaseRequestRepo(SQLServerRepo[T]):
    line_table: str = "pr_lines"

    def list(self) -> List[T]:
        prs = super().list()
        if not prs:
            return prs

        pr_ids = [getattr(pr, self.id_field) for pr in prs]
        with connect() as conn:
            cur = conn.cursor()
            placeholders = ",".join(["?"] * len(pr_ids))
            cur.execute(
                f"SELECT * FROM {_qt(self.line_table)} WHERE {_q('purchaseRequestId')} IN ({placeholders})",
                pr_ids,
            )
            rows = cur.fetchall()
            lines_by_pr: Dict[str, List[Dict[str, Any]]] = {}
            for r in rows:
                d = _row_to_dict(cur, r)
                pr_id = str(d.pop("purchaseRequestId"))
                lines_by_pr.setdefault(pr_id, []).append(d)

        out: List[T] = []
        for pr in prs:
            data = pr.model_dump()
            data["lines"] = lines_by_pr.get(str(data[self.id_field]), [])
            out.append(self.model.model_validate(data))
        return out

    def get(self, item_id: str) -> Optional[T]:
        pr = super().get(item_id)
        if pr is None:
            return None

        with connect() as conn:
            cur = conn.cursor()
            cur.execute(
                f"SELECT * FROM {_qt(self.line_table)} WHERE {_q('purchaseRequestId')} = ?",
                (item_id,),
            )
            rows = cur.fetchall()
            lines = []
            for r in rows:
                d = _row_to_dict(cur, r)
                d.pop("purchaseRequestId", None)
                lines.append(d)

        data = pr.model_dump()
        data["lines"] = lines
        return self.model.model_validate(data)

    def create(self, item_id: Optional[str], builder: Callable[[str], T]) -> T:
        pr = super().create(item_id, builder)
        data = pr.model_dump()
        lines = data.get("lines") or []
        pr_id = str(data[self.id_field])

        if lines:
            with connect() as conn:
                cur = conn.cursor()
                for line in lines:
                    cur.execute(
                        f"INSERT INTO {_qt(self.line_table)} ({_q('id')}, {_q('purchaseRequestId')}, {_q('product')}, {_q('quantity')}, {_q('estimatedPrice')}) VALUES (?,?,?,?,?)",
                        (
                            line["id"],
                            pr_id,
                            line["product"],
                            int(line["quantity"]),
                            float(line["estimatedPrice"]),
                        ),
                    )
                conn.commit()

        return self.get(pr_id) or pr

    def update(self, item_id: str, updater: Callable[[Any], T]) -> T:
        updated = super().update(item_id, updater)
        # If payload includes lines, replace all lines (simple, deterministic)
        data = updated.model_dump()
        if "lines" not in data:
            return self.get(item_id) or updated

        lines = data.get("lines") or []
        with connect() as conn:
            cur = conn.cursor()
            cur.execute(
                f"DELETE FROM {_qt(self.line_table)} WHERE {_q('purchaseRequestId')} = ?",
                (item_id,),
            )
            for line in lines:
                cur.execute(
                    f"INSERT INTO {_qt(self.line_table)} ({_q('id')}, {_q('purchaseRequestId')}, {_q('product')}, {_q('quantity')}, {_q('estimatedPrice')}) VALUES (?,?,?,?,?)",
                    (
                        line["id"],
                        item_id,
                        line["product"],
                        int(line["quantity"]),
                        float(line["estimatedPrice"]),
                    ),
                )
            conn.commit()

        return self.get(item_id) or updated


@dataclass
class PurchaseOrderRepo(SQLServerRepo[T]):
    line_table: str = "po_lines"

    def list(self) -> List[T]:
        pos = super().list()
        if not pos:
            return pos

        po_ids = [getattr(po, self.id_field) for po in pos]
        with connect() as conn:
            cur = conn.cursor()
            placeholders = ",".join(["?"] * len(po_ids))
            cur.execute(
                f"SELECT * FROM {_qt(self.line_table)} WHERE {_q('purchaseOrderId')} IN ({placeholders})",
                po_ids,
            )
            rows = cur.fetchall()
            lines_by_po: Dict[str, List[Dict[str, Any]]] = {}
            for r in rows:
                d = _row_to_dict(cur, r)
                po_id = str(d.pop("purchaseOrderId"))
                lines_by_po.setdefault(po_id, []).append(d)

        out: List[T] = []
        for po in pos:
            data = po.model_dump()
            data["lines"] = lines_by_po.get(str(data[self.id_field]), [])
            out.append(self.model.model_validate(data))
        return out

    def get(self, item_id: str) -> Optional[T]:
        po = super().get(item_id)
        if po is None:
            return None

        with connect() as conn:
            cur = conn.cursor()
            cur.execute(
                f"SELECT * FROM {_qt(self.line_table)} WHERE {_q('purchaseOrderId')} = ?",
                (item_id,),
            )
            rows = cur.fetchall()
            lines = []
            for r in rows:
                d = _row_to_dict(cur, r)
                d.pop("purchaseOrderId", None)
                lines.append(d)

        data = po.model_dump()
        data["lines"] = lines
        return self.model.model_validate(data)

    def create(self, item_id: Optional[str], builder: Callable[[str], T]) -> T:
        po = super().create(item_id, builder)
        data = po.model_dump()
        lines = data.get("lines") or []
        po_id = str(data[self.id_field])

        if lines:
            with connect() as conn:
                cur = conn.cursor()
                for line in lines:
                    cur.execute(
                        f"INSERT INTO {_qt(self.line_table)} ({_q('id')}, {_q('purchaseOrderId')}, {_q('product')}, {_q('quantity')}, {_q('price')}) VALUES (?,?,?,?,?)",
                        (
                            line["id"],
                            po_id,
                            line["product"],
                            int(line["quantity"]),
                            float(line["price"]),
                        ),
                    )
                conn.commit()

        return self.get(po_id) or po

    def update(self, item_id: str, updater: Callable[[Any], T]) -> T:
        updated = super().update(item_id, updater)
        data = updated.model_dump()
        if "lines" not in data:
            return self.get(item_id) or updated

        lines = data.get("lines") or []
        with connect() as conn:
            cur = conn.cursor()
            cur.execute(
                f"DELETE FROM {_qt(self.line_table)} WHERE {_q('purchaseOrderId')} = ?",
                (item_id,),
            )
            for line in lines:
                cur.execute(
                    f"INSERT INTO {_qt(self.line_table)} ({_q('id')}, {_q('purchaseOrderId')}, {_q('product')}, {_q('quantity')}, {_q('price')}) VALUES (?,?,?,?,?)",
                    (
                        line["id"],
                        item_id,
                        line["product"],
                        int(line["quantity"]),
                        float(line["price"]),
                    ),
                )
            conn.commit()

        return self.get(item_id) or updated
