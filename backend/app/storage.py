from __future__ import annotations

import os
import uuid
from dataclasses import dataclass, field
from typing import Dict, Generic, Iterable, List, Optional, TypeVar

T = TypeVar("T")


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


@dataclass
class InMemoryRepo(Generic[T]):
    prefix: str
    items: Dict[str, T] = field(default_factory=dict)

    def list(self) -> List[T]:
        return list(self.items.values())

    def get(self, item_id: str) -> Optional[T]:
        return self.items.get(item_id)

    def create(self, item_id: Optional[str], builder) -> T:
        final_id = item_id or _new_id(self.prefix)
        if final_id in self.items:
            raise ValueError("already_exists")
        item = builder(final_id)
        self.items[final_id] = item
        return item

    def update(self, item_id: str, updater) -> T:
        current = self.items.get(item_id)
        if current is None:
            raise KeyError("not_found")
        updated = updater(current)
        self.items[item_id] = updated
        return updated

    def delete(self, item_id: str) -> None:
        if item_id not in self.items:
            raise KeyError("not_found")
        del self.items[item_id]

    def seed(self, items: Iterable[T], get_id) -> None:
        for item in items:
            self.items[get_id(item)] = item


@dataclass
class Database:
    departments: InMemoryRepo = field(default_factory=lambda: InMemoryRepo(prefix="dept"))
    sites: InMemoryRepo = field(default_factory=lambda: InMemoryRepo(prefix="site"))
    categories: InMemoryRepo = field(default_factory=lambda: InMemoryRepo(prefix="cat"))
    suppliers: InMemoryRepo = field(default_factory=lambda: InMemoryRepo(prefix="sup"))
    licences: InMemoryRepo = field(default_factory=lambda: InMemoryRepo(prefix="lic"))
    users: InMemoryRepo = field(default_factory=lambda: InMemoryRepo(prefix="usr"))
    assets: InMemoryRepo = field(default_factory=lambda: InMemoryRepo(prefix="asset"))
    movements: InMemoryRepo = field(default_factory=lambda: InMemoryRepo(prefix="mov"))
    assignments: InMemoryRepo = field(default_factory=lambda: InMemoryRepo(prefix="asn"))
    purchase_requests: InMemoryRepo = field(default_factory=lambda: InMemoryRepo(prefix="pr"))
    purchase_orders: InMemoryRepo = field(default_factory=lambda: InMemoryRepo(prefix="po"))
    maintenance_tickets: InMemoryRepo = field(default_factory=lambda: InMemoryRepo(prefix="mt"))
    audit_logs: InMemoryRepo = field(default_factory=lambda: InMemoryRepo(prefix="log"))
    vendors: InMemoryRepo = field(default_factory=lambda: InMemoryRepo(prefix="ven"))

def _build_sqlserver_db() -> Database:
    from app import models
    from app.sqlrepos import (
        AssignmentRepo,
        PurchaseOrderRepo,
        PurchaseRequestRepo,
        SQLServerRepo,
    )

    return Database(
        departments=SQLServerRepo(table="departments", model=models.Department),
        sites=SQLServerRepo(table="sites", model=models.Site),
        categories=SQLServerRepo(table="categories", model=models.Category),
        suppliers=SQLServerRepo(table="suppliers", model=models.Supplier),
        users=SQLServerRepo(table="users", model=models.UserDB),
        assets=SQLServerRepo(
            table="assets",
            model=models.Asset,
            date_fields=("warrantyEndDate", "acquisitionDate", "dateIn", "dateOut"),
            json_fields=("deviceProfile",),
        ),
        movements=SQLServerRepo(
            table="stock_movements",
            model=models.StockMovement,
            date_fields=("date",),
        ),
        assignments=AssignmentRepo(
            table="assignments",
            model=models.Assignment,
            date_fields=(
                "startDate",
                "returnDate",
                "acquisition_date",
                "assignment_date",
                "end_of_support_date",
            ),
            datetime_fields=(
                "approvedAt",
            ),
        ),
        purchase_requests=PurchaseRequestRepo(
            table="purchase_requests",
            model=models.PurchaseRequest,
            date_fields=("createdDate",),
            exclude_fields=("lines",),
        ),
        purchase_orders=PurchaseOrderRepo(
            table="purchase_orders",
            model=models.PurchaseOrder,
            date_fields=("createdDate",),
            exclude_fields=("lines",),
        ),
        maintenance_tickets=SQLServerRepo(
            table="maintenance_tickets",
            model=models.MaintenanceTicket,
            date_fields=("openDate", "closeDate"),
        ),
        audit_logs=SQLServerRepo(
            table="audit_logs",
            model=models.AuditLog,
            datetime_fields=("timestamp",),
            json_fields=("details",),
        ),
        vendors=SQLServerRepo(
            table="vendors",
            model=models.Vendor,
            bool_fields=("compliant",),
        ),
    )


_mode = os.getenv("PFE_STORAGE", "inmemory").strip().lower()
DB = _build_sqlserver_db() if _mode == "sqlserver" else Database()
