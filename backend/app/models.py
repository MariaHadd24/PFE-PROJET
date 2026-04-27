from __future__ import annotations

from typing import Annotated, Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


AssetStatus = Literal["Available", "Assigned", "InRepair", "Retired"]
MovementType = Literal["Entry", "Exit", "Transfer"]
AssignmentStatus = Literal["Pending", "Active", "Returned"]
DeviceCategory = Literal["Workstation", "Notebook", "Printer"]
PRStatus = Literal["Draft", "Pending", "Approved", "Rejected"]
POStatus = Literal["Draft", "Approved", "Ordered", "Received", "Closed"]
TicketStatus = Literal["Open", "InProgress", "Done", "Closed"]
UserRole = Literal["Admin", "Technician", "Manager", "Reader"]
AuditLogResult = Literal["Success", "Failure", "Warning"]
VendorStatus = Literal["PREFERRED", "APPROVED", "UNDER REVIEW"]
IncidentStatus = Literal["NON_INTERVENUE", "INTERVENUE"]


class Department(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    head: Optional[str] = None
    members: Optional[int] = None
    description: Optional[str] = None


class DepartmentCreate(BaseModel):
    id: Optional[str] = None
    name: str
    code: Optional[str] = None
    head: Optional[str] = None
    members: Optional[int] = 0
    description: Optional[str] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    head: Optional[str] = None
    members: Optional[int] = None
    description: Optional[str] = None


class Site(BaseModel):
    id: str
    name: str
    codeIt: Optional[str] = None
    location: str
    zone: Optional[str] = None
    city: Optional[str] = None


class SiteCreate(BaseModel):
    id: Optional[str] = None
    name: str
    codeIt: Optional[str] = None
    location: str
    zone: Optional[str] = None
    city: Optional[str] = None


class SiteUpdate(BaseModel):
    name: Optional[str] = None
    codeIt: Optional[str] = None
    location: Optional[str] = None
    zone: Optional[str] = None
    city: Optional[str] = None


class Category(BaseModel):
    id: str
    name: str


class CategoryCreate(BaseModel):
    id: Optional[str] = None
    name: str


class CategoryUpdate(BaseModel):
    name: Optional[str] = None


class Supplier(BaseModel):
    id: str
    name: str
    contact: str


class SupplierCreate(BaseModel):
    id: Optional[str] = None
    name: str
    contact: str


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact: Optional[str] = None


class User(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    avatarUrl: Optional[str] = None
    signatureNumber: Optional[str] = None
    signatureData: Optional[str] = None


class UserDB(User):
    """Database representation of a user.

    Stores a password hash in SQL Server. This field must never be exposed to
    the frontend; API routes should return `User` (public) instead.
    """

    passwordHash: Optional[str] = None


class UserCreate(BaseModel):
    id: Optional[str] = None
    name: str
    email: str
    role: UserRole
    avatarUrl: Optional[str] = None
    # Real signature image stored as a data URL (e.g. data:image/png;base64,...)
    signatureData: str = Field(min_length=10)
    signatureNumber: Optional[str] = Field(default=None, min_length=4, max_length=20)
    password: Optional[str] = Field(default=None, min_length=6, max_length=128)


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None
    avatarUrl: Optional[str] = None
    signatureNumber: Optional[str] = Field(default=None, min_length=4, max_length=20)
    signatureData: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=6, max_length=128)


class WorkstationDeviceProfile(BaseModel):
    kind: Literal["Workstation"] = "Workstation"
    hostname: Optional[str] = None
    site: Optional[str] = None
    usb_status: Optional[str] = None
    user: Optional[str] = None
    full_name: Optional[str] = None
    service: Optional[str] = None
    ws_sn: Optional[str] = None
    ws_model: Optional[str] = None
    os: Optional[str] = None
    immo_ws: Optional[str] = None
    bci_ws: Optional[str] = None
    acquisition_date: Optional[str] = None
    assignment_date: Optional[str] = None
    end_of_support_date: Optional[str] = None
    monitor_model: Optional[str] = None
    monitor_sn: Optional[str] = None
    monitor_immo: Optional[str] = None
    monitor_bci: Optional[str] = None


class NotebookDeviceProfile(BaseModel):
    kind: Literal["Notebook"] = "Notebook"
    hostname: Optional[str] = None
    site: Optional[str] = None
    usb: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    service: Optional[str] = None
    nb_sn: Optional[str] = None
    model_nb: Optional[str] = None
    mac_address: Optional[str] = None
    os: Optional[str] = None
    immo_number: Optional[str] = None
    bci: Optional[str] = None
    acquisition_date: Optional[str] = None
    assignment_date: Optional[str] = None
    end_of_support_date: Optional[str] = None
    monitor_model: Optional[str] = None
    monitor_sn: Optional[str] = None
    monitor_immo: Optional[str] = None
    monitor_bci: Optional[str] = None


DeviceProfile = Annotated[
    Union[WorkstationDeviceProfile, NotebookDeviceProfile],
    Field(discriminator="kind"),
]


class Asset(BaseModel):
    id: str
    assetTag: str
    serialNumber: str
    macAddress: Optional[str] = None
    ipAddress: Optional[str] = None
    area: Optional[str] = None
    department: Optional[str] = None
    condition: Optional[str] = None
    model: str
    type: Optional[str] = None
    deviceProfile: Optional[DeviceProfile] = None
    category: str
    supplier: str
    site: str
    status: AssetStatus
    warrantyEndDate: str
    acquisitionDate: str
    value: float

    # Extended fields used by Stock Inventory UI / Excel import
    description: Optional[str] = None
    bci: Optional[str] = None
    bce: Optional[str] = None
    bciCheck: Optional[str] = None
    vnc: Optional[str] = None
    stockIn: Optional[str] = None
    dateIn: Optional[str] = None
    pilote: Optional[str] = None
    stockOut: Optional[str] = None
    dateOut: Optional[str] = None
    immoNumber: Optional[str] = None
    pilote1: Optional[str] = None
    comment: Optional[str] = None
    barcode: Optional[str] = None
    qrCode: Optional[str] = None
    storeLocation: Optional[str] = None
    cabinet: Optional[str] = None
    rack: Optional[str] = None
    level: Optional[str] = None


class AssetCreate(BaseModel):
    id: Optional[str] = None
    assetTag: str
    serialNumber: str
    macAddress: Optional[str] = None
    ipAddress: Optional[str] = None
    area: Optional[str] = None
    department: Optional[str] = None
    condition: Optional[str] = None
    model: str
    type: Optional[str] = None
    deviceProfile: Optional[DeviceProfile] = None
    category: str
    supplier: str
    site: str
    status: AssetStatus = "Available"
    warrantyEndDate: str
    acquisitionDate: str
    value: float

    # Extended fields used by Stock Inventory UI / Excel import
    description: Optional[str] = None
    bci: Optional[str] = None
    bce: Optional[str] = None
    bciCheck: Optional[str] = None
    vnc: Optional[str] = None
    stockIn: Optional[str] = None
    dateIn: Optional[str] = None
    pilote: Optional[str] = None
    stockOut: Optional[str] = None
    dateOut: Optional[str] = None
    immoNumber: Optional[str] = None
    pilote1: Optional[str] = None
    comment: Optional[str] = None
    barcode: Optional[str] = None
    qrCode: Optional[str] = None
    storeLocation: Optional[str] = None
    cabinet: Optional[str] = None
    rack: Optional[str] = None
    level: Optional[str] = None


class AssetUpdate(BaseModel):
    assetTag: Optional[str] = None
    serialNumber: Optional[str] = None
    macAddress: Optional[str] = None
    ipAddress: Optional[str] = None
    area: Optional[str] = None
    department: Optional[str] = None
    condition: Optional[str] = None
    model: Optional[str] = None
    type: Optional[str] = None
    deviceProfile: Optional[DeviceProfile] = None
    category: Optional[str] = None
    supplier: Optional[str] = None
    site: Optional[str] = None
    status: Optional[AssetStatus] = None
    warrantyEndDate: Optional[str] = None
    acquisitionDate: Optional[str] = None
    value: Optional[float] = None

    # Extended fields used by Stock Inventory UI / Excel import
    description: Optional[str] = None
    bci: Optional[str] = None
    bce: Optional[str] = None
    bciCheck: Optional[str] = None
    vnc: Optional[str] = None
    stockIn: Optional[str] = None
    dateIn: Optional[str] = None
    pilote: Optional[str] = None
    stockOut: Optional[str] = None
    dateOut: Optional[str] = None
    immoNumber: Optional[str] = None
    pilote1: Optional[str] = None
    comment: Optional[str] = None
    barcode: Optional[str] = None
    qrCode: Optional[str] = None
    storeLocation: Optional[str] = None
    cabinet: Optional[str] = None
    rack: Optional[str] = None
    level: Optional[str] = None


class StockMovement(BaseModel):
    id: str
    assetId: str
    type: MovementType
    sourceSite: Optional[str] = None
    destinationSite: Optional[str] = None
    date: str
    user: str
    comment: str


class StockMovementCreate(BaseModel):
    id: Optional[str] = None
    assetId: str
    type: MovementType
    sourceSite: Optional[str] = None
    destinationSite: Optional[str] = None
    date: str
    user: str
    comment: str = ""


class StockMovementUpdate(BaseModel):
    assetId: Optional[str] = None
    type: Optional[MovementType] = None
    sourceSite: Optional[str] = None
    destinationSite: Optional[str] = None
    date: Optional[str] = None
    user: Optional[str] = None
    comment: Optional[str] = None


class Assignment(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: str
    assetId: Optional[str] = None
    userName: Optional[str] = None
    brand: Optional[str] = None
    area: Optional[str] = None
    department: Optional[str] = None
    site: Optional[str] = None
    startDate: Optional[str] = None
    returnDate: Optional[str] = None
    status: Optional[AssignmentStatus] = None
    approvedBy: Optional[str] = None
    approvedAt: Optional[str] = None
    approvalSignature: Optional[str] = None
    device_category: Optional[DeviceCategory] = None
    hostname: Optional[str] = None
    usb_status: Optional[str] = None
    usb: Optional[str] = None
    user: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    service: Optional[str] = None
    ws_sn: Optional[str] = None
    ws_model: Optional[str] = None
    nb_sn: Optional[str] = None
    model_nb: Optional[str] = None
    mac_address: Optional[str] = None
    os: Optional[str] = None
    immo_ws: Optional[str] = None
    immo_number: Optional[str] = None
    bci_ws: Optional[str] = None
    bci: Optional[str] = None
    acquisition_date: Optional[str] = None
    assignment_date: Optional[str] = None
    end_of_support_date: Optional[str] = None
    monitor_model: Optional[str] = None
    monitor_sn: Optional[str] = None
    monitor_immo: Optional[str] = None
    monitor_bci: Optional[str] = None


class AssignmentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: Optional[str] = None
    assetId: Optional[str] = None
    userName: Optional[str] = None
    brand: Optional[str] = None
    area: Optional[str] = None
    department: Optional[str] = None
    site: Optional[str] = None
    startDate: Optional[str] = None
    returnDate: Optional[str] = None
    status: AssignmentStatus = "Pending"
    approvedBy: Optional[str] = None
    approvedAt: Optional[str] = None
    approvalSignature: Optional[str] = None

    device_category: Optional[DeviceCategory] = None
    hostname: Optional[str] = None
    usb_status: Optional[str] = None
    usb: Optional[str] = None
    user: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    service: Optional[str] = None
    ws_sn: Optional[str] = None
    ws_model: Optional[str] = None
    nb_sn: Optional[str] = None
    model_nb: Optional[str] = None
    mac_address: Optional[str] = None
    os: Optional[str] = None
    immo_ws: Optional[str] = None
    immo_number: Optional[str] = None
    bci_ws: Optional[str] = None
    bci: Optional[str] = None
    acquisition_date: Optional[str] = None
    assignment_date: Optional[str] = None
    end_of_support_date: Optional[str] = None
    monitor_model: Optional[str] = None
    monitor_sn: Optional[str] = None
    monitor_immo: Optional[str] = None
    monitor_bci: Optional[str] = None


class AssignmentUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    assetId: Optional[str] = None
    userName: Optional[str] = None
    brand: Optional[str] = None
    area: Optional[str] = None
    department: Optional[str] = None
    site: Optional[str] = None
    startDate: Optional[str] = None
    returnDate: Optional[str] = None
    status: Optional[AssignmentStatus] = None
    approvedBy: Optional[str] = None
    approvedAt: Optional[str] = None
    approvalSignature: Optional[str] = None

    device_category: Optional[DeviceCategory] = None
    hostname: Optional[str] = None
    usb_status: Optional[str] = None
    usb: Optional[str] = None
    user: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    service: Optional[str] = None
    ws_sn: Optional[str] = None
    ws_model: Optional[str] = None
    nb_sn: Optional[str] = None
    model_nb: Optional[str] = None
    mac_address: Optional[str] = None
    os: Optional[str] = None
    immo_ws: Optional[str] = None
    immo_number: Optional[str] = None
    bci_ws: Optional[str] = None
    bci: Optional[str] = None
    acquisition_date: Optional[str] = None
    assignment_date: Optional[str] = None
    end_of_support_date: Optional[str] = None
    monitor_model: Optional[str] = None
    monitor_sn: Optional[str] = None
    monitor_immo: Optional[str] = None
    monitor_bci: Optional[str] = None


class PRLine(BaseModel):
    id: str
    product: str
    quantity: int
    estimatedPrice: float


class PRLineCreate(BaseModel):
    id: Optional[str] = None
    product: str
    quantity: int
    estimatedPrice: float


class PurchaseRequest(BaseModel):
    id: str
    requester: str
    department: str
    bce: Optional[str] = None
    bci: Optional[str] = None
    budget: float
    justification: str
    status: PRStatus
    createdDate: str
    lines: List[PRLine] = Field(default_factory=list)


class PurchaseRequestCreate(BaseModel):
    id: Optional[str] = None
    requester: str
    department: str
    bce: Optional[str] = None
    bci: Optional[str] = None
    budget: float
    justification: str
    status: PRStatus = "Draft"
    createdDate: str
    lines: List[PRLineCreate] = Field(default_factory=list)


class PurchaseRequestUpdate(BaseModel):
    requester: Optional[str] = None
    department: Optional[str] = None
    bce: Optional[str] = None
    bci: Optional[str] = None
    budget: Optional[float] = None
    justification: Optional[str] = None
    status: Optional[PRStatus] = None
    createdDate: Optional[str] = None
    lines: Optional[List[PRLineCreate]] = None


class POLine(BaseModel):
    id: str
    product: str
    quantity: int
    price: float


class POLineCreate(BaseModel):
    id: Optional[str] = None
    product: str
    quantity: int
    price: float


class PurchaseOrder(BaseModel):
    id: str
    prId: str
    bce: Optional[str] = None
    bci: Optional[str] = None
    supplier: str
    status: POStatus
    total: float
    createdDate: str
    lines: List[POLine] = Field(default_factory=list)


class PurchaseOrderCreate(BaseModel):
    id: Optional[str] = None
    prId: str
    bce: Optional[str] = None
    bci: Optional[str] = None
    supplier: str
    status: POStatus = "Draft"
    total: float
    createdDate: str
    lines: List[POLineCreate] = Field(default_factory=list)


class PurchaseOrderUpdate(BaseModel):
    prId: Optional[str] = None
    bce: Optional[str] = None
    bci: Optional[str] = None
    supplier: Optional[str] = None
    status: Optional[POStatus] = None
    total: Optional[float] = None
    createdDate: Optional[str] = None
    lines: Optional[List[POLineCreate]] = None


class MaintenanceTicket(BaseModel):
    id: str
    assetId: str
    status: TicketStatus
    provider: str
    cost: float
    openDate: str
    closeDate: Optional[str] = None
    description: str
    actions: Optional[str] = None


class MaintenanceTicketCreate(BaseModel):
    id: Optional[str] = None
    assetId: str
    status: TicketStatus = "Open"
    provider: str
    cost: float = 0
    openDate: str
    closeDate: Optional[str] = None
    description: str
    actions: Optional[str] = None


class MaintenanceTicketUpdate(BaseModel):
    assetId: Optional[str] = None
    status: Optional[TicketStatus] = None
    provider: Optional[str] = None
    cost: Optional[float] = None
    openDate: Optional[str] = None
    closeDate: Optional[str] = None
    description: Optional[str] = None
    actions: Optional[str] = None


class AuditLog(BaseModel):
    id: str
    timestamp: str
    user: str
    userRole: Optional[str] = None
    userInitials: Optional[str] = None
    action: str
    entity: str
    entityId: Optional[str] = None
    description: Optional[str] = None
    result: AuditLogResult
    ip: str
    details: Optional[Dict[str, Any]] = None


class AuditLogCreate(BaseModel):
    id: Optional[str] = None
    timestamp: str
    user: str
    userRole: Optional[str] = None
    userInitials: Optional[str] = None
    action: str
    entity: str
    entityId: Optional[str] = None
    description: Optional[str] = None
    result: AuditLogResult = "Success"
    ip: str = "127.0.0.1"
    details: Optional[Dict[str, Any]] = None


class AuditLogUpdate(BaseModel):
    timestamp: Optional[str] = None
    user: Optional[str] = None
    userRole: Optional[str] = None
    userInitials: Optional[str] = None
    action: Optional[str] = None
    entity: Optional[str] = None
    entityId: Optional[str] = None
    description: Optional[str] = None
    result: Optional[AuditLogResult] = None
    ip: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class Vendor(BaseModel):
    id: str
    name: str
    category: str
    status: VendorStatus
    email: str
    phone: str
    totalSpend: float
    activeContracts: int
    rating: float
    compliant: bool


class VendorCreate(BaseModel):
    id: Optional[str] = None
    name: str
    category: str
    status: VendorStatus = "APPROVED"
    email: str
    phone: str
    totalSpend: float = 0
    activeContracts: int = 0
    rating: float = 4.5
    compliant: bool = True


class VendorUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    status: Optional[VendorStatus] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    totalSpend: Optional[float] = None
    activeContracts: Optional[int] = None
    rating: Optional[float] = None
    compliant: Optional[bool] = None


class Licence(BaseModel):
    id: str
    name: str
    plant: str
    key: str
    manufacturer: str
    purchaseDate: str
    expiryDate: str
    supplier: str
    createdAt: str
    updatedAt: str


class LicenceCreate(BaseModel):
    id: Optional[str] = None
    name: str
    plant: str
    key: str
    manufacturer: str
    purchaseDate: str
    expiryDate: str
    supplier: str
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class LicenceUpdate(BaseModel):
    name: Optional[str] = None
    plant: Optional[str] = None
    key: Optional[str] = None
    manufacturer: Optional[str] = None
    purchaseDate: Optional[str] = None
    expiryDate: Optional[str] = None
    supplier: Optional[str] = None
    # Allow patching timestamps but backend will keep them consistent.
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class KPIData(BaseModel):
    totalAssets: int
    available: int
    assigned: int
    inRepair: int
    retired: int
    totalValue: float


class PrinterTonerIncident(BaseModel):
    id: str
    site: Optional[str] = None
    printerName: Optional[str] = None
    demandType: Optional[str] = None
    ticketNumber: Optional[str] = None
    problemNature: Optional[str] = None
    printerSerial: Optional[str] = None
    printerModel: Optional[str] = None
    claimDate: Optional[str] = None
    interventionDate: Optional[str] = None
    duration: Optional[str] = None
    status: IncidentStatus = "NON_INTERVENUE"
    raw: Optional[Dict[str, Any]] = None
    rawHeaders: Optional[List[str]] = None


class PrinterTonerIncidentCreate(BaseModel):
    id: Optional[str] = None
    site: Optional[str] = None
    printerName: Optional[str] = None
    demandType: Optional[str] = None
    ticketNumber: Optional[str] = None
    problemNature: Optional[str] = None
    printerSerial: Optional[str] = None
    printerModel: Optional[str] = None
    claimDate: Optional[str] = None
    interventionDate: Optional[str] = None
    duration: Optional[str] = None
    status: IncidentStatus = "NON_INTERVENUE"
    raw: Optional[Dict[str, Any]] = None
    rawHeaders: Optional[List[str]] = None


class PrinterTonerIncidentUpdate(BaseModel):
    site: Optional[str] = None
    printerName: Optional[str] = None
    demandType: Optional[str] = None
    ticketNumber: Optional[str] = None
    problemNature: Optional[str] = None
    printerSerial: Optional[str] = None
    printerModel: Optional[str] = None
    claimDate: Optional[str] = None
    interventionDate: Optional[str] = None
    duration: Optional[str] = None
    status: Optional[IncidentStatus] = None
    raw: Optional[Dict[str, Any]] = None
    rawHeaders: Optional[List[str]] = None


class PrinterTonerEntry(BaseModel):
    id: str
    date: Optional[str] = None
    article: Optional[str] = None
    articleCode: Optional[str] = None
    quantity: int = 0


class PrinterTonerEntryCreate(BaseModel):
    id: Optional[str] = None
    date: Optional[str] = None
    article: Optional[str] = None
    articleCode: Optional[str] = None
    quantity: int = 0


class PrinterTonerEntryUpdate(BaseModel):
    date: Optional[str] = None
    article: Optional[str] = None
    articleCode: Optional[str] = None
    quantity: Optional[int] = None


class PrinterTonerExit(BaseModel):
    id: str
    date: Optional[str] = None
    article: Optional[str] = None
    articleCode: Optional[str] = None
    quantity: int = 0


class PrinterTonerExitCreate(BaseModel):
    id: Optional[str] = None
    date: Optional[str] = None
    article: Optional[str] = None
    articleCode: Optional[str] = None
    quantity: int = 0


class PrinterTonerExitUpdate(BaseModel):
    date: Optional[str] = None
    article: Optional[str] = None
    articleCode: Optional[str] = None
    quantity: Optional[int] = None


class PrinterTonerMinQty(BaseModel):
    id: str
    ref: str
    color: str
    minQty: int


class PrinterTonerMinQtyCreate(BaseModel):
    id: Optional[str] = None
    ref: str
    color: str
    minQty: int


class PrinterTonerMinQtyUpdate(BaseModel):
    ref: Optional[str] = None
    color: Optional[str] = None
    minQty: Optional[int] = None
