from __future__ import annotations

import logging
import os

from app import models
from app.auth import hash_password
from app.storage import DB


logger = logging.getLogger(__name__)


def sync_asset_statuses_from_assignments() -> None:
    """Keep assets.status consistent with assignments.

    Assets referenced by an Active assignment become Assigned.
    Assets not referenced by any Active assignment become Available.

    Does not override InRepair/Retired.
    """

    try:
        assets = DB.assets.list()
        assignments = DB.assignments.list()
    except Exception as e:
        logger.warning("Sync skipped (storage unavailable): %s", e)
        return

    active_asset_ids = {
        str(a.assetId)
        for a in assignments
        if a.assetId and (a.status or "Active") == "Active"
    }

    changed = 0
    for asset in assets:
        aid = str(asset.id)
        cur = getattr(asset, "status", None)
        if cur in {"InRepair", "Retired"}:
            continue

        desired = "Assigned" if aid in active_asset_ids else "Available"
        if cur != desired:
            def updater(current: models.Asset):
                d = current.model_dump()
                d["status"] = desired
                return models.Asset(**d)

            try:
                DB.assets.update(aid, updater)
                changed += 1
            except Exception:
                continue

    logger.info(
        "Asset status sync complete: active_assets=%s changed=%s",
        len(active_asset_ids),
        changed,
    )


def seed_data() -> None:
    try:
        # If SQL Server is enabled but not reachable, don't crash app startup.
        _ = DB.departments.list()
    except Exception as e:
        logger.warning("Seed skipped (storage unavailable): %s", e)
        return

    # Cleanup legacy placeholder sites that represented IT codes only.
    # We now store real sites (AS1/AS2/...) with a separate `codeIt` field.
    for legacy_site_id in ("site-SEB", "site-BOK", "site-MA6", "site-MA7"):
        try:
            DB.sites.delete(legacy_site_id)
        except Exception:
            pass

    sites_seed = [
        models.Site(
            id="site-AS1",
            name="AS1",
            codeIt="SEB",
            location="Aïn Sebaâ",
            zone="Zone industrielle",
            city="Casablanca",
        ),
        models.Site(
            id="site-AS2",
            name="AS2",
            codeIt="SEB",
            location="Herbili",
            zone="Zone industrielle",
            city="Casablanca",
        ),
        models.Site(
            id="site-AS3",
            name="AS3",
            codeIt="AS3",
            location="Bouznika",
            zone="Zone industrielle",
            city="Bouznika",
        ),
        models.Site(
            id="site-ECO-PARK-A",
            name="Ecopark A",
            codeIt="MA7",
            location="Had Soualem",
            zone="Parc industriel",
            city="Had Soualem",
        ),
        models.Site(
            id="site-BOUSKOURA-1",
            name="Bouskoura 1",
            codeIt="BOK",
            location="Bouskoura",
            zone="Zone industrielle Bouskoura",
            city="Bouskoura",
        ),
        models.Site(
            id="site-BOUSKOURA-2",
            name="Bouskoura 2",
            codeIt="BOK",
            location="Bouskoura",
            zone="Zone industrielle Bouskoura",
            city="Bouskoura",
        ),
        models.Site(
            id="site-BOUSKOURA-3",
            name="Bouskoura 3",
            codeIt="BOK",
            location="Ouled Saleh",
            zone="Zone industrielle",
            city="Bouskoura",
        ),
        models.Site(
            id="site-SYSAPP",
            name="Sysapp",
            codeIt="MA7",
            location="Berrechid",
            zone="Zone industrielle (Hay Sinaâ)",
            city="Berrechid",
        ),
        models.Site(
            id="site-BERRECHID-2",
            name="Berrechid 2",
            codeIt="MA6",
            location="Berrechid",
            zone="Zone industrielle Berrechid",
            city="Berrechid",
        ),
        models.Site(
            id="site-AGADIR",
            name="Agadir",
            codeIt="MAG",
            location="Agadir",
            zone="Zone industrielle Agadir",
            city="Agadir",
        ),
    ]

    categories_seed = [
        models.Category(id="cat-MON", name="Monitor"),
        # User asset types
        models.Category(id="cat-WKS", name="Workstation"),
        models.Category(id="cat-NBK", name="Notebook"),
        models.Category(id="cat-PRI", name="Printer"),
        models.Category(id="cat-DOC", name="Docking Station"),
        models.Category(id="cat-APS", name="APs"),
        models.Category(id="cat-SCN", name="Scanner"),
        models.Category(id="cat-KAB", name="KABA"),
        models.Category(id="cat-CIS", name="Cisco"),
    ]

    departments_seed = [
        models.Department(
            id="dept-001",
            name="IT",
            code="IT",
            head="John Smith",
            members=12,
            description="Infrastructure & support",
        ),
        models.Department(
            id="dept-002",
            name="Finance",
            code="FIN",
            head="Sarah Johnson",
            members=8,
            description="Budgets & procurement",
        ),
        models.Department(
            id="dept-003",
            name="LOG",
            code="LOG",
            head="Karim Ben Ali",
            members=22,
            description="Warehousing & deliveries",
        ),
        models.Department(id="dept-004", name="PROD", code="PROD"),
        models.Department(id="dept-005", name="FRM", code="FRM"),
        models.Department(id="dept-006", name="ENG", code="ENG"),
        models.Department(id="dept-007", name="HR", code="HR"),
        models.Department(id="dept-008", name="MET", code="MET"),
        models.Department(id="dept-009", name="QL", code="QL"),
        models.Department(id="dept-010", name="FS", code="FS"),
        models.Department(id="dept-011", name="Maintenance", code="MAINT"),
        models.Department(id="dept-012", name="Laboratory", code="LAB"),
        models.Department(id="dept-013", name="Tooling", code="TOOL"),
        models.Department(id="dept-014", name="Log (zone principale)", code="LOG-ZP"),
        models.Department(id="dept-015", name="Log (zone2)", code="LOG-Z2"),
        models.Department(id="dept-016", name="Log bureau", code="LOG-BUR"),
        models.Department(id="dept-017", name="HR (transp)", code="HR-TR"),
    ]

    suppliers_seed = [
        models.Supplier(id="sup-001", name="TechSupplier Inc.", contact="sales@techsupplier.com"),
        models.Supplier(id="sup-002", name="OfficeGear", contact="contact@officegear.com"),
        models.Supplier(id="sup-003", name="NetworkPro", contact="support@networkpro.example"),
    ]

    demo_password = (os.environ.get("PFE_DEMO_PASSWORD") or "123456").strip() or "123456"
    demo_hash = hash_password(demo_password)

    demo_signature = (
        "data:image/svg+xml;utf8,"
        "<svg xmlns='http://www.w3.org/2000/svg' width='200' height='60'>"
        "<path d='M10,40C40,10,80,70,120,30S190,40,190,40' stroke='black' stroke-width='3' fill='none'/>"
        "</svg>"
    )

    users_seed = [
        models.UserDB(
            id="usr-001",
            name="Admin User",
            email="admin@leoni.example",
            role="Admin",
            avatarUrl=None,
            signatureNumber="100001",
            signatureData=demo_signature,
            passwordHash=demo_hash,
        ),
        models.UserDB(
            id="usr-002",
            name="Technician",
            email="tech@leoni.example",
            role="Technician",
            avatarUrl=None,
            signatureNumber="100002",
            signatureData=demo_signature,
            passwordHash=demo_hash,
        ),
        models.UserDB(
            id="usr-003",
            name="Manager",
            email="manager@leoni.example",
            role="Manager",
            avatarUrl=None,
            signatureNumber="100003",
            signatureData=demo_signature,
            passwordHash=demo_hash,
        ),
        models.UserDB(
            id="usr-004",
            name="Reader",
            email="reader@leoni.example",
            role="Reader",
            avatarUrl=None,
            signatureNumber="100004",
            signatureData=demo_signature,
            passwordHash=demo_hash,
        ),
        models.UserDB(
    id="usr-005",
    name="Maria Haddouch",
    email="mariaa.haddouch@gmail.com",
    role="Manager",  # ou "Technician", "Reader", etc. selon le besoin
    avatarUrl=None,
    signatureNumber="100005",
    signatureData=demo_signature,
    passwordHash=demo_hash,
),
    ]

    vendors_seed = [
        models.Vendor(
            id="ven-001",
            name="TechSupplier Inc.",
            category="IT Hardware",
            status="PREFERRED",
            email="sales@techsupplier.com",
            phone="+216 00 000 000",
            totalSpend=154000,
            activeContracts=2,
            rating=4.8,
            compliant=True,
        ),
        models.Vendor(
            id="ven-002",
            name="OfficeGear",
            category="Office/Peripherals",
            status="APPROVED",
            email="contact@officegear.com",
            phone="+216 00 111 111",
            totalSpend=62000,
            activeContracts=1,
            rating=4.4,
            compliant=True,
        ),
        models.Vendor(
            id="ven-003",
            name="NetworkPro",
            category="Networking",
            status="APPROVED",
            email="support@networkpro.example",
            phone="+216 00 222 222",
            totalSpend=98000,
            activeContracts=2,
            rating=4.6,
            compliant=True,
        ),
    ]

    # Always ensure master data exists.
    # For departments, use an upsert-like seed so updates are applied on re-run.
    for d in departments_seed:
        did = str(d.id)
        try:
            DB.departments.create(did, lambda _id, it=d: it)
        except ValueError:
            DB.departments.update(did, lambda _cur, it=d: it)
    for s in sites_seed:
        sid = str(s.id)
        try:
            DB.sites.create(sid, lambda _id, it=s: it)
        except ValueError:
            DB.sites.update(sid, lambda _cur, it=s: it)
    DB.categories.seed(categories_seed, get_id=lambda c: c.id)
    DB.suppliers.seed(suppliers_seed, get_id=lambda s: s.id)
    DB.users.seed(users_seed, get_id=lambda u: u.id)
    DB.vendors.seed(vendors_seed, get_id=lambda v: v.id)

    # Ensure demo accounts have a password hash even if they existed already.
    for u in users_seed:
        try:
            current = DB.users.get(u.id)
            if current is None:
                continue
            cur_hash = str(getattr(current, "passwordHash", "") or "")
            if cur_hash:
                continue

            def updater(existing: models.UserDB):
                d = existing.model_dump()
                d["passwordHash"] = demo_hash
                return models.UserDB.model_validate(d)

            DB.users.update(u.id, updater)
        except Exception:
            continue

    # Ensure demo accounts have a signatureData even if they existed already.
    for u in users_seed:
        try:
            current = DB.users.get(u.id)
            if current is None:
                continue
            cur_sig = str(getattr(current, "signatureData", "") or "").strip()
            if cur_sig:
                continue

            def updater(existing: models.UserDB):
                d = existing.model_dump()
                d["signatureData"] = demo_signature
                return models.UserDB.model_validate(d)

            DB.users.update(u.id, updater)
        except Exception:
            continue

    # Seed a richer asset catalog only when the DB is (almost) empty.
    try:
        existing_assets = DB.assets.list()
        should_seed_assets = len(existing_assets) < 5
    except Exception:
        should_seed_assets = True

    if should_seed_assets:
        assets_seed = [
            # Notebooks
            models.Asset(
                id="asset-001",
                assetTag="NB-MA6-0001",
                serialNumber="SN-NB-MA6-0001",
                macAddress="00:11:22:33:44:01",
                model="Dell Latitude 5420",
                type=None,
                deviceProfile=None,
                category="Notebook",
                supplier="TechSupplier Inc.",
                site="Berrechid 2",
                status="Available",
                warrantyEndDate="2026-12-31",
                acquisitionDate="2024-01-15",
                value=1200,
            ),
            models.Asset(
                id="asset-002",
                assetTag="NB-MA7-0002",
                serialNumber="SN-NB-MA7-0002",
                macAddress="00:11:22:33:44:02",
                model="HP ProBook 450 G8",
                type=None,
                deviceProfile=None,
                category="Notebook",
                supplier="OfficeGear",
                site="Ecopark A",
                status="Assigned",
                warrantyEndDate="2027-06-30",
                acquisitionDate="2025-06-15",
                value=980,
            ),
            # Workstations
            models.Asset(
                id="asset-003",
                assetTag="WS-SEB-0003",
                serialNumber="SN-WS-SEB-0003",
                macAddress=None,
                model="Lenovo ThinkStation P360",
                type=None,
                deviceProfile=None,
                category="Workstation",
                supplier="TechSupplier Inc.",
                site="AS1",
                status="Available",
                warrantyEndDate="2027-03-31",
                acquisitionDate="2025-03-20",
                value=1600,
            ),
            models.Asset(
                id="asset-004",
                assetTag="WS-BOK-0004",
                serialNumber="SN-WS-BOK-0004",
                macAddress=None,
                model="Dell OptiPlex 7010",
                type=None,
                deviceProfile=None,
                category="Workstation",
                supplier="OfficeGear",
                site="Bouskoura 1",
                status="InRepair",
                warrantyEndDate="2026-10-01",
                acquisitionDate="2024-10-01",
                value=850,
            ),
            # Monitors
            models.Asset(
                id="asset-005",
                assetTag="MON-MA6-0005",
                serialNumber="SN-MON-MA6-0005",
                macAddress=None,
                model='Dell P2422H 24"',
                type=None,
                deviceProfile=None,
                category="Monitor",
                supplier="OfficeGear",
                site="Berrechid 2",
                status="Available",
                warrantyEndDate="2027-12-31",
                acquisitionDate="2025-12-01",
                value=190,
            ),
            models.Asset(
                id="asset-006",
                assetTag="MON-AS3-0006",
                serialNumber="SN-MON-AS3-0006",
                macAddress=None,
                model='HP E24 G5 24"',
                type=None,
                deviceProfile=None,
                category="Monitor",
                supplier="OfficeGear",
                site="AS3",
                status="Assigned",
                warrantyEndDate="2028-01-15",
                acquisitionDate="2026-01-15",
                value=175,
            ),
            # Docking Stations
            models.Asset(
                id="asset-007",
                assetTag="DOC-MA6-0007",
                serialNumber="SN-DOC-MA6-0007",
                macAddress=None,
                model="HP USB-C Dock G5",
                type=None,
                deviceProfile=None,
                category="Docking Station",
                supplier="OfficeGear",
                site="Berrechid 2",
                status="Available",
                warrantyEndDate="2027-07-01",
                acquisitionDate="2025-07-01",
                value=140,
            ),
            models.Asset(
                id="asset-008",
                assetTag="DOC-MA7-0008",
                serialNumber="SN-DOC-MA7-0008",
                macAddress=None,
                model="Dell WD19",
                type=None,
                deviceProfile=None,
                category="Docking Station",
                supplier="TechSupplier Inc.",
                site="Ecopark A",
                status="Available",
                warrantyEndDate="2027-02-28",
                acquisitionDate="2025-03-01",
                value=165,
            ),
            # Printers
            models.Asset(
                id="asset-009",
                assetTag="PRI-SEB-0009",
                serialNumber="SN-PRI-SEB-0009",
                macAddress=None,
                model="HP LaserJet Pro M404dn",
                type=None,
                deviceProfile=None,
                category="Printer",
                supplier="OfficeGear",
                site="AS1",
                status="Available",
                warrantyEndDate="2026-11-30",
                acquisitionDate="2024-12-01",
                value=320,
            ),
            models.Asset(
                id="asset-010",
                assetTag="PRI-BOK-0010",
                serialNumber="SN-PRI-BOK-0010",
                macAddress=None,
                model="Brother HL-L6400DW",
                type=None,
                deviceProfile=None,
                category="Printer",
                supplier="OfficeGear",
                site="Bouskoura 1",
                status="Retired",
                warrantyEndDate="2025-12-31",
                acquisitionDate="2023-01-10",
                value=0,
            ),
            # APs
            models.Asset(
                id="asset-011",
                assetTag="AP-MA6-0011",
                serialNumber="SN-AP-MA6-0011",
                macAddress="10:20:30:40:50:11",
                model="Cisco Aironet 1832i",
                type=None,
                deviceProfile=None,
                category="APs",
                supplier="NetworkPro",
                site="Berrechid 2",
                status="Available",
                warrantyEndDate="2028-05-31",
                acquisitionDate="2026-02-01",
                value=420,
            ),
            models.Asset(
                id="asset-012",
                assetTag="AP-MA7-0012",
                serialNumber="SN-AP-MA7-0012",
                macAddress="10:20:30:40:50:12",
                model="Cisco Catalyst 9105AXI",
                type=None,
                deviceProfile=None,
                category="APs",
                supplier="NetworkPro",
                site="Ecopark A",
                status="Assigned",
                warrantyEndDate="2029-01-31",
                acquisitionDate="2026-03-01",
                value=530,
            ),
            # Scanners
            models.Asset(
                id="asset-013",
                assetTag="SCN-SEB-0013",
                serialNumber="SN-SCN-SEB-0013",
                macAddress=None,
                model="Fujitsu ScanSnap iX1600",
                type=None,
                deviceProfile=None,
                category="Scanner",
                supplier="OfficeGear",
                site="AS1",
                status="Available",
                warrantyEndDate="2027-09-30",
                acquisitionDate="2025-10-01",
                value=380,
            ),
            # KABA
            models.Asset(
                id="asset-014",
                assetTag="KAB-AS3-0014",
                serialNumber="SN-KAB-AS3-0014",
                macAddress=None,
                model="KABA Access Controller",
                type=None,
                deviceProfile=None,
                category="KABA",
                supplier="TechSupplier Inc.",
                site="AS3",
                status="Available",
                warrantyEndDate="2028-12-31",
                acquisitionDate="2026-01-01",
                value=900,
            ),
            # Cisco (generic)
            models.Asset(
                id="asset-015",
                assetTag="CIS-MA6-0015",
                serialNumber="SN-CIS-MA6-0015",
                macAddress=None,
                model="Cisco Switch Catalyst 9200L",
                type=None,
                deviceProfile=None,
                category="Cisco",
                supplier="NetworkPro",
                site="Berrechid 2",
                status="Available",
                warrantyEndDate="2030-12-31",
                acquisitionDate="2026-02-10",
                value=2100,
            ),
        ]

        DB.assets.seed(assets_seed, get_id=lambda a: a.id)

    DB.audit_logs.seed(
        [
            models.AuditLog(
                id="log-001",
                timestamp="2026-01-01 09:00",
                user="Admin User",
                userRole="Admin",
                userInitials="AU",
                action="CREATE",
                entity="Department",
                entityId="dept-001",
                description="Created IT Department",
                result="Success",
                ip="127.0.0.1",
                details={"source": "seed"},
            )
        ],
        get_id=lambda l: l.id,
    )
