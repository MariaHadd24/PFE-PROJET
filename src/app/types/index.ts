// Asset Management Types

export type AssetStatus = 'Available' | 'Assigned' | 'InRepair' | 'Retired';
export type MovementType = 'Entry' | 'Exit' | 'Transfer';
export type AssignmentStatus = 'Pending' | 'Active' | 'Returned';
export type PRStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected';
export type POStatus = 'Draft' | 'Approved' | 'Ordered' | 'Received' | 'Closed';
export type TicketStatus = 'Open' | 'InProgress' | 'Done' | 'Closed';
export type UserRole = 'Admin' | 'Technician' | 'Manager' | 'Reader';

export type AuditLogResult = 'Success' | 'Failure' | 'Warning';

export type VendorStatus = 'PREFERRED' | 'APPROVED' | 'UNDER REVIEW';

export type DeviceProfileKind = 'Workstation' | 'Notebook';

export interface WorkstationDeviceProfile {
  kind: 'Workstation';
  hostname?: string;
  site?: string;
  usb_status?: string;
  user?: string;
  full_name?: string;
  service?: string;
  ws_sn?: string;
  ws_model?: string;
  os?: string;
  immo_ws?: string;
  bci_ws?: string;
  acquisition_date?: string;
  assignment_date?: string;
  end_of_support_date?: string;
  monitor_model?: string;
  monitor_sn?: string;
  monitor_immo?: string;
  monitor_bci?: string;
}

export interface NotebookDeviceProfile {
  kind: 'Notebook';
  hostname?: string;
  site?: string;
  usb?: string;
  username?: string;
  full_name?: string;
  service?: string;
  nb_sn?: string;
  model_nb?: string;
  mac_address?: string;
  os?: string;
  immo_number?: string;
  bci?: string;
  acquisition_date?: string;
  assignment_date?: string;
  end_of_support_date?: string;
  monitor_model?: string;
  monitor_sn?: string;
  monitor_immo?: string;
  monitor_bci?: string;
}

export type DeviceProfile = WorkstationDeviceProfile | NotebookDeviceProfile;

export interface Asset {
  id: string;
  assetTag: string;
  serialNumber: string;
  macAddress?: string;
  ipAddress?: string;
  area?: string;
  department?: string;
  condition?: string;
  model: string;
  type?: string;
  deviceProfile?: DeviceProfile;
  category: string;
  supplier: string;
  site: string;
  status: AssetStatus;
  warrantyEndDate: string;
  acquisitionDate: string;
  value: number;

  // Extended fields used by Stock Inventory UI / Excel import
  description?: string;
  bci?: string;
  bce?: string;
  bciCheck?: string;
  vnc?: string;
  stockIn?: string;
  dateIn?: string;
  pilote?: string;
  stockOut?: string;
  dateOut?: string;
  immoNumber?: string;
  pilote1?: string;
  comment?: string;
  barcode?: string;
  qrCode?: string;
  storeLocation?: string;
  cabinet?: string;
  rack?: string;
  level?: string;
}

export interface StockMovement {
  id: string;
  assetId: string;
  type: MovementType;
  sourceSite?: string;
  destinationSite?: string;
  date: string;
  user: string;
  comment: string;
}

export interface Assignment {
  id: string;
  assetId?: string | null;
  userName?: string | null;
  brand?: string;
  area?: string | null;
  department?: string | null;
  site?: string | null;
  startDate?: string | null;
  returnDate?: string;
  status?: AssignmentStatus;
  approvedBy?: string;
  approvedAt?: string;
  approvalSignature?: string;

  device_category?: 'Workstation' | 'Notebook' | 'Printer';
  hostname?: string;
  usb_status?: string;
  usb?: string;
  user?: string;
  username?: string;
  full_name?: string;
  service?: string;
  ws_sn?: string;
  ws_model?: string;
  nb_sn?: string;
  model_nb?: string;
  mac_address?: string;
  os?: string;
  immo_ws?: string;
  immo_number?: string;
  bci_ws?: string;
  bci?: string;
  acquisition_date?: string;
  assignment_date?: string;
  end_of_support_date?: string;
  monitor_model?: string;
  monitor_sn?: string;
  monitor_immo?: string;
  monitor_bci?: string;
}

export interface PurchaseRequest {
  id: string;
  requester: string;
  department: string;
  bce?: string;
  bci?: string;
  budget: number;
  justification: string;
  status: PRStatus;
  createdDate: string;
  lines: PRLine[];
}

export interface PRLine {
  id: string;
  product: string;
  quantity: number;
  estimatedPrice: number;
}

export interface PurchaseOrder {
  id: string;
  prId: string;
  bce?: string;
  bci?: string;
  supplier: string;
  status: POStatus;
  total: number;
  createdDate: string;
  lines: POLine[];
}

export interface POLine {
  id: string;
  product: string;
  quantity: number;
  price: number;
}

export interface MaintenanceTicket {
  id: string;
  assetId: string;
  status: TicketStatus;
  provider: string;
  cost: number;
  openDate: string;
  closeDate?: string;
  description: string;
  actions?: string;
}

export interface Licence {
  id: string;
  name: string;
  plant: string;
  key: string;
  manufacturer: string;
  purchaseDate: string;
  expiryDate: string;
  supplier: string;
  createdAt: string;
  updatedAt: string;
}

export interface Site {
  id: string;
  name: string;
  codeIt?: string;
  location: string;
  zone?: string;
  city?: string;
}

export interface Department {
  id: string;
  name: string;
  code?: string;
  head?: string;
  members?: number;
  description?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  signatureData?: string;
}

export interface KPIData {
  totalAssets: number;
  available: number;
  assigned: number;
  inRepair: number;
  retired: number;
  totalValue: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  userRole?: string;
  userInitials?: string;
  action: string;
  entity: string;
  entityId?: string;
  description?: string;
  result: AuditLogResult;
  ip: string;
  details?: Record<string, unknown>;
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  status: VendorStatus;
  email: string;
  phone: string;
  totalSpend: number;
  activeContracts: number;
  rating: number;
  compliant: boolean;
}

export interface PrinterTonerIncident {
  id: string;
  site?: string | null;
  printerName?: string | null;
  demandType?: string | null;
  ticketNumber?: string | null;
  problemNature?: string | null;
  printerSerial?: string | null;
  printerModel?: string | null;
  claimDate?: string | null;
  interventionDate?: string | null;
  duration?: string | null;
  status?: 'NON_INTERVENUE' | 'INTERVENUE' | null;
  raw?: Record<string, unknown> | null;
  rawHeaders?: string[] | null;
}

export interface PrinterTonerEntry {
  id: string;
  date?: string | null;
  article?: string | null;
  articleCode?: string | null;
  quantity: number;
}

export interface PrinterTonerExit {
  id: string;
  date?: string | null;
  article?: string | null;
  articleCode?: string | null;
  quantity: number;
}

export interface PrinterTonerMinQty {
  id: string;
  ref: string;
  color: string;
  minQty: number;
}
