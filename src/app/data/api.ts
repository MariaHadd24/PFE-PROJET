import type {
  Asset,
  Assignment,
  AuditLog,
  Category,
  Department,
  Equipment,
  EquipmentUser,
  KPIData,
  Licence,
  MaintenanceTicket,
  PrinterTonerEntry,
  PrinterTonerExit,
  PrinterTonerIncident,
  PrinterTonerMinQty,
  Monitor,
  PurchaseOrder,
  PurchaseRequest,
  Site,
  StockMovement,
  Supplier,
  User,
  Vendor,
} from '../types';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';

export type Create<T extends { id: string }> = Omit<T, 'id'> & { id?: string };
export type Patch<T> = Partial<T>;

export const listDepartments = () => apiGet<Department[]>('/departments?limit=1000');
export const createDepartment = (payload: Create<Department>) => apiPost<Department>('/departments', payload);
export const patchDepartment = (id: string, payload: Patch<Department>) => apiPatch<Department>(`/departments/${encodeURIComponent(id)}`, payload);
export const deleteDepartment = (id: string) => apiDelete<{ ok: boolean }>(`/departments/${encodeURIComponent(id)}`);

export const listSites = () => apiGet<Site[]>('/sites?limit=1000');
export const createSite = (payload: Create<Site>) => apiPost<Site>('/sites', payload);
export const patchSite = (id: string, payload: Patch<Site>) => apiPatch<Site>(`/sites/${encodeURIComponent(id)}`, payload);
export const deleteSite = (id: string) => apiDelete<{ ok: boolean }>(`/sites/${encodeURIComponent(id)}`);

export const listCategories = () => apiGet<Category[]>('/categories?limit=1000');
export const createCategory = (payload: Create<Category>) => apiPost<Category>('/categories', payload);
export const patchCategory = (id: string, payload: Patch<Category>) => apiPatch<Category>(`/categories/${encodeURIComponent(id)}`, payload);
export const deleteCategory = (id: string) => apiDelete<{ ok: boolean }>(`/categories/${encodeURIComponent(id)}`);

export const listSuppliers = () => apiGet<Supplier[]>('/suppliers?limit=1000');
export const createSupplier = (payload: Create<Supplier>) => apiPost<Supplier>('/suppliers', payload);
export const patchSupplier = (id: string, payload: Patch<Supplier>) => apiPatch<Supplier>(`/suppliers/${encodeURIComponent(id)}`, payload);
export const deleteSupplier = (id: string) => apiDelete<{ ok: boolean }>(`/suppliers/${encodeURIComponent(id)}`);

export const listLicences = () => apiGet<Licence[]>('/licences?limit=10000');
export type CreateLicencePayload = Omit<Licence, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
export const createLicence = (payload: CreateLicencePayload) => apiPost<Licence>('/licences', payload);
export const patchLicence = (id: string, payload: Patch<Licence>) => apiPatch<Licence>(`/licences/${encodeURIComponent(id)}`, payload);
export const deleteLicence = (id: string) => apiDelete<{ ok: boolean }>(`/licences/${encodeURIComponent(id)}`);

export const listUsers = () => apiGet<User[]>('/users?limit=1000');
export type CreateUserPayload = Create<User> & { password?: string };
export type PatchUserPayload = Patch<User> & { password?: string };
export const createUser = (payload: CreateUserPayload) => apiPost<User>('/users', payload);
export const patchUser = (id: string, payload: PatchUserPayload) => apiPatch<User>(`/users/${encodeURIComponent(id)}`, payload);
export const deleteUser = (id: string) => apiDelete<{ ok: boolean }>(`/users/${encodeURIComponent(id)}`);

export const authLogin = (payload: { email: string; password: string }) => apiPost<User>('/auth/login', payload);
export const authChangePassword = (payload: { email: string; currentPassword: string; newPassword: string }) =>
  apiPost<{ ok: boolean }>('/auth/change-password', payload);

export const listAssets = () => apiGet<Asset[]>('/assets?limit=10000');
export const getAsset = (id: string) => apiGet<Asset>(`/assets/${encodeURIComponent(id)}`);
export const createAsset = (payload: Create<Asset>) => apiPost<Asset>('/assets', payload);
export const patchAsset = (id: string, payload: Patch<Asset>) => apiPatch<Asset>(`/assets/${encodeURIComponent(id)}`, payload);
export const deleteAsset = (id: string) => apiDelete<{ ok: boolean }>(`/assets/${encodeURIComponent(id)}`);

export const listAssignments = () => apiGet<Assignment[]>('/assignments?limit=1000');
export const createAssignment = (payload: Create<Assignment>) => apiPost<Assignment>('/assignments', payload);
export const patchAssignment = (id: string, payload: Patch<Assignment>) => apiPatch<Assignment>(`/assignments/${encodeURIComponent(id)}`, payload);
export const approveAssignment = (id: string, payload: { email: string; password: string; signatureData: string }) =>
  apiPost<Assignment>(`/assignments/${encodeURIComponent(id)}/approve`, payload);
export const deleteAssignment = (id: string) => apiDelete<{ ok: boolean }>(`/assignments/${encodeURIComponent(id)}`);
export const deleteAllAssignments = () => apiDelete<{ ok: boolean; deleted: number }>('/assignments');

export const listMovements = () => apiGet<StockMovement[]>('/movements?limit=1000');
export const createMovement = (payload: Create<StockMovement>) => apiPost<StockMovement>('/movements', payload);
export const patchMovement = (id: string, payload: Patch<StockMovement>) => apiPatch<StockMovement>(`/movements/${encodeURIComponent(id)}`, payload);
export const deleteMovement = (id: string) => apiDelete<{ ok: boolean }>(`/movements/${encodeURIComponent(id)}`);

export const listMaintenanceTickets = () => apiGet<MaintenanceTicket[]>('/maintenance-tickets?limit=1000');
export const createMaintenanceTicket = (payload: Create<MaintenanceTicket>) =>
  apiPost<MaintenanceTicket>('/maintenance-tickets', payload);
export const patchMaintenanceTicket = (id: string, payload: Patch<MaintenanceTicket>) =>
  apiPatch<MaintenanceTicket>(`/maintenance-tickets/${encodeURIComponent(id)}`, payload);
export const deleteMaintenanceTicket = (id: string) =>
  apiDelete<{ ok: boolean }>(`/maintenance-tickets/${encodeURIComponent(id)}`);

export const listPurchaseRequests = () => apiGet<PurchaseRequest[]>('/purchase-requests?limit=1000');
export const createPurchaseRequest = (payload: Create<PurchaseRequest>) =>
  apiPost<PurchaseRequest>('/purchase-requests', payload);
export const patchPurchaseRequest = (id: string, payload: Patch<PurchaseRequest>) =>
  apiPatch<PurchaseRequest>(`/purchase-requests/${encodeURIComponent(id)}`, payload);
export const deletePurchaseRequest = (id: string) =>
  apiDelete<{ ok: boolean }>(`/purchase-requests/${encodeURIComponent(id)}`);

export const listPurchaseOrders = () => apiGet<PurchaseOrder[]>('/purchase-orders?limit=1000');
export const createPurchaseOrder = (payload: Create<PurchaseOrder>) =>
  apiPost<PurchaseOrder>('/purchase-orders', payload);
export const patchPurchaseOrder = (id: string, payload: Patch<PurchaseOrder>) =>
  apiPatch<PurchaseOrder>(`/purchase-orders/${encodeURIComponent(id)}`, payload);
export const deletePurchaseOrder = (id: string) =>
  apiDelete<{ ok: boolean }>(`/purchase-orders/${encodeURIComponent(id)}`);

export const listAuditLogs = () => apiGet<AuditLog[]>('/audit-logs?limit=1000');
export const createAuditLog = (payload: Create<AuditLog>) => apiPost<AuditLog>('/audit-logs', payload);
export const undoAuditLog = (id: string) =>
  apiPost<{ ok: boolean; applied: 'DELETE' | 'NOOP' | 'RESTORE' | 'REVERT'; entity: string; entityId: string }>(
    `/audit-logs/${encodeURIComponent(id)}/undo`,
    {},
  );

export const listVendors = () => apiGet<Vendor[]>('/vendors?limit=1000');
export const createVendor = (payload: Create<Vendor>) => apiPost<Vendor>('/vendors', payload);

export type ChatHistoryItem = { role: 'user' | 'assistant'; text: string };
export type ChatAction = { label: string; link: string };
export type ChatResponse = { text: string; actions?: ChatAction[]; model?: string | null };
export const chatAssistant = (payload: { message: string; history?: ChatHistoryItem[] }) =>
  apiPost<ChatResponse>('/chat', payload);

export const listPrinterTonerIncidents = () => apiGet<PrinterTonerIncident[]>('/printer-toner-incidents?limit=10000');
export const listPrinterTonerEntries = () => apiGet<PrinterTonerEntry[]>('/printer-toner-entries?limit=10000');
export const listPrinterTonerExits = () => apiGet<PrinterTonerExit[]>('/printer-toner-exits?limit=10000');
export const listPrinterTonerMinQty = () => apiGet<PrinterTonerMinQty[]>('/printer-toner-min-qty?limit=10000');

export const createPrinterTonerEntry = (payload: Create<PrinterTonerEntry>) =>
  apiPost<PrinterTonerEntry>('/printer-toner-entries', payload);

export const createPrinterTonerExit = (payload: Create<PrinterTonerExit>) =>
  apiPost<PrinterTonerExit>('/printer-toner-exits', payload);

export async function computeKpisFromAssets(assets: Asset[]): Promise<KPIData> {
  const totalAssets = assets.length;
  const available = assets.filter(a => a.status === 'Available').length;
  const assigned = assets.filter(a => a.status === 'Assigned').length;
  const inRepair = assets.filter(a => a.status === 'InRepair').length;
  const retired = assets.filter(a => a.status === 'Retired').length;
  const totalValue = assets.reduce((sum, a) => sum + (Number(a.value) || 0), 0);

  return { totalAssets, available, assigned, inRepair, retired, totalValue };
}

// New inventory structure

export const listEquipmentUsers = () => apiGet<EquipmentUser[]>('/equipment-users?limit=1000');
export const createEquipmentUser = (payload: Create<EquipmentUser>) => apiPost<EquipmentUser>('/equipment-users', payload);
export const patchEquipmentUser = (id: string, payload: Patch<EquipmentUser>) =>
  apiPatch<EquipmentUser>(`/equipment-users/${encodeURIComponent(id)}`, payload);
export const deleteEquipmentUser = (id: string) => apiDelete<{ ok: boolean }>(`/equipment-users/${encodeURIComponent(id)}`);

export const listEquipments = () => apiGet<Equipment[]>('/equipments?limit=1000');
export const createEquipment = (payload: Create<Equipment>) => apiPost<Equipment>('/equipments', payload);
export const patchEquipment = (id: string, payload: Patch<Equipment>) =>
  apiPatch<Equipment>(`/equipments/${encodeURIComponent(id)}`, payload);
export const deleteEquipment = (id: string) => apiDelete<{ ok: boolean }>(`/equipments/${encodeURIComponent(id)}`);

export const listMonitors = () => apiGet<Monitor[]>('/monitors?limit=1000');
export const createMonitor = (payload: Create<Monitor>) => apiPost<Monitor>('/monitors', payload);
export const patchMonitor = (id: string, payload: Patch<Monitor>) => apiPatch<Monitor>(`/monitors/${encodeURIComponent(id)}`, payload);
export const deleteMonitor = (id: string) => apiDelete<{ ok: boolean }>(`/monitors/${encodeURIComponent(id)}`);
