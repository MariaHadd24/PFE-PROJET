import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { AlertTriangle, ChevronDown, ChevronUp, Columns3, Download, Filter, Plus, Save, Search, Trash2, Upload, X } from 'lucide-react';
import type { AssetStatus, StockMovement } from '../types';
import { AddStockAssetModal } from '../components/ui/AddStockAssetModal';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '../components/ui/pagination';
import { useNotifications } from '../context/NotificationContext';
import { useData } from '../context/DataContext';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { createAsset, patchAsset } from '../data/api';
import { useAuth } from '../context/AuthContext';
import { canPerformAction } from '../lib/rbac';

const OBSOLETE_TAB = 'Obsolete';
const END_OF_LIFE_YEARS = 5;

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

function parseDate(value: unknown): Date | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const ms = Date.parse(s);
  if (!Number.isNaN(ms)) return new Date(ms);
  return null;
}

function isEndOfLifeByAge(inServiceDate: unknown): boolean {
  const d = parseDate(inServiceDate);
  if (!d) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - END_OF_LIFE_YEARS);
  return d.getTime() <= cutoff.getTime();
}

function isAssetObsolete(asset: any): boolean {
  const status = String(asset?.status ?? '').trim();
  if (status === 'Retired') return true;
  return isEndOfLifeByAge(asset?.dateOut);
}

const pageContainerVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: EASE_OUT, when: 'beforeChildren', staggerChildren: 0.05 },
  },
};

const pageItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE_OUT } },
};

const statusStyles: Record<AssetStatus, string> = {
  Available: 'bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
  InRepair: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200',
  Retired: 'bg-red-100 text-red-700 dark:bg-red-900/25 dark:text-red-200'
};

type StockRow = {
  rowId: string;
  assetId: string;
  type: string;
  model: string;
  sn: string;
  department: string;
  condition: string;
  ipAddress: string;
  barcode: string;
  qrCode: string;
  macAddress: string;
  status: AssetStatus;
  description: string;
  bci: string;
  bce: string;
  bciCheck: string;
  vnc: string;
  plant: string;
  store: string;
  cabinet: string;
  rack: string;
  level: string;
  stockIn: string;
  dateIn: string;
  pilote: string;
  stockOut: string;
  dateOut: string;
  immoNumber: string;
  pilote1: string;
  comment: string;
  detailsLink: string;
};

type StockColumnKey = Exclude<keyof StockRow, 'detailsLink' | 'rowId'>;

const stockColumns: Array<{ key: StockColumnKey; label: string; align?: 'left' | 'right' }> = [
  { key: 'assetId', label: 'Asset ID' },
  { key: 'type', label: 'Type' },
  { key: 'model', label: 'Model' },
  { key: 'sn', label: 'SN' },
  { key: 'department', label: 'Department' },
  { key: 'condition', label: 'Condition' },
  { key: 'ipAddress', label: 'IP' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'qrCode', label: 'QR Code' },
  { key: 'macAddress', label: 'MAC' },
  { key: 'status', label: 'Status' },
  { key: 'description', label: 'Description' },
  { key: 'bci', label: 'BCI' },
  { key: 'bce', label: 'BCE' },
  { key: 'bciCheck', label: 'BCI Check' },
  { key: 'vnc', label: 'VNC' },
  { key: 'plant', label: 'Plant' },
  { key: 'store', label: 'Store' },
  { key: 'cabinet', label: 'Cabinet' },
  { key: 'rack', label: 'Rack' },
  { key: 'level', label: 'Level' },
  { key: 'stockIn', label: 'Stock IN' },
  { key: 'dateIn', label: 'Date IN' },
  { key: 'pilote', label: 'Pilote' },
  { key: 'stockOut', label: 'Stock OUT' },
  { key: 'dateOut', label: 'Date OUT' },
  { key: 'immoNumber', label: 'Immo Number' },
  { key: 'pilote1', label: 'Pilote 1' },
  { key: 'comment', label: 'Comment' },
];

async function exportStockToExcel(rows: StockRow[], typeHeaderLabel: string = 'Type') {
  const XLSX = await import('xlsx');
  const json = rows.map((r) => ({
    'Asset ID': r.assetId,
    [typeHeaderLabel]: r.type,
    'Model': r.model,
    'SN': r.sn,
    'Department': r.department,
    'Condition': r.condition,
    'IP': r.ipAddress,
    'Barcode': r.barcode,
    'QR Code': r.qrCode,
    'MAC': r.macAddress,
    'Status': r.status,
    'Description': r.description,
    'BCI': r.bci,
    'BCE': r.bce,
    'BCI Check': r.bciCheck,
    'VNC': r.vnc,
    'Plant': r.plant,
    'Magasin': r.store,
    'Armoire': r.cabinet,
    'Rack': r.rack,
    'Étage': r.level,
    'Stock IN': r.stockIn,
    'Date IN': r.dateIn,
    'Pilote': r.pilote,
    'Stock OUT': r.stockOut,
    'Date OUT': r.dateOut,
    'Immo Number': r.immoNumber,
    'Pilote 1': r.pilote1,
    'Comment': r.comment,
  }));

  const ws = XLSX.utils.json_to_sheet(json);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stock');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'stock-inventory.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getLastMovement(movements: StockMovement[], assetId: string, type: StockMovement['type']) {
  const ms = movements
    .filter((m) => m.assetId === assetId && m.type === type)
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return ms[0];
}

type SortDir = 'asc' | 'desc';
type SortState = { key: StockColumnKey; dir: SortDir };

type StockView = {
  id: string;
  name: string;
  createdAt: number;
  state: {
    activeCategory: string;
    searchTerm: string;
    filterStatus: AssetStatus | '';
    filterSite: string;
    filterSupplier: string;
    valueMin: string;
    valueMax: string;
    sort: SortState;
    columnKeys: StockColumnKey[];
    pageSize: number;
  };
};

const STOCK_VIEWS_KEY = 'leoni-stock-views-v1';
const STOCK_COLUMNS_KEY = 'leoni-stock-columns-v1';

function safeJsonParse<T>(input: string | null): T | null {
  if (!input) return null;
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function compareValues(a: unknown, b: unknown) {
  const as = String(a ?? '').trim();
  const bs = String(b ?? '').trim();

  const an = Number(as);
  const bn = Number(bs);
  if (Number.isFinite(an) && Number.isFinite(bn) && as !== '' && bs !== '') {
    return an - bn;
  }

  const ad = Date.parse(as);
  const bd = Date.parse(bs);
  const aIsDate = !Number.isNaN(ad) && /\d/.test(as);
  const bIsDate = !Number.isNaN(bd) && /\d/.test(bs);
  if (aIsDate && bIsDate) return ad - bd;

  return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
}

function normalizeHeaderKey(key: unknown) {
  const raw = String(key ?? '').trim().toLowerCase();
  // Make Excel header matching resilient to punctuation/formatting differences
  // Examples: "BCI/BCE" -> "bci bce", "BCI-WS" -> "bci ws", "S/N" -> "s n"
  // Also removes diacritics: "étage" -> "etage".
  const noDiacritics = raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return noDiacritics.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function pickString(row: Record<string, any>, keys: string[]) {
  for (const k of keys) {
    const kk = normalizeHeaderKey(k);
    if (kk in row) {
      const v = row[kk];
      const s = String(v ?? '').trim();
      if (s) return s;
    }
  }
  return '';
}

function toOptionalString(input: any): string | null {
  const s = String(input ?? '').trim();
  return s ? s : null;
}

function parseExcelDateToIso(value: any): string {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    // Excel serial date
    const utc = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (fr) {
    const dd = fr[1].padStart(2, '0');
    const mm = fr[2].padStart(2, '0');
    const yyyy = fr[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return raw;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return '';
}

function addYearsIso(dateIso: string, years: number): string {
  const raw = String(dateIso ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return '';

  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCFullYear(d.getUTCFullYear() + (Number.isFinite(years) ? years : 0));
  return d.toISOString().slice(0, 10);
}

function normalizeStatus(input: string): AssetStatus {
  const s = String(input ?? '').trim().toLowerCase();
  if (!s) return 'Available';
  if (s === 'assigned' || s === 'in use' || s === 'inuse') return 'Assigned';
  if (s === 'inrepair' || s === 'in repair' || s === 'repair') return 'InRepair';
  if (s === 'retired' || s === 'disposed' || s === 'discarded') return 'Retired';
  return 'Available';
}

function normalizeCategory(input: unknown): string {
  const s = String(input ?? '').trim();
  if (!s) return '';
  const key = s.toLowerCase();
  if (key === 'laptop') return 'Notebook';
  if (key === 'nb') return 'Notebook';
  if (key === 'computer') return 'Workstation';
  if (key === 'ws') return 'Workstation';
  if (key === 'printers') return 'Printer';
  if (key === 'scanners') return 'Scanner';
  if (key === 'access point') return 'APs';
  if (key === 'terminal ip kaba') return 'Kaba';
  if (key === 'terminal ip') return 'Kaba';
  return s;
}

function normalizeCategoryTabLabel(input: unknown): string {
  const s = String(input ?? '').trim();
  if (!s) return '';
  const key = s.toLowerCase();
  if (key === 'computer') return 'Workstation';
  if (key === 'laptop') return 'Notebook';
  if (key === 'printers') return 'Printer';
  if (key === 'scanner' || key === 'scanners') return 'Scanners';
  if (key === 'terminal ip kaba') return 'Kaba';
  if (key === 'terminal ip') return 'Kaba';
  return s;
}

function normalizeTabKey(input: unknown): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const HIDDEN_STOCK_TABS = new Set(
  [
    'hp',
    'zebra',
    'cradle',
    'barcode scanner',
    'pistolet',
  ].map(normalizeTabKey),
);

const SCANNER_FAMILY_TABS = new Set(['Scanners', 'Cradle', 'Barcode Scanner', 'Pistolet']);

function isScannerFamilyTab(tabName: string): boolean {
  return SCANNER_FAMILY_TABS.has(normalizeCategoryTabLabel(tabName));
}

function isPrinterConsumableRow(asset: any): boolean {
  // Stock sheets sometimes include printer supplies (toner) under a "Printer" section.
  // Example rows: assetTag like "SN-W9130MC" with type = "noir/cyan/jaune/magenta".
  // We hide those from the Printer tab to keep only actual printers.
  const type = String(asset?.type ?? '').trim().toLowerCase();
  const assetTag = String(asset?.assetTag ?? '').trim().toLowerCase();
  const model = String(asset?.model ?? '').trim().toLowerCase();
  const serialNumber = String(asset?.serialNumber ?? '').trim().toLowerCase();

  // Hard match on known toner IDs.
  // Seen in the UI: SN-W9130MC..SN-W9133MC and SN-W9240MC..SN-W9243MC.
  if (/^sn-w(?:913[0-3]|924[0-3])mc$/.test(assetTag)) return true;
  if (/^w(?:913[0-3]|924[0-3])mc$/.test(model)) return true;
  if (/^w(?:913[0-3]|924[0-3])mc$/.test(serialNumber)) return true;

  const isColor = type === 'noir' || type === 'black' || type === 'cyan' || type === 'jaune' || type === 'yellow' || type === 'magenta';
  if (!isColor) return false;

  // Common toner codes: W9130 / W9131 / W9240... and stock IDs prefixed with SN-
  const looksLikeTonerCode = /^w\d{4}[a-z0-9-]*$/.test(model) || /^w\d{4}[a-z0-9-]*$/.test(serialNumber);
  const looksLikeStockTonerId = assetTag.startsWith('sn-w') || serialNumber.startsWith('sn-w');

  return looksLikeTonerCode || looksLikeStockTonerId;
}

function inferCiscoNetworkDeviceType(input: {
  model?: unknown;
  description?: unknown;
  category?: unknown;
  supplier?: unknown;
  type?: unknown;
}): string {
  const existing = String(input.type ?? '').trim();
  if (existing) return existing;

  const model = String(input.model ?? '').trim();
  const description = String(input.description ?? '').trim();
  const category = String(input.category ?? '').trim();
  const supplier = String(input.supplier ?? '').trim();

  const hay = `${model} ${description} ${category} ${supplier}`.toLowerCase();
  if (!hay.trim()) return '';

  const looksCisco =
    hay.includes('cisco') ||
    /^c(91|92|93|94|95|96|98|83|82)\d*/i.test(model) ||
    /\bair-/.test(hay) ||
    /\bcatalyst\b/.test(hay);
  if (!looksCisco) return '';

  // Wireless Controllers
  if (hay.includes('wireless controller') || /\bwlc\b/.test(hay) || /\bc9800\b/.test(hay) || /\bc9800-/.test(hay)) {
    return 'Wireless Controller';
  }

  // Access Points
  if (
    hay.includes('access point') ||
    /\bair-/.test(hay) ||
    /\bc91\d{2}\b/.test(hay) ||
    /\bc91\d{2}[a-z0-9-]*\b/.test(hay)
  ) {
    return 'Access Point';
  }

  // Routers
  if (
    hay.includes('router') ||
    /\bc83\d{2}\b/.test(hay) ||
    /\bc82\d{2}\b/.test(hay) ||
    /\bisr\b/.test(hay) ||
    /\basr\b/.test(hay)
  ) {
    return 'Router';
  }

  // Switches (Catalyst, etc.)
  if (
    hay.includes('switch') ||
    /\bc(?:9200|9300|9400|9500|9600)[a-z0-9-]*\b/.test(hay) ||
    /\bc(?:2960|3560|3650|3750|3850)[a-z0-9-]*\b/.test(hay)
  ) {
    return 'Switch';
  }

  // If it's Cisco but we can't infer, keep empty (UI will show '-')
  return '';
}

function inferBrandFromModel(input: { model?: unknown; type?: unknown }): string {
  const existing = String(input.type ?? '').trim();
  if (existing) return existing;

  const modelRaw = String(input.model ?? '').trim();
  if (!modelRaw) return '';

  const model = modelRaw.toLowerCase();
  const upperToken = (token: string) => token.toUpperCase();

  // Common printer / IT brands
  if (model.includes('brother')) return 'Brother';
  if (model.includes('kyocera')) return 'KYOCERA';
  if (model.includes('zebra') || /\bzt\d{3,4}\b/.test(model)) return 'ZEBRA';
  if (model.includes('hp') || model.includes('laserjet') || model.includes('officejet')) return 'HP';
  if (model.includes('canon')) return 'Canon';
  if (model.includes('epson')) return 'Epson';
  if (model.includes('xerox')) return 'Xerox';
  if (model.includes('ricoh')) return 'Ricoh';
  if (model.includes('konica')) return 'Konica';

  // Workstations / notebooks
  if (model.includes('dell')) return 'Dell';
  if (model.includes('lenovo')) return 'Lenovo';
  if (model.includes('asus')) return upperToken('asus');
  if (model.includes('acer')) return 'Acer';
  if (model.includes('huawei')) return 'Huawei';
  if (model.includes('samsung')) return 'Samsung';
  if (model.includes('microsoft') || model.includes('surface')) return 'Microsoft';
  if (model.includes('apple') || model.includes('macbook') || model.includes('imac')) return 'Apple';

  // Fallback: if model starts with a known-looking brand token
  const first = modelRaw.split(/\s+/g)[0]?.trim();
  if (!first) return '';
  const firstKey = first.toLowerCase();
  if (['hp', 'dell', 'lenovo', 'acer', 'asus', 'brother', 'canon', 'epson', 'xerox', 'ricoh', 'zebra'].includes(firstKey)) {
    if (firstKey === 'hp') return 'HP';
    if (firstKey === 'asus') return 'ASUS';
    if (firstKey === 'zebra') return 'ZEBRA';
    return first.charAt(0).toUpperCase() + first.slice(1);
  }

  return '';
}

function pickValue(row: Record<string, any>, keys: string[]) {
  for (const k of keys) {
    const kk = normalizeHeaderKey(k);
    if (kk in row) return row[kk];
  }
  return undefined;
}

function pickDateIso(row: Record<string, any>, keys: string[]): string {
  const v = pickValue(row, keys);
  return parseExcelDateToIso(v);
}

function buildDeviceProfileFromRow(
  row: Record<string, any>,
  kind: 'Workstation' | 'Notebook',
  siteFallback: string,
) {
  const profile: Record<string, any> = { kind };

  const set = (key: string, value: any) => {
    const s = String(value ?? '').trim();
    if (s) profile[key] = s;
  };
  const setFrom = (key: string, keys: string[]) => set(key, pickString(row, keys));
  const setDate = (key: string, keys: string[]) => {
    const iso = pickDateIso(row, keys);
    if (iso) profile[key] = iso;
  };

  setFrom('hostname', ['hostname', 'host name', 'host']);
  setFrom('site', ['site', 'plant', 'location']);

  if (kind === 'Workstation') {
    setFrom('usb_status', ['usb status', 'usb_status', 'usbstatus']);
    setFrom('user', ['user', 'utilisateur']);
    setFrom('full_name', ['full name', 'full_name', 'fullname', 'nom complet', 'name']);
    setFrom('service', ['service', 'department']);
    setFrom('ws_sn', ['ws sn', 'ws_sn', 'workstation sn', 'workstation serial']);
    setFrom('ws_model', ['ws model', 'ws_model', 'workstation model']);
    setFrom('os', ['os', 'operating system', 'system']);
    setFrom('immo_ws', ['immo ws', 'immo_ws', 'immo workstation']);
    setFrom('bci_ws', ['bci ws', 'bci_ws', 'bci workstation']);
  } else {
    setFrom('usb', ['usb']);
    setFrom('username', ['username', 'user name', 'login']);
    setFrom('full_name', ['full name', 'full_name', 'fullname', 'nom complet', 'name']);
    setFrom('service', ['service', 'department']);
    setFrom('nb_sn', ['nb sn', 'nb_sn', 'notebook sn', 'laptop sn']);
    setFrom('model_nb', ['model nb', 'model_nb', 'notebook model', 'laptop model']);
    setFrom('mac_address', ['mac address', 'mac_address', 'mac']);
    setFrom('os', ['os', 'operating system', 'system']);
    setFrom('immo_number', ['immo number', 'immo_number', 'immo', 'immobilisation', 'immo no']);
    setFrom('bci', ['bci', 'bci nb', 'bci notebook', 'bci laptop']);
  }

  setDate('acquisition_date', ['acquisition date', 'acquisition_date', 'acquisition']);
  setDate('assignment_date', ['assignment date', 'assignment_date', 'assigned date']);
  setDate('end_of_support_date', ['end of support date', 'end_of_support_date', 'eos', 'end of support']);

  setFrom('monitor_model', ['monitor model', 'monitor_model']);
  setFrom('monitor_sn', ['monitor sn', 'monitor_sn', 'monitor serial']);
  setFrom('monitor_immo', ['monitor immo', 'monitor_immo', 'monitor immobilisation']);
  setFrom('monitor_bci', ['monitor bci', 'monitor_bci']);

  if (!profile.site) {
    const s = String(siteFallback ?? '').trim();
    if (s && s !== '-') profile.site = s;
  }

  return Object.keys(profile).length > 1 ? profile : null;
}

async function importStockInventoryFromExcel() {
  const candidates = ['/MA6-Stock%20Inventory.xlsx', '/Inventory-MA6.xlsx'];

  let arrayBuffer: ArrayBuffer | null = null;
  let lastStatus: number | null = null;

  for (const fileUrl of candidates) {
    const res = await fetch(fileUrl);
    lastStatus = res.status;
    if (res.ok) {
      arrayBuffer = await res.arrayBuffer();
      break;
    }
  }

  if (!arrayBuffer) {
    throw new Error(`Unable to load Excel file (last HTTP ${lastStatus ?? 'unknown'})`);
  }

  const XLSX = await import('xlsx');
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetNames = Array.isArray(wb.SheetNames) ? wb.SheetNames.filter(Boolean) : [];
  if (sheetNames.length === 0) return { assets: [], sections: [] };

  const normalizeRows = (rawRows: Array<Record<string, any>>) =>
    rawRows.map((r) => {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(r)) {
        out[normalizeHeaderKey(k)] = v;
      }
      return out;
    });

  const mapRows = (rows: Array<Record<string, any>>, sheetName: string, offset: number) =>
    rows
      .map((r, idx) => {
        const model = pickString(r, ['model', 'asset name', 'name', 'designation']);
        const serialNumber = pickString(r, ['sn', 'serial number', 'serial', 's/n']);
        const assetTag = pickString(r, ['asset id', 'asset tag', 'asset', 'id']) || serialNumber;

        // If category is not present in the sheet, use sheet name as a section/category.
        const category = pickString(r, ['category', 'cat']) || String(sheetName || '').trim() || 'Notebook';
        const site = pickString(r, ['plant', 'location', 'site']) || '-';
        const status = normalizeStatus(pickString(r, ['status']));

        const normalizedCategory = normalizeCategory(category) || category;
        const deviceProfile =
          normalizedCategory === 'Workstation'
            ? buildDeviceProfileFromRow(r, 'Workstation', site)
            : normalizedCategory === 'Notebook'
              ? buildDeviceProfileFromRow(r, 'Notebook', site)
              : null;

        const description = pickString(r, ['description', 'descriptio', 'desc', 'designation']);
        const bci = pickString(r, ['bci', 'bci ws', 'bci_ws', 'bci workstation']);
        const bce = pickString(r, ['bce', 'bce ws', 'bce_ws', 'bce workstation']);
        const bciCheck = pickString(r, ['bci check', 'bcicheck', 'bci_check', 'check bci', 'bci validation']);
        const vnc = pickString(r, ['vnc']);
        const immoNumber = pickString(r, ['immo number', 'immo', 'immobilisation', 'immo no']);
        const pilote = pickString(r, ['pilote', 'pilot', 'assigned to', 'pilote (assigned to)']);
        const pilote1 = pickString(r, ['pilote 1', 'pilot 1', 'secondary']);
        const comment = pickString(r, ['comment', 'comments', 'remark', 'remarks', 'remarque']);

        const stockIn = pickString(r, ['stock in', 'stockin', 'in']);
        const stockOut = pickString(r, ['stock out', 'stockout', 'out']);
        const dateIn = parseExcelDateToIso(r['date in'] || r['datein']);
        const dateOut = parseExcelDateToIso(r['date out'] || r['dateout']);

        const typeFromFile = pickString(r, ['type']);
        const inferredType = inferCiscoNetworkDeviceType({
          model,
          description,
          category,
          supplier: pickString(r, ['supplier']),
          type: typeFromFile,
        });
        const type = inferredType;
        const macAddress = pickString(r, ['mac', 'mac address']);
        const ipAddress = pickString(r, ['ip', 'ip address', 'ipaddress', 'adresse ip', 'ipv4']);
        const department = pickString(r, ['department', 'departement', 'dept', 'direction', 'service']);
        const condition = pickString(r, ['condition', 'etat', 'state']);

        const barcode = pickString(r, ['barcode', 'bar code', 'code barre', 'code-barres']);
        const qrCode = pickString(r, ['qr', 'qr code', 'qrcode', 'qr-code']);

        const store = pickString(r, ['magasin', 'store', 'store location', 'storage']);
        const cabinet = pickString(r, ['armoire', 'cabinet']);
        const rack = pickString(r, ['rack']);
        const level = pickString(r, ['etage', 'étage', 'level', 'floor']);

        const hasAnyData =
          Boolean(assetTag) ||
          Boolean(model) ||
          Boolean(serialNumber) ||
          Boolean(department) ||
          Boolean(condition) ||
          Boolean(description) ||
          Boolean(bci) ||
          Boolean(bce) ||
          Boolean(bciCheck) ||
          Boolean(vnc) ||
          Boolean(site && site !== '-') ||
          Boolean(stockIn) ||
          Boolean(stockOut) ||
          Boolean(dateIn) ||
          Boolean(dateOut) ||
          Boolean(type) ||
          Boolean(macAddress) ||
          Boolean(ipAddress) ||
          Boolean(barcode) ||
          Boolean(qrCode) ||
          Boolean(store) ||
          Boolean(cabinet) ||
          Boolean(rack) ||
          Boolean(level);

        if (!hasAnyData) return null;

        const acquisitionDate = parseExcelDateToIso(r['acquisition date'] || r['acquisition']) || dateIn;
        const warrantyEndDate =
          parseExcelDateToIso(
            r['warranty expiry'] || r['warranty expiration'] || r['warranty end'] || r['warranty'],
          ) ||
          (acquisitionDate ? addYearsIso(acquisitionDate, 1) || '' : '');

        const value = (() => {
          const raw = String(vnc || r['value'] || '').replace(',', '.').trim();
          const n = Number(raw);
          return Number.isFinite(n) ? n : 0;
        })();

        return {
          id: String(r['internal id'] || r['id'] || assetTag || serialNumber || `ROW-${offset + idx + 1}`),
          assetTag: assetTag || `MA6-${offset + idx + 1}`,
          serialNumber: serialNumber || `SN-${offset + idx + 1}`,
          model: model || assetTag || serialNumber || `MA6-${offset + idx + 1}`,
          category,
          supplier: pickString(r, ['supplier']) || '-',
          site,
          status,
          acquisitionDate: acquisitionDate || new Date().toISOString().slice(0, 10),
          warrantyEndDate: warrantyEndDate || new Date().toISOString().slice(0, 10),
          value,

          deviceProfile,

          // Extended fields used by Stock Inventory UI
          description,
          bci,
          bce,
          bciCheck,
          vnc,
          immoNumber,
          pilote,
          pilote1,
          stockIn,
          stockOut,
          dateIn,
          dateOut,
          comment,
          type,
          macAddress,
          ipAddress,
          department,
          condition,
          barcode,
          qrCode,
          storeLocation: store,
          cabinet,
          rack,
          level,

          // Keep provenance if you need to debug mapping
          section: sheetName,
        };
      })
      .filter((a) => Boolean(a) && (String((a as any).assetTag ?? '').trim() || String((a as any).serialNumber ?? '').trim()));

  const all: any[] = [];
  let offset = 0;

  for (const sheetName of sheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
    if (!Array.isArray(rawRows) || rawRows.length === 0) continue;
    const rows = normalizeRows(rawRows);
    const mapped = mapRows(rows, sheetName, offset);
    offset += mapped.length;
    all.push(...mapped);
  }

  // Merge/enrich by key so multiple sheets can contribute attributes.
  const keyOf = (a: any) => {
    const tag = String(a.assetTag ?? '').trim().toLowerCase();
    const sn = String(a.serialNumber ?? '').trim().toLowerCase();
    return tag ? `tag:${tag}` : `sn:${sn}`;
  };

  const merged = new Map<string, any>();
  for (const item of all) {
    const key = keyOf(item);
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, item);
      continue;
    }

    const next = { ...prev };
    for (const [k, v] of Object.entries(item)) {
      const cur = (next as any)[k];
      const hasCur = cur != null && String(cur).trim() !== '';
      const hasNew = v != null && String(v).trim() !== '';
      if (!hasCur && hasNew) {
        (next as any)[k] = v;
      }
    }
    merged.set(key, next);
  }

  return { assets: Array.from(merged.values()), sections: sheetNames };
}

async function importStockInventoryFromArrayBuffer(arrayBuffer: ArrayBuffer) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetNames = Array.isArray(wb.SheetNames) ? wb.SheetNames.filter(Boolean) : [];
  if (sheetNames.length === 0) return { assets: [], sections: [], duplicateSerials: 0 };

  const normalizeRows = (rawRows: Array<Record<string, any>>) =>
    rawRows.map((r) => {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(r)) {
        out[normalizeHeaderKey(k)] = v;
      }
      return out;
    });

  const mapRows = (rows: Array<Record<string, any>>, sheetName: string, offset: number) =>
    rows
      .map((r, idx) => {
        const model = pickString(r, ['model', 'asset name', 'name', 'designation']);
        const serialNumber = pickString(r, ['sn', 'serial number', 'serial', 's/n']);
        const assetTag = pickString(r, ['asset id', 'asset tag', 'asset', 'id']) || serialNumber;

        const category = pickString(r, ['category', 'cat']) || String(sheetName || '').trim() || 'Notebook';
        const site = pickString(r, ['plant', 'location', 'site']) || '-';
        const status = normalizeStatus(pickString(r, ['status']));

        const normalizedCategory = normalizeCategory(category) || category;
        const deviceProfile =
          normalizedCategory === 'Workstation'
            ? buildDeviceProfileFromRow(r, 'Workstation', site)
            : normalizedCategory === 'Notebook'
              ? buildDeviceProfileFromRow(r, 'Notebook', site)
              : null;

        const description = pickString(r, ['description', 'descriptio', 'desc', 'designation']);
        const bci = pickString(r, ['bci', 'bci ws', 'bci_ws', 'bci workstation']);
        const bce = pickString(r, ['bce', 'bce ws', 'bce_ws', 'bce workstation']);
        const bciCheck = pickString(r, ['bci check', 'bcicheck', 'bci_check', 'check bci', 'bci validation']);
        const vnc = pickString(r, ['vnc']);
        const immoNumber = pickString(r, ['immo number', 'immo', 'immobilisation', 'immo no']);
        const pilote = pickString(r, ['pilote', 'pilot', 'assigned to', 'pilote (assigned to)']);
        const pilote1 = pickString(r, ['pilote 1', 'pilot 1', 'secondary']);
        const comment = pickString(r, ['comment', 'comments', 'remark', 'remarks', 'remarque']);

        const stockIn = pickString(r, ['stock in', 'stockin', 'in']);
        const stockOut = pickString(r, ['stock out', 'stockout', 'out']);
        const dateIn = parseExcelDateToIso(r['date in'] || r['datein']);
        const dateOut = parseExcelDateToIso(r['date out'] || r['dateout']);

        const typeFromFile = pickString(r, ['type']);
        const inferredType = inferCiscoNetworkDeviceType({
          model,
          description,
          category,
          supplier: pickString(r, ['supplier']),
          type: typeFromFile,
        });
        const type = inferredType;
        const macAddress = pickString(r, ['mac', 'mac address']);
        const ipAddress = pickString(r, ['ip', 'ip address', 'ipaddress', 'adresse ip', 'ipv4']);
        const department = pickString(r, ['department', 'departement', 'dept', 'direction', 'service']);
        const condition = pickString(r, ['condition', 'etat', 'state']);

        const barcode = pickString(r, ['barcode', 'bar code', 'code barre', 'code-barres']);
        const qrCode = pickString(r, ['qr', 'qr code', 'qrcode', 'qr-code']);
        const store = pickString(r, ['magasin', 'store', 'store location', 'storage']);
        const cabinet = pickString(r, ['armoire', 'cabinet']);
        const rack = pickString(r, ['rack']);
        const level = pickString(r, ['etage', 'étage', 'level', 'floor']);

        const hasAnyData =
          Boolean(assetTag) ||
          Boolean(model) ||
          Boolean(serialNumber) ||
          Boolean(department) ||
          Boolean(condition) ||
          Boolean(description) ||
          Boolean(bci) ||
          Boolean(bce) ||
          Boolean(bciCheck) ||
          Boolean(vnc) ||
          Boolean(site && site !== '-') ||
          Boolean(stockIn) ||
          Boolean(stockOut) ||
          Boolean(dateIn) ||
          Boolean(dateOut) ||
          Boolean(type) ||
          Boolean(macAddress) ||
          Boolean(ipAddress) ||
          Boolean(barcode) ||
          Boolean(qrCode) ||
          Boolean(store) ||
          Boolean(cabinet) ||
          Boolean(rack) ||
          Boolean(level);

        if (!hasAnyData) return null;

        const acquisitionDate = parseExcelDateToIso(r['acquisition date'] || r['acquisition']) || dateIn;
        const warrantyEndDate =
          parseExcelDateToIso(
            r['warranty expiry'] || r['warranty expiration'] || r['warranty end'] || r['warranty'],
          ) ||
          (acquisitionDate ? addYearsIso(acquisitionDate, 1) || '' : '');

        const value = (() => {
          const raw = String(vnc || r['value'] || '').replace(',', '.').trim();
          const n = Number(raw);
          return Number.isFinite(n) ? n : 0;
        })();

        return {
          id: String(r['internal id'] || r['id'] || assetTag || serialNumber || `ROW-${offset + idx + 1}`),
          assetTag: assetTag || `MA6-${offset + idx + 1}`,
          serialNumber: serialNumber || `SN-${offset + idx + 1}`,
          model: model || assetTag || serialNumber || `MA6-${offset + idx + 1}`,
          category,
          supplier: pickString(r, ['supplier']) || '-',
          site,
          status,
          acquisitionDate: acquisitionDate || new Date().toISOString().slice(0, 10),
          warrantyEndDate: warrantyEndDate || new Date().toISOString().slice(0, 10),
          value,

          deviceProfile,

          description,
          bci,
          bce,
          bciCheck,
          vnc,
          immoNumber,
          pilote,
          pilote1,
          stockIn,
          stockOut,
          dateIn,
          dateOut,
          comment,
          type,
          macAddress,
          ipAddress,
          department,
          condition,

          barcode,
          qrCode,
          storeLocation: store,
          cabinet,
          rack,
          level,

          section: sheetName,
        };
      })
      .filter((a) => Boolean(a) && (String((a as any).assetTag ?? '').trim() || String((a as any).serialNumber ?? '').trim()));

  const all: any[] = [];
  let offset = 0;
  for (const sheetName of sheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
    if (!Array.isArray(rawRows) || rawRows.length === 0) continue;
    const rows = normalizeRows(rawRows);
    const mapped = mapRows(rows, sheetName, offset);
    offset += mapped.length;
    all.push(...mapped);
  }

  const keyOf = (a: any) => {
    const tag = String(a.assetTag ?? '').trim().toLowerCase();
    const sn = String(a.serialNumber ?? '').trim().toLowerCase();
    return tag ? `tag:${tag}` : `sn:${sn}`;
  };

  const merged = new Map<string, any>();
  for (const item of all) {
    const key = keyOf(item);
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, item);
      continue;
    }

    const next = { ...prev };
    for (const [k, v] of Object.entries(item)) {
      const cur = (next as any)[k];
      const hasCur = cur != null && String(cur).trim() !== '';
      const hasNew = v != null && String(v).trim() !== '';
      if (!hasCur && hasNew) {
        (next as any)[k] = v;
      }
    }
    merged.set(key, next);
  }

  // Dedupe by serialNumber globally (enterprise rule)
  const bySerial = new Map<string, any>();
  let duplicates = 0;
  for (const a of merged.values()) {
    const sn = String((a as any).serialNumber ?? '').trim().toLowerCase();
    if (!sn) {
      bySerial.set(`__no_sn__:${String((a as any).assetTag ?? '').trim().toLowerCase()}`, a);
      continue;
    }
    const prev = bySerial.get(sn);
    if (!prev) {
      bySerial.set(sn, a);
      continue;
    }

    duplicates += 1;
    const next = { ...prev };
    for (const [k, v] of Object.entries(a)) {
      const cur = (next as any)[k];
      const hasCur = cur != null && String(cur).trim() !== '';
      const hasNew = v != null && String(v).trim() !== '';
      if (!hasCur && hasNew) (next as any)[k] = v;
    }
    bySerial.set(sn, next);
  }

  return { assets: Array.from(bySerial.values()), sections: sheetNames, duplicateSerials: duplicates };
}

function dedupeAssetsBySerial(list: any[]): { assets: any[]; duplicates: number } {
  const byKey = new Map<string, any>();
  let duplicates = 0;

  for (const a of list) {
    const sn = String(a?.serialNumber ?? '').trim().toLowerCase();
    const fallback = String(a?.assetTag ?? a?.id ?? '').trim().toLowerCase();
    const key = sn ? `sn:${sn}` : `fb:${fallback}`;

    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, a);
      continue;
    }

    duplicates += 1;
    const next = { ...prev };
    for (const [k, v] of Object.entries(a ?? {})) {
      const cur = (next as any)[k];
      const hasCur = cur != null && String(cur).trim() !== '';
      const hasNew = v != null && String(v).trim() !== '';
      if (!hasCur && hasNew) (next as any)[k] = v;
    }
    byKey.set(key, next);
  }

  return { assets: Array.from(byKey.values()), duplicates };
}

export function StockInventoryPage() {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const { addNotification } = useNotifications();
  const { assets, categories, sites, assignments, stockMovements, addAsset, refreshAll } = useData();
  const { user } = useAuth();
  const role = user?.role ?? 'Reader';
  const canManageInventory = canPerformAction(role, 'manage_inventory');
  const canUseSavedViews = role !== 'Reader';

  const stockViewsStorageKey = useMemo(() => {
    const base = STOCK_VIEWS_KEY;
    const rawUserKey = String(user?.id || user?.email || '').trim().toLowerCase();
    return rawUserKey ? `${base}:${rawUserKey}` : base;
  }, [user?.email, user?.id]);

  const mergeAssetsByIdentity = (primary: any[], secondary: any[]) => {
    const keyOf = (a: any) => {
      const tag = String(a?.assetTag ?? '').trim().toLowerCase();
      const sn = String(a?.serialNumber ?? '').trim().toLowerCase();
      if (tag) return `tag:${tag}`;
      if (sn) return `sn:${sn}`;
      const id = String(a?.id ?? '').trim().toLowerCase();
      return id ? `id:${id}` : '';
    };

    const map = new Map<string, any>();
    const order: string[] = [];

    const put = (a: any) => {
      const k = keyOf(a);
      if (!k) return;
      if (!map.has(k)) order.push(k);
      map.set(k, a);
    };

    for (const a of Array.isArray(primary) ? primary : []) {
      put(a);
    }

    for (const b of Array.isArray(secondary) ? secondary : []) {
      const k = keyOf(b);
      if (!k) continue;
      const prev = map.get(k);
      if (!prev) {
        order.push(k);
        map.set(k, b);
        continue;
      }

      const next = { ...prev };
      for (const [field, value] of Object.entries(b ?? {})) {
        const cur = (next as any)[field];
        const hasCur = cur != null && String(cur).trim() !== '';
        const hasNew = value != null && String(value).trim() !== '';
        if (!hasCur && hasNew) (next as any)[field] = value;
      }
      map.set(k, next);
    }

    return order.map((k) => map.get(k)).filter(Boolean);
  };

  const isAlreadyExistsError = (err: unknown) => {
    const msg = String((err as any)?.message ?? err ?? '').toLowerCase();
    return (
      msg.includes('already exists') ||
      msg.includes('duplicate') ||
      msg.includes('cannot insert duplicate key') ||
      msg.includes('violation of unique')
    );
  };

  const upsertImportedAssetsToBackend = async (rows: any[]) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { created: 0, updated: 0, skipped: 0, failed: 0 };
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    const byTag = new Map<string, any>();
    const bySn = new Map<string, any>();
    for (const a of assets as any[]) {
      const tag = String(a?.assetTag ?? '').trim().toLowerCase();
      const sn = String(a?.serialNumber ?? '').trim().toLowerCase();
      if (tag) byTag.set(tag, a);
      if (sn) bySn.set(sn, a);
    }

    const batchSize = 10;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (row) => {
          const payload = toBackendAssetPayload(row);
          if (!payload.assetTag || !payload.serialNumber) {
            throw new Error('Missing assetTag/serialNumber');
          }
          try {
            const createdAsset = await createAsset(payload as any);
            const t = String(createdAsset?.assetTag ?? '').trim().toLowerCase();
            const s = String(createdAsset?.serialNumber ?? '').trim().toLowerCase();
            if (t) byTag.set(t, createdAsset);
            if (s) bySn.set(s, createdAsset);
            return { kind: 'created', asset: createdAsset };
          } catch (err) {
            if (!isAlreadyExistsError(err)) throw err;

            const tagKey = String(payload.assetTag ?? '').trim().toLowerCase();
            const snKey = String(payload.serialNumber ?? '').trim().toLowerCase();
            const existing = byTag.get(tagKey) || bySn.get(snKey);
            if (!existing?.id) {
              return { kind: 'skipped' };
            }

            const patch = toBackendAssetPatch(payload);
            const updatedAsset = await patchAsset(String(existing.id), patch as any);
            const t = String(updatedAsset?.assetTag ?? existing.assetTag ?? '').trim().toLowerCase();
            const s = String(updatedAsset?.serialNumber ?? existing.serialNumber ?? '').trim().toLowerCase();
            if (t) byTag.set(t, updatedAsset);
            if (s) bySn.set(s, updatedAsset);
            return { kind: 'updated', asset: updatedAsset };
          }
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          if ((r.value as any)?.kind === 'created') created += 1;
          else if ((r.value as any)?.kind === 'updated') updated += 1;
          else skipped += 1;
        } else {
          failed += 1;
        }
      }
    }

    return { created, updated, skipped, failed };
  };

  const toBackendAssetPayload = (row: any) => {
    const today = new Date().toISOString().slice(0, 10);
    const assetTag = String(row?.assetTag ?? row?.assetId ?? row?.id ?? '').trim() || String(row?.serialNumber ?? '').trim();
    const serialNumber = String(row?.serialNumber ?? row?.sn ?? '').trim() || assetTag;
    const category = normalizeCategory(row?.category ?? row?.section) || 'Notebook';
    const supplier = String(row?.supplier ?? '').trim() || '-';
    const site = String(row?.site ?? row?.plant ?? '').trim() || '-';
    const model = String(row?.model ?? '').trim() || assetTag || serialNumber || 'Unknown';
    const status = normalizeStatus(String(row?.status ?? ''));
    const acquisitionDate = String(row?.acquisitionDate ?? '').trim().slice(0, 10) || today;
    const warrantyEndDate = String(row?.warrantyEndDate ?? '').trim().slice(0, 10) || today;
    const value = (() => {
      const n = Number(row?.value ?? 0);
      return Number.isFinite(n) ? n : 0;
    })();

    const deviceProfile = (() => {
      const dp = row?.deviceProfile;
      if (!dp) return null;
      const kind = String((dp as any)?.kind ?? '').trim();
      if (!kind) return null;
      // Only keep for the assignable device categories
      if (kind !== 'Workstation' && kind !== 'Notebook') return null;
      return dp;
    })();

    const payload: any = {
      assetTag,
      serialNumber,
      macAddress: String(row?.macAddress ?? '').trim() || null,
      ipAddress: toOptionalString(row?.ipAddress),
      department: toOptionalString(row?.department),
      condition: toOptionalString(row?.condition),
      model,
      type: String(row?.type ?? '').trim() || null,
      category,
      supplier,
      site,
      status,
      warrantyEndDate,
      acquisitionDate,
      value,

      // Extended fields
      description: toOptionalString(row?.description),
      bci: toOptionalString(row?.bci),
      bce: toOptionalString(row?.bce),
      bciCheck: toOptionalString(row?.bciCheck),
      vnc: toOptionalString(row?.vnc),
      stockIn: toOptionalString(row?.stockIn),
      dateIn: toOptionalString(row?.dateIn),
      pilote: toOptionalString(row?.pilote),
      stockOut: toOptionalString(row?.stockOut),
      dateOut: toOptionalString(row?.dateOut),
      immoNumber: toOptionalString(row?.immoNumber),
      pilote1: toOptionalString(row?.pilote1),
      comment: toOptionalString(row?.comment),
      barcode: toOptionalString(row?.barcode),
      qrCode: toOptionalString(row?.qrCode),
      storeLocation: toOptionalString(row?.storeLocation),
      cabinet: toOptionalString(row?.cabinet),
      rack: toOptionalString(row?.rack),
      level: toOptionalString(row?.level),
    };

    if (deviceProfile) {
      payload.deviceProfile = deviceProfile;
    }

    return payload;
  };

  const toBackendAssetPatch = (payload: any) => {
    const patch: any = {
      category: payload.category,
      supplier: payload.supplier,
      site: payload.site,
      status: payload.status,
      model: payload.model,
      type: payload.type,
      macAddress: payload.macAddress,
      ipAddress: payload.ipAddress,
      department: payload.department,
      condition: payload.condition,
      warrantyEndDate: payload.warrantyEndDate,
      acquisitionDate: payload.acquisitionDate,
      value: payload.value,

      // Extended fields
      description: payload.description,
      bci: payload.bci,
      bce: payload.bce,
      bciCheck: payload.bciCheck,
      vnc: payload.vnc,
      stockIn: payload.stockIn,
      dateIn: payload.dateIn,
      pilote: payload.pilote,
      stockOut: payload.stockOut,
      dateOut: payload.dateOut,
      immoNumber: payload.immoNumber,
      pilote1: payload.pilote1,
      comment: payload.comment,
      barcode: payload.barcode,
      qrCode: payload.qrCode,
      storeLocation: payload.storeLocation,
      cabinet: payload.cabinet,
      rack: payload.rack,
      level: payload.level,
    };

    // Only patch deviceProfile when we have one, to avoid wiping existing data.
    if (payload?.deviceProfile) {
      patch.deviceProfile = payload.deviceProfile;
    }

    return patch;
  };

  const [activeCategory, setActiveCategory] = useState<string>('');

  const typeColumnLabel = useMemo(() => {
    const normalized = normalizeCategory(activeCategory);
    if (normalized === 'Printer' || normalized === 'Notebook' || normalized === 'Workstation') return 'Brand';
    if (normalized === 'Scanner') return 'TYPE';
    return 'Type';
  }, [activeCategory]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<AssetStatus | ''>('');
  const [filterSite, setFilterSite] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [valueMin, setValueMin] = useState('');
  const [valueMax, setValueMax] = useState('');

  const [sort, setSort] = useState<SortState>({ key: 'assetId', dir: 'asc' });
  const [columnKeys, setColumnKeys] = useState<StockColumnKey[]>([]);

  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());

  const [views, setViews] = useState<StockView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string>('');
  const [newViewName, setNewViewName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const loadingTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!canUseSavedViews) {
      setViews([]);
      setActiveViewId('');
      return;
    }
    const parsed = safeJsonParse<StockView[]>(localStorage.getItem(stockViewsStorageKey));
    setViews(Array.isArray(parsed) ? parsed : []);
    setActiveViewId('');
  }, [canUseSavedViews, stockViewsStorageKey]);

  const [pageSize, setPageSize] = useState<number>(20);
  const [pageIndex, setPageIndex] = useState<number>(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assetsList, setAssetsList] = useState(assets);
  const [excelAssets, setExcelAssets] = useState<any[]>([]);
  const [excelSections, setExcelSections] = useState<string[]>([]);

  useEffect(() => {
    if (excelSections.length > 0) return;
    setAssetsList(assets);
  }, [assets, excelSections.length]);

  useEffect(() => {
    // In Excel fallback mode, keep backend-created assets visible too.
    if (excelSections.length === 0) return;
    if (!Array.isArray(excelAssets) || excelAssets.length === 0) return;
    setAssetsList(mergeAssetsByIdentity(Array.isArray(assets) ? assets : [], excelAssets));
  }, [assets, excelAssets, excelSections.length]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const LOW_STOCK_KEY = 'leoni-low-stock-thresholds-v1';
  const LOW_STOCK_NOTIFY_KEY = 'leoni-low-stock-notify-v1';
  const [lowStockThresholds, setLowStockThresholds] = useState<Record<string, number>>(() => {
    const parsed = safeJsonParse<Record<string, number>>(localStorage.getItem(LOW_STOCK_KEY));
    return parsed && typeof parsed === 'object' ? parsed : {};
  });
  const [isThresholdsOpen, setIsThresholdsOpen] = useState(false);

  const categoryTabs = useMemo(() => {
    if (excelSections.length > 0) {
      const fromExcel = excelSections.map(normalizeCategoryTabLabel).filter(Boolean);
      const fromAssets = (assetsList || [])
        .map((a) => normalizeCategoryTabLabel((a as any).category))
        .filter(Boolean);
      const base = Array.from(new Set([...fromExcel, ...fromAssets]))
        .filter((name) => {
          const k = normalizeTabKey(name);
          if (HIDDEN_STOCK_TABS.has(k)) return false;
          // Catch variations like "TERMINAL IP ..."
          if (k.startsWith('terminal ip')) return false;
          return true;
        })
        .sort((a, b) => a.localeCompare(b));

      return base.includes(OBSOLETE_TAB) ? base : [...base, OBSOLETE_TAB];
    }
    const fromAssets = Array.from(
      new Set(
        assetsList
          .map((a) => normalizeCategoryTabLabel((a as any).category))
          .filter(Boolean),
      ),
    )
      .filter((name) => {
        const k = normalizeTabKey(name);
        if (HIDDEN_STOCK_TABS.has(k)) return false;
        if (k.startsWith('terminal ip')) return false;
        return true;
      })
      .sort((a, b) => a.localeCompare(b));

    if (fromAssets.length > 0) return fromAssets.includes(OBSOLETE_TAB) ? fromAssets : [...fromAssets, OBSOLETE_TAB];
    return categories
      .map((c) => normalizeCategoryTabLabel(c.name))
      .filter((name) => {
        const k = normalizeTabKey(name);
        if (HIDDEN_STOCK_TABS.has(k)) return false;
        if (k.startsWith('terminal ip')) return false;
        return true;
      })
      .concat(OBSOLETE_TAB);
  }, [assetsList, excelSections]);

  const defaultCategory = useMemo(() => categoryTabs[0] ?? '', [categoryTabs]);

  const appliedNavFilterKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const rawState = (location as any)?.state as any;
    const filter = rawState?.stockInventoryFilter as
      | { activeCategory?: unknown; searchTerm?: unknown }
      | undefined;
    if (!filter) return;

    // Wait until tabs are available so category validation/normalization works.
    if (categoryTabs.length === 0) return;

    const rawLocationKey = String((location as any)?.key ?? '');
    const applyKey =
      rawLocationKey ||
      JSON.stringify({ pathname: (location as any)?.pathname ?? '', filter });
    if (appliedNavFilterKeyRef.current === applyKey) return;

    const requestedCategory = String(filter.activeCategory ?? '').trim();
    const requestedSearch = String(filter.searchTerm ?? '').trim();

    setSearchTerm(requestedSearch);

    if (requestedCategory) {
      const normalizedRequested = normalizeCategoryTabLabel(requestedCategory);
      const normalizedMap = new Map(
        categoryTabs.map((tab) => [normalizeCategoryTabLabel(tab), tab] as const)
      );

      const matched =
        categoryTabs.includes(requestedCategory)
          ? requestedCategory
          : normalizedMap.get(normalizedRequested) ??
            categoryTabs.find((tab) => tab.toLowerCase() === requestedCategory.toLowerCase());

      if (matched) setActiveCategory(matched);
    }

    appliedNavFilterKeyRef.current = applyKey;
  }, [categoryTabs, location, setActiveCategory, setSearchTerm]);

  useEffect(() => {
    if (!activeCategory) return;
    if (categoryTabs.includes(activeCategory)) return;

    const normalizedTab = normalizeCategoryTabLabel(activeCategory);
    if (normalizedTab && categoryTabs.includes(normalizedTab)) {
      setActiveCategory(normalizedTab);
    } else {
      setActiveCategory(defaultCategory);
    }
  }, [activeCategory, categoryTabs, defaultCategory]);

   useEffect(() => {
    const navState = location.state as any;
    const navFilter = navState?.stockInventoryFilter;

    // No "All Stock" view: default to the first category tab.
    if (activeCategory || navFilter) return; // <-- ADD || navFilter HERE
    if (!defaultCategory) return;
    setActiveCategory(defaultCategory);
  }, [activeCategory, defaultCategory, location.state]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // If backend is reachable and in SQL Server mode, do NOT override UI data with a local Excel file.
      // The SQL Server backend becomes the source of truth.
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const json = await res.json();
          const storage = String((json as any)?.storage ?? '').trim().toLowerCase();
          if (storage === 'sqlserver') return;
        }
      } catch {
        // ignore and try local Excel fallback below
      }

      try {
        const imported = await importStockInventoryFromExcel();
        if (cancelled) return;
        if (Array.isArray((imported as any)?.assets) && (imported as any).assets.length > 0) {
          const rawAssets = (imported as any).assets as any[];
          const deduped = dedupeAssetsBySerial(rawAssets);
          setExcelAssets(deduped.assets);
          setAssetsList(mergeAssetsByIdentity(Array.isArray(assets) ? assets : [], deduped.assets));
          setExcelSections(Array.isArray((imported as any).sections) ? (imported as any).sections : []);

          // Keep the rest of the app consistent: in non-SQLServer mode, also upsert
          // the fallback Excel assets into the backend (in-memory) so Assignments sees them.
          try {
            const res = await fetch('/api/assets?limit=10000');
            const existing = res.ok ? await res.json() : [];
            const existingCount = Array.isArray(existing) ? existing.length : 0;
            if (existingCount < deduped.assets.length) {
              await upsertImportedAssetsToBackend(deduped.assets);
              await refreshAll();
            }
          } catch {
            // ignore: keep Stock Inventory UI usable even if backend sync fails
          }
        }
      } catch {
        // File not present or unreadable: keep backend data.
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const categoriesForThresholds = useMemo(() => {
    const set = new Set<string>();
    for (const a of assetsList) {
      const cat = String((a as any).category ?? '').trim();
      if (cat) set.add(cat);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [assetsList]);

  const lowStockItems = useMemo(() => {
    const availableByCategory = new Map<string, number>();
    for (const a of assetsList) {
      const cat = String((a as any).category ?? '').trim();
      if (!cat) continue;
      if ((a as any).status !== 'Available') continue;
      availableByCategory.set(cat, (availableByCategory.get(cat) ?? 0) + 1);
    }

    const out: Array<{ category: string; available: number; min: number }> = [];
    for (const cat of categoriesForThresholds) {
      const min = Number(lowStockThresholds[cat] ?? 0);
      if (!Number.isFinite(min) || min <= 0) continue;
      const available = availableByCategory.get(cat) ?? 0;
      if (available < min) out.push({ category: cat, available, min });
    }
    return out;
  }, [assetsList, categoriesForThresholds, lowStockThresholds]);

  useEffect(() => {
    localStorage.setItem(LOW_STOCK_KEY, JSON.stringify(lowStockThresholds));
  }, [lowStockThresholds]);

  useEffect(() => {
    if (lowStockItems.length === 0) return;
    const signature = lowStockItems.map((i) => `${i.category}:${i.available}/${i.min}`).join('|');
    const last = safeJsonParse<{ signature: string; at: number }>(localStorage.getItem(LOW_STOCK_NOTIFY_KEY));
    const now = Date.now();
    const tooSoon = last && typeof last.at === 'number' && now - last.at < 1000 * 60 * 10;
    if (last?.signature === signature && tooSoon) return;

    localStorage.setItem(LOW_STOCK_NOTIFY_KEY, JSON.stringify({ signature, at: now }));
    const first = lowStockItems[0];
    const more = lowStockItems.length - 1;
    addNotification({
      type: 'warning',
      title: 'Low stock',
      message: more > 0
        ? `${first.category} below threshold (${first.available} < ${first.min}) +${more} more`
        : `${first.category} below threshold (${first.available} < ${first.min})`,
      action: { label: 'Manage stock', link: '/stock-inventory' },
    });
  }, [addNotification, lowStockItems]);

  useEffect(() => {
    const parsed = safeJsonParse<{ columnKeys?: StockColumnKey[] }>(localStorage.getItem(STOCK_COLUMNS_KEY));
    if (parsed?.columnKeys && Array.isArray(parsed.columnKeys)) {
      setColumnKeys(parsed.columnKeys);
    }
  }, []);

  useEffect(() => {
    if (!Array.isArray(columnKeys) || columnKeys.length === 0) return;
    localStorage.setItem(STOCK_COLUMNS_KEY, JSON.stringify({ columnKeys }));
  }, [columnKeys]);

  const filteredAssets = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    const siteNormalized = filterSite.trim().toLowerCase();
    const supplierNormalized = filterSupplier.trim().toLowerCase();

    const min = valueMin.trim() ? Number(valueMin) : null;
    const max = valueMax.trim() ? Number(valueMax) : null;

    return assetsList.filter((asset) => {
      if (isPrinterConsumableRow(asset)) {
        return false;
      }

      const section = String((asset as any).section ?? '').trim();
      const sectionTab = normalizeCategoryTabLabel(section);
      const categoryTab = normalizeCategoryTabLabel((asset as any).category);
      const matchesCategory = (() => {
        if (!activeCategory) return true;
        if (activeCategory === OBSOLETE_TAB) return isAssetObsolete(asset);

        const normalizedActive = normalizeCategory(activeCategory);
        if (normalizedActive === 'Scanner') {
          return isScannerFamilyTab(categoryTab) || isScannerFamilyTab(sectionTab);
        }

        return categoryTab === activeCategory || sectionTab === activeCategory;
      })();
      const matchesStatus = !filterStatus || asset.status === filterStatus;

      const matchesSite =
        !siteNormalized || String(asset.site ?? '').toLowerCase().includes(siteNormalized);
      const matchesSupplier =
        !supplierNormalized || String(asset.supplier ?? '').toLowerCase().includes(supplierNormalized);

      const value = typeof (asset as any).value === 'number' ? (asset as any).value : Number((asset as any).value);
      const valueNum = Number.isFinite(value) ? value : null;
      const matchesMin = min == null || (valueNum != null && valueNum >= min);
      const matchesMax = max == null || (valueNum != null && valueNum <= max);

      const matchesSearch =
        !normalized ||
        String((asset as any).category ?? '').toLowerCase().includes(normalized) ||
        String((asset as any).section ?? '').toLowerCase().includes(normalized) ||
        String((asset as any).type ?? (asset as any).Type ?? '').toLowerCase().includes(normalized) ||
        String(asset.model ?? '').toLowerCase().includes(normalized) ||
        String(asset.serialNumber ?? '').toLowerCase().includes(normalized) ||
        String(asset.assetTag ?? '').toLowerCase().includes(normalized) ||
        (asset.macAddress ? String(asset.macAddress).toLowerCase().includes(normalized) : false) ||
        String((asset as any).ipAddress ?? '').toLowerCase().includes(normalized) ||
        String((asset as any).department ?? '').toLowerCase().includes(normalized) ||
        String((asset as any).condition ?? '').toLowerCase().includes(normalized) ||
        String(asset.site ?? '').toLowerCase().includes(normalized) ||
        String(asset.supplier ?? '').toLowerCase().includes(normalized) ||
        String((asset as any).barcode ?? '').toLowerCase().includes(normalized) ||
        String((asset as any).qrCode ?? '').toLowerCase().includes(normalized) ||
        String((asset as any).storeLocation ?? '').toLowerCase().includes(normalized) ||
        String((asset as any).cabinet ?? '').toLowerCase().includes(normalized) ||
        String((asset as any).rack ?? '').toLowerCase().includes(normalized) ||
        String((asset as any).level ?? '').toLowerCase().includes(normalized);

      return matchesCategory && matchesStatus && matchesSite && matchesSupplier && matchesMin && matchesMax && matchesSearch;
    });
  }, [activeCategory, assetsList, filterSite, filterStatus, filterSupplier, searchTerm, valueMax, valueMin]);

  const obsoleteCandidates = useMemo(() => {
    return (assetsList || []).filter((a: any) => {
      if (isPrinterConsumableRow(a)) return false;
      if (String(a?.status ?? '').trim() === 'Retired') return false;
      return isEndOfLifeByAge((a as any)?.dateOut);
    });
  }, [assetsList]);

  const markObsolete = async (assetId: string) => {
    if (!canManageInventory) {
      toast.error('Access denied', { description: 'Your role is read-only for inventory' });
      return;
    }
    const id = String(assetId ?? '').trim();
    if (!id) return;

    try {
      await patchAsset(id, { status: 'Retired' } as any);
      applyAssetStatus(id, 'Retired');
      await refreshAll();
      toast.success('Marked as obsolete', { description: 'Status set to Retired' });
    } catch (e: any) {
      toast.error('Unable to update asset', { description: String(e?.message ?? 'Network error') });
    }
  };

  const autoTransferEndOfLife = async () => {
    if (!canManageInventory) {
      toast.error('Access denied', { description: 'Your role is read-only for inventory' });
      return;
    }

    const list = obsoleteCandidates;
    if (!Array.isArray(list) || list.length === 0) {
      toast.info('Nothing to transfer', { description: `No assets older than ${END_OF_LIFE_YEARS} years` });
      return;
    }

    toast.message('Transfer in progress…', { description: `Marking ${list.length} asset(s) as Retired` });

    let transferred = 0;
    for (const a of list) {
      const id = String((a as any)?.id ?? '').trim();
      if (!id) continue;
      try {
        await patchAsset(id, { status: 'Retired' } as any);
        applyAssetStatus(id, 'Retired');
        transferred += 1;
      } catch {
        // best effort
      }
    }

    await refreshAll();
    toast.success('Transfer complete', { description: `${transferred} asset(s) marked as Retired` });
  };

  const rows: StockRow[] = useMemo(() => {
    const toRow = (asset: any): StockRow => {
      const lastIn =
        getLastMovement(stockMovements, asset.id, 'Entry') ??
        getLastMovement(stockMovements, asset.id, 'Transfer');
      const lastOut = getLastMovement(stockMovements, asset.id, 'Exit');

      const bci = String((asset as any).bci ?? '').trim();
      const bce = String((asset as any).bce ?? '').trim();
      const bciCheck = String((asset as any).bciCheck ?? '').trim();
      const vnc = String((asset as any).vnc ?? '').trim();
      const immoNumber = String((asset as any).immoNumber ?? '').trim();
      const pilote = String((asset as any).pilote ?? '').trim();
      const pilote1 = String((asset as any).pilote1 ?? '').trim();
      const stockIn = String((asset as any).stockIn ?? '').trim();
      const stockOut = String((asset as any).stockOut ?? '').trim();
      const dateOut = String((asset as any).dateOut ?? '').trim();
      const dateIn = String((asset as any).dateIn ?? '').trim();
      const comment = String((asset as any).comment ?? '').trim();
      const description = String((asset as any).description ?? '').trim();
      const type = String((asset as any).type ?? '').trim();
      const categoryName = String((asset as any).category ?? '').trim();
      const macAddress = String((asset as any).macAddress ?? asset.macAddress ?? '').trim();
      const ipAddress = String((asset as any).ipAddress ?? '').trim();
      const barcode = String((asset as any).barcode ?? '').trim();
      const qrCode = String((asset as any).qrCode ?? '').trim();
      const store = String((asset as any).storeLocation ?? '').trim();
      const cabinet = String((asset as any).cabinet ?? '').trim();
      const rack = String((asset as any).rack ?? '').trim();
      const level = String((asset as any).level ?? '').trim();

      const printerKey = `${String((asset as any).category ?? '').trim().toLowerCase()} ${String((asset as any).section ?? '').trim().toLowerCase()}`.trim();
      const isPrinter = Boolean(printerKey) && (
        printerKey.includes('printer') ||
        printerKey.includes('imprim') ||
        printerKey.includes('copier') ||
        printerKey.includes('mfp')
      );

      const department = (() => {
        const fromAsset = String((asset as any).department ?? '').trim();
        if (fromAsset) return fromAsset;
        if (!isPrinter) return '-';
        const asn: any = (assignments || []).find(
          (a: any) =>
            a?.assetId === asset.id &&
            String(a?.device_category ?? '').trim().toLowerCase() === 'printer' &&
            String(a?.status ?? '').trim().toLowerCase() !== 'returned',
        );
        const raw = String(asn?.department ?? '').trim();
        return raw || '-';
      })();

      const condition = String((asset as any).condition ?? '').trim() || '-';

      const scannerSubtypeFromCategory = (() => {
        const key = categoryName.toLowerCase().trim();
        if (!key) return '';
        if (key === 'scanner') return 'Scanner';
        if (key === 'cradle') return 'Cradle';
        if (key === 'pistolet') return 'Pistolet';
        if (key === 'barcode scanner') return 'Barcode Scanner';
        return '';
      })();

      const ciscoType = inferCiscoNetworkDeviceType({
        model: asset.model,
        description,
        category: categoryName,
        supplier: (asset as any).supplier,
        type,
      });

      const displayType = ciscoType || scannerSubtypeFromCategory;

      const normalizedCategory = normalizeCategory(categoryName);
      const brand =
        normalizedCategory === 'Printer' || normalizedCategory === 'Notebook' || normalizedCategory === 'Workstation'
          ? inferBrandFromModel({ model: asset.model, type })
          : '';

      const typeOrBrand = brand || displayType || '-';

      return {
        rowId: String(asset.id ?? asset.assetTag),
        assetId: asset.assetTag,
        type: typeOrBrand,
        model: asset.model,
        sn: asset.serialNumber,
        department,
        condition,
        ipAddress: ipAddress || '-',
        barcode: barcode || '-',
        qrCode: qrCode || '-',
        macAddress: macAddress || '-',
        status: asset.status,
        description: description || `${asset.category} • ${asset.supplier}`,
        bci: bci || '-',
        bce: bce || '-',
        bciCheck: bciCheck || '-',
        vnc: vnc || '-',
        plant: asset.site,
        store: store || '-',
        cabinet: cabinet || '-',
        rack: rack || '-',
        level: level || '-',
        stockIn: stockIn || (lastIn ? '✓' : ''),
        dateIn: dateIn || lastIn?.date || '-',
        pilote: pilote || lastIn?.user || '-',
        stockOut: stockOut || (lastOut ? '✓' : ''),
        dateOut: dateOut || lastOut?.date || '-',
        immoNumber: immoNumber || '-',
        pilote1: pilote1 || lastOut?.user || '-',
        comment: comment || lastOut?.comment || lastIn?.comment || '-',
        detailsLink: `/stock-inventory/${asset.id}`,
      };
    };

    return filteredAssets.map(toRow);
  }, [assignments, filteredAssets, stockMovements]);

  const availableColumns = useMemo(() => {
    return stockColumns.map((c) => (c.key === 'type' ? { ...c, label: typeColumnLabel } : c));
  }, [typeColumnLabel]);

  useEffect(() => {
    // Ensure columnKeys contains only supported columns; keep user visibility choices.
    const allKeys = availableColumns.map((c) => c.key);
    const allSet = new Set<StockColumnKey>(allKeys);

    setColumnKeys((prev) => {
      const base = Array.isArray(prev) && prev.length > 0 ? prev : allKeys;
      const next = base.filter((k) => allSet.has(k));
      if (next.length === 0) return ['assetId'];

      // Always keep assetId visible/available.
      if (!next.includes('assetId')) next.unshift('assetId');

      localStorage.setItem(STOCK_COLUMNS_KEY, JSON.stringify({ columnKeys: next }));
      return next;
    });
  }, [availableColumns]);

  useEffect(() => {
    // Scanner tab should match the Excel columns/order by default.
    const normalized = normalizeCategory(activeCategory);
    if (normalized !== 'Scanner') return;

    const scannerDefault: StockColumnKey[] = [
      'assetId',
      'type',
      'model',
      'sn',
      'description',
      'bci',
      'bce',
      'vnc',
      'plant',
      'stockIn',
      'dateIn',
      'pilote',
      'stockOut',
      'dateOut',
      'immoNumber',
      'comment',
    ];

    const allKeys = availableColumns.map((c) => c.key);
    const allSet = new Set<StockColumnKey>(allKeys);
    const cleanedDefault = scannerDefault.filter((k) => allSet.has(k));

    setColumnKeys((prev) => {
      // Only auto-apply if user hasn't customized (i.e. currently showing "all columns").
      const prevList = Array.isArray(prev) ? prev : [];
      const prevSet = new Set(prevList);
      const isAllSelected = allKeys.length > 0 && allKeys.every((k) => prevSet.has(k));
      if (!isAllSelected) return prev;
      return cleanedDefault.length > 0 ? cleanedDefault : prev;
    });
  }, [activeCategory, availableColumns, columnKeys]);

  useEffect(() => {
    setPageIndex(1);
  }, [activeCategory, searchTerm, filterStatus, filterSite, filterSupplier, valueMin, valueMax]);

  useEffect(() => {
    setSelectedRowIds(new Set());
  }, [activeCategory, searchTerm, filterStatus, filterSite, filterSupplier, valueMin, valueMax, sort, pageSize]);

  const sortedRows = useMemo(() => {
    const statusOrder: Record<AssetStatus, number> = {
      Available: 1,
      Assigned: 2,
      InRepair: 3,
      Retired: 4,
    };

    const copy = rows.slice();
    copy.sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1;
      if (sort.key === 'status') {
        return (statusOrder[a.status] - statusOrder[b.status]) * dir;
      }
      return compareValues((a as any)[sort.key], (b as any)[sort.key]) * dir;
    });
    return copy;
  }, [rows, sort.dir, sort.key]);

  const modelTotals = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const key = String((r as any)?.model ?? '').trim() || 'Unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([model, total]) => ({ model, total }))
      .sort((a, b) => b.total - a.total || a.model.localeCompare(b.model));
  }, [rows]);

  const totalCount = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePageIndex = clamp(pageIndex, 1, totalPages);

  useEffect(() => {
    if (safePageIndex !== pageIndex) setPageIndex(safePageIndex);
  }, [pageIndex, safePageIndex]);

  const pageRows = useMemo(() => {
    const start = (safePageIndex - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [pageSize, safePageIndex, sortedRows]);

  const displayedColumns = useMemo(() => {
    const byKey = new Map(availableColumns.map((c) => [c.key, c] as const));
    return columnKeys.map((k) => byKey.get(k)).filter(Boolean) as Array<(typeof availableColumns)[number]>;
  }, [availableColumns, columnKeys]);

  useEffect(() => {
    // Lightweight skeleton loading on initial mount + on state changes.
    if (loadingTimer.current) {
      window.clearTimeout(loadingTimer.current);
    }
    setIsLoading(true);
    loadingTimer.current = window.setTimeout(() => setIsLoading(false), 250);
    return () => {
      if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
    };
  }, [activeCategory, searchTerm, filterStatus, filterSite, filterSupplier, valueMin, valueMax, sort, pageSize, safePageIndex, columnKeys]);

  const handleAddAsset = async (newAsset: any) => {
    if (!canManageInventory) {
      toast.error('Access denied', { description: 'Your role is read-only for inventory' });
      return;
    }
    const incomingSerial = String(newAsset?.serialNumber ?? '').trim().toLowerCase();
    if (incomingSerial) {
      const exists = assetsList.some((a: any) => String(a?.serialNumber ?? '').trim().toLowerCase() === incomingSerial);
      if (exists) {
        toast.error('Duplicate serial number', {
          description: `Serial ${newAsset.serialNumber} already exists in stock`,
        });
        return;
      }
    }

    try {
      const created = await addAsset(newAsset);
      setAssetsList((prev) => [created, ...prev]);
      toast.success('Asset added', {
        description: `${created.assetTag} was added successfully to Assets IT`
      });
    } catch (e: any) {
      toast.error('Unable to add asset', { description: String(e?.message ?? 'Network error') });
    }
  };

  const applyAssetStatus = (assetIdOrRowId: string, nextStatus: AssetStatus) => {
    setAssetsList((prev) => {
      return prev.map((a: any) => {
        const id = String(a?.id ?? '');
        const tag = String(a?.assetTag ?? '');
        if (id === assetIdOrRowId || tag === assetIdOrRowId) {
          return { ...a, status: nextStatus };
        }
        return a;
      });
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterStatus('');
    setFilterSite('');
    setFilterSupplier('');
    setValueMin('');
    setValueMax('');
  };

  const toggleSort = (key: StockColumnKey) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key, dir: 'asc' };
    });
  };

  const toggleRowSelected = (rowId: string, nextChecked: boolean) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (nextChecked) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  };

  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selectedRowIds.has(r.rowId));
  const somePageSelected = pageRows.some((r) => selectedRowIds.has(r.rowId));

  const setAllOnPage = (checked: boolean) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      for (const r of pageRows) {
        if (checked) next.add(r.rowId);
        else next.delete(r.rowId);
      }
      return next;
    });
  };

  const exportSelected = () => {
    const selected = new Set(selectedRowIds);
    const rowsToExport = rows.filter((r) => selected.has(r.rowId));
    void (async () => {
      await exportStockToExcel(rowsToExport, typeColumnLabel);
      toast.success('Export ready', { description: `${rowsToExport.length} selected rows exported (Excel)` });
    })();
  };

  const saveView = () => {
    if (!canUseSavedViews) return;
    const name = newViewName.trim();
    if (!name) return;
    const view: StockView = {
      id: `view-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      createdAt: Date.now(),
      state: {
        activeCategory,
        searchTerm,
        filterStatus,
        filterSite,
        filterSupplier,
        valueMin,
        valueMax,
        sort,
        columnKeys,
        pageSize,
      },
    };

    setViews((prev) => {
      const next = [view, ...prev];
      localStorage.setItem(stockViewsStorageKey, JSON.stringify(next));
      return next;
    });
    setActiveViewId(view.id);
    setNewViewName('');
    toast.success('View saved', { description: name });
  };

  const applyView = (viewId: string) => {
    setActiveViewId(viewId);
    const view = views.find((v) => v.id === viewId);
    if (!view) return;
    setActiveCategory(view.state.activeCategory || defaultCategory);
    setSearchTerm(view.state.searchTerm);
    setFilterStatus(view.state.filterStatus);
    setFilterSite(view.state.filterSite);
    setFilterSupplier(view.state.filterSupplier);
    setValueMin(view.state.valueMin);
    setValueMax(view.state.valueMax);
    setSort(view.state.sort);
    setColumnKeys(view.state.columnKeys);
    setPageSize(view.state.pageSize);
    setPageIndex(1);
  };

  const deleteView = (viewId: string) => {
    setViews((prev) => {
      const next = prev.filter((v) => v.id !== viewId);
      localStorage.setItem(stockViewsStorageKey, JSON.stringify(next));
      return next;
    });
    if (activeViewId === viewId) setActiveViewId('');
    toast.success('View deleted');
  };

  return (
    <motion.div
      className="space-y-6"
      variants={shouldReduceMotion ? undefined : pageContainerVariants}
      initial={shouldReduceMotion ? undefined : 'hidden'}
      animate={shouldReduceMotion ? undefined : 'show'}
    >
      {/* Header */}
      <motion.div className="page-hero" variants={shouldReduceMotion ? undefined : pageItemVariants}>
        <div className="page-hero__topline" aria-hidden />
        <div className="page-hero__layout">
          <div className="min-w-0">
            <div className="page-hero__title-row">
              <div className="page-hero__icon" aria-hidden>
                <Columns3 className="h-[18px] w-[18px]" />
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="page-hero__badge">Assets IT</span>
                </div>

                <h1 className="page-hero__title">
                  <span className="page-hero__title-stack">
                    <span className="page-hero__title-glow" aria-hidden>
                      Assets IT
                    </span>
                    <span className="page-hero__title-text">Assets IT</span>
                  </span>
                </h1>

                <div className="page-hero__underline" aria-hidden />
                <p className="page-hero__subtitle">Operational stock overview</p>
              </div>
            </div>
          </div>

          <div className="page-hero__actions">
            <button
              onClick={() => {
                void (async () => {
                  await exportStockToExcel(rows, typeColumnLabel);
                  toast.success('Export ready', { description: 'Assets IT Excel downloaded' });
                })();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted/30 transition-all font-medium"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>

          {canManageInventory && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void (async () => {
                    try {
                      const buf = await file.arrayBuffer();
                      const imported = await importStockInventoryFromArrayBuffer(buf);
                      if (Array.isArray(imported.assets) && imported.assets.length > 0) {
                        // Persist to backend (SQL Server) so it appears in SSMS.
                        toast.message('Import in progress…', { description: `Syncing ${imported.assets.length} assets to the database` });

                        const list = imported.assets as any[];
                        const { created, updated, skipped, failed } = await upsertImportedAssetsToBackend(list);

                        // Switch back to DB-backed view
                        setExcelSections([]);
                        await refreshAll();

                        if (failed === 0) {
                          toast.success('Import completed', { description: `${created} created, ${updated} updated, ${skipped} skipped` });
                        } else {
                          toast.warning('Import completed with errors', {
                            description: `${created} created, ${updated} updated, ${skipped} skipped, ${failed} failed`
                          });
                        }
                        if (imported.duplicateSerials > 0) {
                          toast.warning('Duplicates removed', { description: `${imported.duplicateSerials} duplicate serial(s) were merged/removed` });
                        }
                      } else {
                        toast.error('Import failed', { description: 'No rows found in the Excel file' });
                      }
                    } catch (err: any) {
                      toast.error('Import failed', { description: String(err?.message ?? 'Unable to read Excel file') });
                    } finally {
                      e.target.value = '';
                    }
                  })();
                }}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-100 font-medium"
              >
                <Upload className="w-4 h-4" />
                Import Excel
              </button>
            </>
          )}

          {canManageInventory && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#1B4F91] to-[#2563EB] text-white px-5 py-2 rounded-lg hover:shadow-lg hover:scale-[1.02] transition-all font-medium"
            >
              <Plus className="w-5 h-5" />
              Add New Asset
            </button>
          )}
        </div>
        </div>
      </motion.div>

      {lowStockItems.length > 0 && (
        <motion.div
          className="bg-white dark:bg-gray-900 rounded-xl border border-amber-200 dark:border-amber-900/40 px-6 py-4"
          variants={shouldReduceMotion ? undefined : pageItemVariants}
          whileHover={shouldReduceMotion ? undefined : { y: -1 }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-300" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">Stock bas</div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {lowStockItems.slice(0, 3).map((i) => `${i.category}: ${i.available}/${i.min}`).join(' • ')}
                  {lowStockItems.length > 3 ? ` • +${lowStockItems.length - 3} autres` : ''}
                </div>
              </div>
            </div>
            {canManageInventory && (
              <Button variant="outline" size="sm" onClick={() => setIsThresholdsOpen(true)}>
                Configure thresholds
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* Category Tabs */}
      <motion.div
        className="bg-primary/5 dark:bg-primary/10 rounded-2xl shadow-sm border border-primary/20"
        variants={shouldReduceMotion ? undefined : pageItemVariants}
      >
        <div className="px-6 pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {categoryTabs
                .filter((name) => name !== OBSOLETE_TAB)
                .map((name) => (
                  <button
                    key={name}
                    onClick={() => setActiveCategory(name)}
                    className={`pb-3 whitespace-nowrap border-b-2 font-medium text-sm transition-colors ${
                      activeCategory === name
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }`}
                  >
                    {name}
                  </button>
                ))}
            </div>

            {categoryTabs.includes(OBSOLETE_TAB) && (
              <div
                className={`rounded-xl border px-3 pt-2 ${
                  activeCategory === OBSOLETE_TAB
                    ? 'border-destructive/30 bg-destructive/10'
                    : 'border-primary/20 bg-card/50'
                }`}
              >
                <button
                  key={OBSOLETE_TAB}
                  onClick={() => setActiveCategory(OBSOLETE_TAB)}
                  className={`pb-2 whitespace-nowrap border-b-2 font-semibold text-sm transition-colors ${
                    activeCategory === OBSOLETE_TAB
                      ? 'border-destructive text-destructive'
                      : 'border-transparent text-foreground/80 hover:text-foreground hover:border-border'
                  }`}
                >
                  {OBSOLETE_TAB}
                </button>
              </div>
            )}
          </div>
        </div>

        {activeCategory === OBSOLETE_TAB && (
          <div className="px-6 pb-3">
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-foreground">Obsolete / Retired</div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  Retired or older than {END_OF_LIFE_YEARS} years since in-service date (Date OUT): cannot be assigned.
                </div>
              </div>
              {canManageInventory && (
                <Button variant="outline" size="sm" onClick={() => void autoTransferEndOfLife()}>
                  Transfer 5+ years
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="px-6 pb-5">
          <div className="rounded-xl border border-primary/20 bg-card/50 p-3 mb-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {canUseSavedViews && (
                    <>
                      <div className="min-w-[240px]">
                        <Select
                          value={activeViewId || '__none__'}
                          onValueChange={(v) => {
                            if (v === '__none__') {
                              setActiveViewId('');
                              return;
                            }
                            applyView(v);
                          }}
                        >
                          <SelectTrigger className="h-9 bg-card">
                            <SelectValue placeholder="Saved views" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No saved view</SelectItem>
                            {views.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Save className="w-4 h-4" />
                            Save view
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Save current view</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Name</label>
                            <Input
                              value={newViewName}
                              onChange={(e) => setNewViewName(e.target.value)}
                              placeholder="e.g. MA6 • Available"
                            />
                          </div>
                          <DialogFooter>
                            <Button onClick={() => saveView()} disabled={!newViewName.trim()}>
                              Save
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {activeViewId && (
                        <Button variant="ghost" size="sm" onClick={() => deleteView(activeViewId)}>
                          <Trash2 className="w-4 h-4" />
                          Delete view
                        </Button>
                      )}
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="w-4 h-4" />
                  Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[320px]">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">Columns</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setColumnKeys(availableColumns.map((c) => c.key))}
                  >
                    Reset
                  </Button>
                </div>
                <div className="space-y-1">
                  {availableColumns.map((col) => {
                    const isVisible = columnKeys.includes(col.key);
                    const isLocked = col.key === 'assetId';
                    const index = columnKeys.indexOf(col.key);
                    const canMoveUp = index > 0;
                    const canMoveDown = index !== -1 && index < columnKeys.length - 1;

                    return (
                      <div key={col.key} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
                        <Checkbox
                          checked={isVisible}
                          disabled={isLocked}
                          onCheckedChange={(checked) => {
                            const next = checked === true;
                            setColumnKeys((prev) => {
                              const cur = prev.slice();
                              const has = cur.includes(col.key);
                              if (next && !has) cur.push(col.key);
                              if (!next && has) return cur.filter((k) => k !== col.key);
                              return cur;
                            });
                          }}
                        />
                        <div className="flex-1 text-sm">
                          {col.label}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!isVisible || !canMoveUp}
                            onClick={() => {
                              setColumnKeys((prev) => {
                                const i = prev.indexOf(col.key);
                                if (i <= 0) return prev;
                                const next = prev.slice();
                                const tmp = next[i - 1];
                                next[i - 1] = next[i];
                                next[i] = tmp;
                                return next;
                              });
                            }}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!isVisible || !canMoveDown}
                            onClick={() => {
                              setColumnKeys((prev) => {
                                const i = prev.indexOf(col.key);
                                if (i === -1 || i >= prev.length - 1) return prev;
                                const next = prev.slice();
                                const tmp = next[i + 1];
                                next[i + 1] = next[i];
                                next[i] = tmp;
                                return next;
                              });
                            }}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {canManageInventory && (
              <Button variant="outline" size="sm" onClick={() => setIsThresholdsOpen(true)}>
                <AlertTriangle className="w-4 h-4" />
                Thresholds
              </Button>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4" />
                  Advanced filters
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[360px]">
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Site</label>
                    <Input value={filterSite} onChange={(e) => setFilterSite(e.target.value)} placeholder="e.g. MA6" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Supplier</label>
                    <Input value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} placeholder="e.g. Dell" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Min value</label>
                      <Input inputMode="numeric" value={valueMin} onChange={(e) => setValueMin(e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Max value</label>
                      <Input inputMode="numeric" value={valueMax} onChange={(e) => setValueMax(e.target.value)} placeholder="5000" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="w-4 h-4" />
                      Clear
                    </Button>
                    <div className="text-xs text-muted-foreground">Applies instantly</div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4" />
              Clear
            </Button>

                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, SN, MAC, site, supplier…"
                  className="h-10 pl-10 bg-card"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Status</label>
              <Select
                value={filterStatus || '__all__'}
                onValueChange={(v) => setFilterStatus(v === '__all__' ? '' : (v as AssetStatus))}
              >
                <SelectTrigger className="h-10 bg-card">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Status</SelectItem>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="Assigned">Assigned</SelectItem>
                  <SelectItem value="InRepair">In Repair</SelectItem>
                  <SelectItem value="Retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </motion.div>

      <Dialog open={isThresholdsOpen} onOpenChange={setIsThresholdsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Minimum thresholds (stock bas)</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Thresholds are compared against the number of <span className="font-medium">Available</span> assets per category.
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-[50vh] overflow-y-auto pr-1">
              {categoriesForThresholds.map((cat) => {
                const v = String(lowStockThresholds[cat] ?? '');
                return (
                  <div key={cat} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex-1">
                      <div className="font-medium">{cat}</div>
                    </div>
                    <Input
                      value={v}
                      inputMode="numeric"
                      className="w-28"
                      placeholder="0"
                      onChange={(e) => {
                        const raw = e.target.value;
                        setLowStockThresholds((prev) => {
                          const next = { ...prev };
                          const n = Number(raw);
                          if (!raw.trim() || !Number.isFinite(n) || n <= 0) {
                            delete next[cat];
                            return next;
                          }
                          next[cat] = Math.floor(n);
                          return next;
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLowStockThresholds({})}>Reset</Button>
            <Button onClick={() => setIsThresholdsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <motion.div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
        variants={shouldReduceMotion ? undefined : pageItemVariants}
      >
        {selectedRowIds.size > 0 && (
          <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-gray-700 dark:text-gray-200">
              <span className="font-semibold">{selectedRowIds.size}</span> selected
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportSelected}>
                <Download className="w-4 h-4" />
                Export selected
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedRowIds(new Set())}>
                <X className="w-4 h-4" />
                Clear
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full premium-table">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  <Checkbox
                    checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                    onCheckedChange={(checked) => setAllOnPage(checked === true)}
                    aria-label="Select all on page"
                  />
                </th>

                {displayedColumns.map((col) => (
                  <th
                    key={col.key}
                    className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider"
                  >
                    <button
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-2 hover:text-foreground"
                      title="Sort"
                    >
                      {col.label}
                      {sort.key === col.key && (
                        sort.dir === 'asc' ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      )}
                    </button>
                  </th>
                ))}
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {isLoading &&
                Array.from({ length: Math.min(8, pageSize) }).map((_, idx) => (
                  <tr key={`sk-${idx}`}>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-4" /></td>
                    {displayedColumns.map((c) => (
                      <td key={c.key} className="px-6 py-4">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                    <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-16 ml-auto" /></td>
                  </tr>
                ))}

              {!isLoading &&
                pageRows.map((r) => (
                  <tr key={r.rowId} className="transition-colors">
                    <td className="px-4 py-4">
                      <Checkbox
                        checked={selectedRowIds.has(r.rowId)}
                        onCheckedChange={(checked) => toggleRowSelected(r.rowId, checked === true)}
                        aria-label={`Select ${r.assetId}`}
                      />
                    </td>
                    {displayedColumns.map((col) => {
                      if (col.key === 'status') {
                        return (
                          <td key={col.key} className="px-6 py-4 text-sm whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyles[r.status]}`}>
                              {r.status}
                            </span>
                          </td>
                        );
                      }

                      const value = (r as any)[col.key];
                      const isTight = col.key !== 'comment';
                      return (
                        <td
                          key={col.key}
                          className={`px-6 py-4 text-sm text-foreground ${isTight ? 'whitespace-nowrap' : ''}`}
                        >
                          {value}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 text-sm text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          to={r.detailsLink}
                          className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted/30 text-foreground font-medium"
                        >
                          View
                        </Link>
                        {canManageInventory && r.status !== 'Retired' && (
                          <button
                            onClick={() => void markObsolete(String(r.rowId))}
                            className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted/30 text-foreground font-medium"
                            title="Mark as obsolete (Retired)"
                          >
                            Mark obsolete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

              {!isLoading && pageRows.length === 0 && (
                <tr>
                  <td colSpan={displayedColumns.length + 2} className="px-6 py-12 text-center">
                    <div className="text-foreground font-semibold">No results</div>
                    <div className="text-sm text-muted-foreground mt-1">Try adjusting filters or clearing them.</div>
                    <div className="mt-4">
                      <Button variant="outline" onClick={clearFilters}>
                        <X className="w-4 h-4" />
                        Clear filters
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {totalCount} results • Page {safePageIndex} of {totalPages}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-9 w-[92px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPageIndex((p) => Math.max(1, p - 1));
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  const start = clamp(safePageIndex - 2, 1, Math.max(1, totalPages - 4));
                  const page = start + i;
                  if (page > totalPages) return null;
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        href="#"
                        isActive={page === safePageIndex}
                        onClick={(e) => {
                          e.preventDefault();
                          setPageIndex(page);
                        }}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPageIndex((p) => Math.min(totalPages, p + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>

        {!isLoading && totalCount > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Model totals {activeCategory ? `(${activeCategory})` : ''}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                {modelTotals.length} models
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
              {modelTotals.map((m) => (
                <div
                  key={m.model}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-gray-900/30 px-3 py-2"
                >
                  <div className="text-sm text-gray-700 dark:text-gray-200 truncate">{m.model}</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{m.total}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      <AddStockAssetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddAsset}
        categories={categories}
        sites={sites}
      />
    </motion.div>
  );
}
