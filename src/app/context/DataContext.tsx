import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type {
  Asset,
  Assignment,
  AuditLog,
  Category,
  Department,
  Licence,
  MaintenanceTicket,
  Site,
  StockMovement,
  Supplier,
  User,
  Vendor,
} from '../types';

import {
  createAsset,
  createAssignment,
  createAuditLog,
  createCategory,
  createDepartment,
  createLicence,
  createMaintenanceTicket,
  createMovement,
  createSite,
  createSupplier,
  createUser,
  createVendor,
  deleteCategory,
  deleteDepartment,
  deleteSite,
  deleteSupplier,
  deleteUser,
  deleteAsset,
  deleteAllAssignments,
  listAssets,
  listAssignments,
  listAuditLogs,
  listCategories,
  listDepartments,
  listLicences,
  listMaintenanceTickets,
  listMovements,
  listSites,
  listSuppliers,
  listUsers,
  listVendors,
  patchCategory,
  patchDepartment,
  patchSite,
  patchSupplier,
  patchAsset,
  patchUser,
  undoAuditLog as apiUndoAuditLog,
} from '../data/api';

import { getApiWsUrl } from '../lib/realtime';

function normalizeCategoryName(name: unknown): string {
  const n = String(name ?? '').trim();
  const key = n.toLowerCase();

  if (key === 'laptop') return 'Notebook';
  if (key === 'nb') return 'Notebook';

  if (key === 'computer') return 'Workstation';
  if (key === 'ws') return 'Workstation';

  if (key === 'printers') return 'Printer';
  if (key === 'scanners') return 'Scanner';
  if (key === 'access point') return 'APs';

  return n;
}

function sanitizeCategories(list: Category[]) {
  const byName = new Map<string, Category>();
  for (const c of list) {
    const normalizedName = normalizeCategoryName(c?.name);
    if (!normalizedName) continue;
    if (!byName.has(normalizedName)) {
      byName.set(normalizedName, { ...c, name: normalizedName });
    }
  }
  return Array.from(byName.values());
}

export type DataContextValue = {
  loading: boolean;
  error: string | null;
  refreshAll: () => Promise<void>;

  assets: Asset[];
  categories: Category[];
  sites: Site[];
  suppliers: Supplier[];
  licences: Licence[];
  users: User[];
  departments: Department[];

  stockMovements: StockMovement[];
  assignments: Assignment[];
  maintenanceTickets: MaintenanceTicket[];
  auditLogs: AuditLog[];
  vendors: Vendor[];

  addUser: (payload: (Omit<User, 'id'> & { id?: string }) & { password?: string }) => Promise<User>;
  addSite: (payload: Omit<Site, 'id'> & { id?: string }) => Promise<Site>;
  addCategory: (payload: Omit<Category, 'id'> & { id?: string }) => Promise<Category>;
  addSupplier: (payload: Omit<Supplier, 'id'> & { id?: string }) => Promise<Supplier>;
  addDepartment: (payload: Omit<Department, 'id'> & { id?: string }) => Promise<Department>;

  addLicence: (payload: Omit<Licence, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<Licence>;

  updateUser: (id: string, payload: Partial<Omit<User, 'id'>>) => Promise<User>;
  removeUser: (id: string) => Promise<void>;
  updateSite: (id: string, payload: Partial<Omit<Site, 'id'>>) => Promise<Site>;
  removeSite: (id: string) => Promise<void>;
  updateCategory: (id: string, payload: Partial<Omit<Category, 'id'>>) => Promise<Category>;
  removeCategory: (id: string) => Promise<void>;
  updateSupplier: (id: string, payload: Partial<Omit<Supplier, 'id'>>) => Promise<Supplier>;
  removeSupplier: (id: string) => Promise<void>;
  updateDepartment: (id: string, payload: Partial<Omit<Department, 'id'>>) => Promise<Department>;
  removeDepartment: (id: string) => Promise<void>;

  addAsset: (payload: Omit<Asset, 'id'> & { id?: string }) => Promise<Asset>;
  updateAsset: (id: string, payload: Partial<Omit<Asset, 'id'>>) => Promise<Asset>;
  removeAsset: (id: string) => Promise<void>;
  addMovement: (payload: Omit<StockMovement, 'id'> & { id?: string }) => Promise<StockMovement>;
  addAssignment: (payload: Omit<Assignment, 'id'> & { id?: string }) => Promise<Assignment>;
  clearAssignments: () => Promise<{ deleted: number }>;
  addMaintenanceTicket: (payload: Omit<MaintenanceTicket, 'id'> & { id?: string }) => Promise<MaintenanceTicket>;
  addVendor: (payload: Omit<Vendor, 'id'> & { id?: string }) => Promise<Vendor>;
  addAuditLog: (payload: Omit<AuditLog, 'id'> & { id?: string }) => Promise<AuditLog>;
  undoAuditLog: (id: string) => Promise<{ ok: boolean; applied: 'DELETE' | 'NOOP' | 'RESTORE' | 'REVERT'; entity: string; entityId: string }>;
};

const DATA_CONTEXT_KEY = '__PFE_DATA_CONTEXT__';
const DataContext: React.Context<DataContextValue | null> = (() => {
  const g = globalThis as any;
  if (g[DATA_CONTEXT_KEY]) return g[DATA_CONTEXT_KEY];
  const ctx = createContext<DataContextValue | null>(null);
  g[DATA_CONTEXT_KEY] = ctx;
  return ctx;
})();

function normalizeVendorSeed(v: Vendor, i: number): Vendor {
  const id = String(v.id ?? '').trim();
  if (id) return v;
  return { ...v, id: `VEN-${String(i + 1).padStart(4, '0')}` };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [licences, setLicences] = useState<Licence[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [maintenanceTickets, setMaintenanceTickets] = useState<MaintenanceTicket[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [
        assetsData,
        categoriesData,
        sitesData,
        suppliersData,
        licencesData,
        usersData,
        departmentsData,
        movementsData,
        assignmentsData,
        maintenanceTicketsData,
        auditLogsData,
        vendorsData,
      ] = await Promise.all([
        listAssets(),
        listCategories(),
        listSites(),
        listSuppliers(),
        listLicences(),
        listUsers(),
        listDepartments(),
        listMovements(),
        listAssignments(),
        listMaintenanceTickets(),
        listAuditLogs(),
        listVendors(),
      ]);

      setAssets(
        Array.isArray(assetsData)
          ? assetsData.map((a) => ({
              ...a,
              category: normalizeCategoryName((a as any)?.category),
            }))
          : [],
      );
      setCategories(sanitizeCategories(Array.isArray(categoriesData) ? categoriesData : []));
      setSites(Array.isArray(sitesData) ? sitesData : []);
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
      setLicences(Array.isArray(licencesData) ? licencesData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
      // TODO: This is a temporary data-massaging step. The backend should ideally not
      // return movements with null assetId/date, or they should be filtered in the query.
      setStockMovements(
        Array.isArray(movementsData) ? movementsData.filter((m) => m.assetId && m.date && m.type) : [],
      );
      setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
      setMaintenanceTickets(Array.isArray(maintenanceTicketsData) ? maintenanceTicketsData : []);
      setAuditLogs(Array.isArray(auditLogsData) ? auditLogsData : []);
      setVendors(Array.isArray(vendorsData) ? vendorsData.map(normalizeVendorSeed) : []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let isStopped = false;
    let reconnectTimer: number | null = null;
    let isRefreshing = false;
    let pendingScope: string | null = null;

    const mergeScope = (prev: string | null, next: string | null) => {
      const a = (prev || '').trim();
      const b = (next || '').trim();
      if (!a) return b || null;
      if (!b) return a || null;
      if (a === b) return a;
      return '*';
    };

    const runRefresh = () => {
      if (isStopped) return;
      if (isRefreshing) return;
      if (!pendingScope) return;
      const scope = pendingScope;
      pendingScope = null;
      isRefreshing = true;
      void refreshByScope(scope)
        .catch(() => {
          // ignore; next events will retry
        })
        .finally(() => {
          isRefreshing = false;
          // If something queued while we were refreshing, run again.
          if (pendingScope) runRefresh();
        });
    };

    const scheduleRefresh = (scope: string | null) => {
      pendingScope = mergeScope(pendingScope, scope);
      runRefresh();
    };

    const cleanupWs = () => {
      try {
        ws?.close();
      } catch {
        // ignore
      }
      ws = null;
    };

    const connect = () => {
      if (isStopped) return;
      cleanupWs();

      try {
        ws = new WebSocket(getApiWsUrl('/ws'));
      } catch {
        // Retry later if the URL is invalid / env not ready.
        reconnect();
        return;
      }

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev?.data ?? ''));
          if (!data || typeof data !== 'object') return;
          if (data.type === 'ping') return;
          if (data.type === 'invalidate') scheduleRefresh(String((data as any).entity ?? '') || '*');
        } catch {
          // Ignore unknown payloads
        }
      };

      ws.onclose = () => {
        if (isStopped) return;
        reconnect();
      };

      ws.onerror = () => {
        // Force close to trigger reconnect.
        cleanupWs();
        if (isStopped) return;
        reconnect();
      };
    };

    const reconnect = () => {
      if (isStopped) return;
      if (reconnectTimer != null) return;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 1000);
    };

    connect();

    return () => {
      isStopped = true;
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      cleanupWs();
    };
  }, [fetchData]);

  const refreshAll = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const refreshByScope = useCallback(
    async (scope: string | null) => {
      const s = String(scope || '').trim();
      if (!s || s === '*') {
        await refreshAll();
        return;
      }

      // Fast targeted refreshes (avoid reloading everything).
      if (s === 'Asset') {
        const apiAssets = await listAssets();
        setAssets(
          Array.isArray(apiAssets)
            ? apiAssets.map((a) => ({
                ...a,
                category: normalizeCategoryName((a as any)?.category),
              }))
            : [],
        );
        return;
      }
      if (s === 'Assignment') {
        const [apiAssignments, apiAssets] = await Promise.all([listAssignments(), listAssets()]);
        setAssignments(Array.isArray(apiAssignments) ? apiAssignments : []);
        setAssets(
          Array.isArray(apiAssets)
            ? apiAssets.map((a) => ({
                ...a,
                category: normalizeCategoryName((a as any)?.category),
              }))
            : [],
        );
        return;
      }
      if (s === 'Category') {
        const apiCategories = await listCategories();
        setCategories(sanitizeCategories(Array.isArray(apiCategories) ? apiCategories : []));
        return;
      }
      if (s === 'Department') {
        const apiDepartments = await listDepartments();
        setDepartments(Array.isArray(apiDepartments) ? apiDepartments : []);
        return;
      }
      if (s === 'Licence') {
        const apiLicences = await listLicences();
        setLicences(Array.isArray(apiLicences) ? apiLicences : []);
        return;
      }
      if (s === 'MaintenanceTicket') {
        const apiMaintenanceTickets = await listMaintenanceTickets();
        setMaintenanceTickets(Array.isArray(apiMaintenanceTickets) ? apiMaintenanceTickets : []);
        return;
      }
      if (s === 'StockMovement') {
        const apiMovements = await listMovements();
        setStockMovements(
          Array.isArray(apiMovements) ? apiMovements.filter((m) => m.assetId && m.date && m.type) : [],
        );
        return;
      }
      if (s === 'Site') {
        const apiSites = await listSites();
        setSites(Array.isArray(apiSites) ? apiSites : []);
        return;
      }
      if (s === 'Supplier') {
        const apiSuppliers = await listSuppliers();
        setSuppliers(Array.isArray(apiSuppliers) ? apiSuppliers : []);
        return;
      }
      if (s === 'User') {
        const apiUsers = await listUsers();
        setUsers(Array.isArray(apiUsers) ? apiUsers : []);
        return;
      }
      if (s === 'Vendor') {
        const apiVendors = await listVendors();
        setVendors(Array.isArray(apiVendors) ? apiVendors.map(normalizeVendorSeed) : []);
        return;
      }
      if (s === 'AuditLog') {
        const apiAuditLogs = await listAuditLogs();
        setAuditLogs(Array.isArray(apiAuditLogs) ? apiAuditLogs : []);
        return;
      }
    },
    [refreshAll],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      loading: isLoading,
      error: error?.message || null,
      refreshAll,
      assets,
      categories,
      sites,
      suppliers,
      licences,
      users,
      departments,
      stockMovements,
      assignments,
      maintenanceTickets,
      auditLogs,
      vendors,
      addUser: async (payload) => {
        const result = await createUser(payload);
        await refreshByScope('User');
        return result;
      },
      addSite: async (payload) => {
        const result = await createSite(payload);
        await refreshByScope('Site');
        return result;
      },
      addCategory: async (payload) => {
        const result = await createCategory(payload);
        await refreshByScope('Category');
        return result;
      },
      addSupplier: async (payload) => {
        const result = await createSupplier(payload);
        await refreshByScope('Supplier');
        return result;
      },
      addDepartment: async (payload) => {
        const result = await createDepartment(payload);
        await refreshByScope('Department');
        return result;
      },
      addLicence: async (payload) => {
        const result = await createLicence(payload);
        await refreshByScope('Licence');
        return result;
      },
      updateUser: async (id, payload) => {
        const result = await patchUser(id, payload);
        await refreshByScope('User');
        return result;
      },
      removeUser: async (id) => {
        await deleteUser(id);
        await refreshByScope('User');
      },
      updateSite: async (id, payload) => {
        const result = await patchSite(id, payload);
        await refreshByScope('Site');
        return result;
      },
      removeSite: async (id) => {
        await deleteSite(id);
        await refreshByScope('Site');
      },
      updateCategory: async (id, payload) => {
        const result = await patchCategory(id, payload);
        await refreshByScope('Category');
        return result;
      },
      removeCategory: async (id) => {
        await deleteCategory(id);
        await refreshByScope('Category');
      },
      updateSupplier: async (id, payload) => {
        const result = await patchSupplier(id, payload);
        await refreshByScope('Supplier');
        return result;
      },
      removeSupplier: async (id) => {
        await deleteSupplier(id);
        await refreshByScope('Supplier');
      },
      updateDepartment: async (id, payload) => {
        const result = await patchDepartment(id, payload);
        await refreshByScope('Department');
        return result;
      },
      removeDepartment: async (id) => {
        await deleteDepartment(id);
        await refreshByScope('Department');
      },
      addAsset: async (payload) => {
        const result = await createAsset(payload);
        await refreshByScope('Asset');
        return result;
      },
      updateAsset: async (id, payload) => {
        const result = await patchAsset(id, payload);
        await refreshByScope('Asset');
        return result;
      },
      removeAsset: async (id) => {
        await deleteAsset(id);
        await refreshByScope('Asset');
      },
      addMovement: async (payload) => {
        const result = await createMovement(payload);
        await refreshByScope('StockMovement');
        return result;
      },
      addAssignment: async (payload) => {
        const result = await createAssignment(payload);
        await refreshByScope('Assignment');
        return result;
      },
      clearAssignments: async () => {
        const result = await deleteAllAssignments();
        await refreshByScope('Assignment');
        return result;
      },
      addMaintenanceTicket: async (payload) => {
        const result = await createMaintenanceTicket(payload);
        await refreshByScope('MaintenanceTicket');
        return result;
      },
      addVendor: async (payload) => {
        const result = await createVendor(payload);
        await refreshByScope('Vendor');
        return result;
      },
      addAuditLog: async (payload) => {
        const result = await createAuditLog(payload);
        await refreshByScope('AuditLog');
        return result;
      },
      undoAuditLog: async (id) => {
        const result = await apiUndoAuditLog(id);
        await refreshByScope(result.entity);
        await refreshByScope('AuditLog');
        return result;
      },
    }),
    [
      isLoading,
      error,
      refreshAll,
      assets,
      categories,
      sites,
      suppliers,
      licences,
      users,
      departments,
      stockMovements,
      assignments,
      maintenanceTickets,
      auditLogs,
      vendors,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error('useData must be used within a DataProvider');
  }
  return ctx;
}
