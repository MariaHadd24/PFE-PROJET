import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import {
  createPrinterTonerEntry,
  createPrinterTonerExit,
  listPrinterTonerEntries,
  listPrinterTonerExits,
  listPrinterTonerIncidents,
  listPrinterTonerMinQty,
} from '../data/api';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

type TonerTab = 'consumables' | 'entries' | 'exits' | 'incidents';

type TonerColor = 'Cyan' | 'Jaune' | 'Magenta' | 'Noir';

type PrinterIncidentRow = {
  site: string;
  printerName: string;
  demandType: string;
  ticketNumber: string;
  problemNature: string;
  printerSerial: string;
  printerModel: string;
  claimDate: Date | null;
  interventionDate: Date | null;
  duration: string;
};

type StockMovementRow = {
  date: Date | null;
  article: string;
  articleCode: string;
  quantity: number;
};

type ConsumableRow = {
  id: string;
  designation: string;
  articleCode: string;
  entries: number;
  exits: number;
  stock: number;
  minQty?: number | null;
};

type WorkbookData = {
  incidents: PrinterIncidentRow[];
  entries: StockMovementRow[];
  exits: StockMovementRow[];
  minQtyByRefColor: Map<string, number>;
};

const TONER_ORDER: TonerColor[] = ['Cyan', 'Jaune', 'Magenta', 'Noir'];

function parseExcelDate(value: unknown): Date | null {
  if (value instanceof Date) return value;

  const s = String(value ?? '').trim();
  if (!s) return null;

  // dd/MM/yyyy (seen in Entrées/Sorties sheets)
  const m = /^([0-3]?\d)\/(0?\d|1[0-2])\/(\d{4})$/.exec(s);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const d = new Date(yyyy, mm - 1, dd);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const ms = Date.parse(s);
  if (!Number.isNaN(ms)) return new Date(ms);
  return null;
}

function formatDate(d: Date | null): string {
  if (!d) return '-';
  return d.toLocaleDateString('fr-FR');
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value ?? '').trim().replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizeKey(s: string): string {
  return String(s ?? '').trim();
}

function levelTone(value: number) {
  if (value <= 10) return 'Critique';
  if (value <= 25) return 'Bas';
  if (value <= 50) return 'Moyen';
  return 'OK';
}

function toneBadgeClasses(tone: ReturnType<typeof levelTone>) {
  switch (tone) {
    case 'Critique':
      return 'bg-destructive/10 text-destructive ring-1 ring-destructive/25';
    case 'Bas':
      return 'bg-primary/10 text-primary ring-1 ring-primary/20';
    case 'Moyen':
      return 'bg-muted text-foreground ring-1 ring-muted-foreground/15';
    default:
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/15 dark:ring-emerald-400/15';
  }
}

function colorBarClass(color: TonerColor): string {
  switch (color) {
    case 'Cyan':
      return 'bg-cyan-400';
    case 'Jaune':
      return 'bg-yellow-300';
    case 'Magenta':
      return 'bg-fuchsia-500';
    case 'Noir':
      return 'bg-black';
    default:
      return 'bg-muted';
  }
}

function hashToSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function xorshift32(seed: number) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return x >>> 0;
  };
}

function seededPercent(seed: number, min = 5, max = 100) {
  const next = xorshift32(seed);
  const n = next() / 0xffffffff;
  return Math.round(min + n * (max - min));
}

function inferArticleRefAndColor(article: string): { ref: string; color: string } | null {
  const s = String(article ?? '').trim();
  if (!s) return null;

  // Examples: "HP Color E77830dn-BLACK_BOK", "HP ... E57540dn-CYAN_BOK"
  const m = /\b([A-Za-z0-9]+)-([A-Za-z]+)\b/.exec(s);
  if (!m) return null;

  const ref = String(m[1] ?? '').trim();
  const rawColor = String(m[2] ?? '').trim().toUpperCase();
  const color =
    rawColor === 'YELLOW' ? 'YELLOW' :
    rawColor === 'BLACK' ? 'BLACK' :
    rawColor === 'CYAN' ? 'CYAN' :
    rawColor === 'MAGENTA' ? 'MAGENTA' :
    rawColor;

  if (!ref || !color) return null;
  return { ref, color };
}

function isPrinterConsumableAsset(asset: any): boolean {
  const type = String(asset?.type ?? '').trim().toLowerCase();
  const assetTag = String(asset?.assetTag ?? '').trim().toLowerCase();
  const model = String(asset?.model ?? '').trim().toLowerCase();
  const serialNumber = String(asset?.serialNumber ?? '').trim().toLowerCase();

  if (/^sn-w(?:913[0-3]|924[0-3])mc$/.test(assetTag)) return true;
  if (/^w(?:913[0-3]|924[0-3])mc$/.test(model)) return true;
  if (/^w(?:913[0-3]|924[0-3])mc$/.test(serialNumber)) return true;

  const isColor =
    type === 'noir' ||
    type === 'black' ||
    type === 'cyan' ||
    type === 'jaune' ||
    type === 'yellow' ||
    type === 'magenta';
  if (!isColor) return false;

  const looksLikeTonerCode = /^w\d{4}[a-z0-9-]*$/.test(model) || /^w\d{4}[a-z0-9-]*$/.test(serialNumber);
  const looksLikeStockTonerId = assetTag.startsWith('sn-w') || serialNumber.startsWith('sn-w');

  return looksLikeTonerCode || looksLikeStockTonerId;
}

function inferDesignation(asset: any): string {
  const designation = String(asset?.description ?? '').trim();
  if (designation) return designation;

  const model = String(asset?.model ?? '').trim();
  if (model) return model;

  const type = String(asset?.type ?? '').trim();
  if (type) return type;

  return String(asset?.assetTag ?? '').trim();
}

function inferArticleCode(asset: any): string {
  const model = String(asset?.model ?? '').trim();
  if (model) return model;

  const serialNumber = String(asset?.serialNumber ?? '').trim();
  if (serialNumber) return serialNumber;

  return String(asset?.assetTag ?? '').trim();
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        [
          'relative px-2 py-2 text-sm font-medium transition-colors',
          active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        ].join(' ')
      }
    >
      {children}
      {active && <span className="absolute left-0 right-0 -bottom-[1px] h-0.5 bg-primary rounded-full" />}
    </button>
  );
}

export function PrinterTonerPage() {
  const { assets } = useData();
  const [tab, setTab] = useState<TonerTab>('consumables');

  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [workbookError, setWorkbookError] = useState<string | null>(null);
  const [workbookLoading, setWorkbookLoading] = useState(false);

  const mountedRef = useRef(true);

  const loadWorkbook = useCallback(async () => {
    setWorkbookLoading(true);
    setWorkbookError(null);
    try {
      const [inc, ent, ex, min] = await Promise.all([
        listPrinterTonerIncidents(),
        listPrinterTonerEntries(),
        listPrinterTonerExits(),
        listPrinterTonerMinQty(),
      ]);

      const incidents: PrinterIncidentRow[] = (inc || [])
        .map((i) => ({
          site: String(i.site ?? '').trim(),
          printerName: String(i.printerName ?? '').trim(),
          demandType: String(i.demandType ?? '').trim(),
          ticketNumber: String(i.ticketNumber ?? '').trim(),
          problemNature: String(i.problemNature ?? '').trim(),
          printerSerial: String(i.printerSerial ?? '').trim(),
          printerModel: String(i.printerModel ?? '').trim(),
          claimDate: parseExcelDate(i.claimDate),
          interventionDate: parseExcelDate(i.interventionDate),
          duration: String(i.duration ?? '').trim(),
        }))
        .filter((r) => r.site || r.printerName || r.ticketNumber || r.problemNature);

      const entries: StockMovementRow[] = (ent || [])
        .map((e) => ({
          date: parseExcelDate(e.date),
          article: String(e.article ?? '').trim(),
          articleCode: String(e.articleCode ?? '').trim(),
          quantity: asNumber(e.quantity),
        }))
        .filter((r) => r.article || r.quantity);

      const exits: StockMovementRow[] = (ex || [])
        .map((e) => ({
          date: parseExcelDate(e.date),
          article: String(e.article ?? '').trim(),
          articleCode: String(e.articleCode ?? '').trim(),
          quantity: asNumber(e.quantity),
        }))
        .filter((r) => r.article || r.quantity);

      const minQtyByRefColor = new Map<string, number>();
      for (const m of min || []) {
        const ref = String(m.ref ?? '').trim();
        const color = String(m.color ?? '').trim().toUpperCase();
        const qty = asNumber(m.minQty);
        if (!ref || !color || !qty) continue;
        minQtyByRefColor.set(`${ref}|${color}`, qty);
      }

      if (mountedRef.current) {
        setWorkbook({ incidents, entries, exits, minQtyByRefColor });
      }
    } catch (e: any) {
      const msg = String(e?.message ?? 'Unable to load workbook');
      if (!mountedRef.current) return;
      setWorkbook(null);
      setWorkbookError(msg);
      toast.error('Printer toner data error', { description: msg });
    } finally {
      if (mountedRef.current) setWorkbookLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadWorkbook();
    return () => {
      mountedRef.current = false;
    };
  }, [loadWorkbook]);

  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [entryDate, setEntryDate] = useState('');
  const [selectedConsumableKey, setSelectedConsumableKey] = useState('');
  const [entryQuantity, setEntryQuantity] = useState('');
  const [entrySaving, setEntrySaving] = useState(false);

  const [addExitOpen, setAddExitOpen] = useState(false);
  const [exitDate, setExitDate] = useState('');
  const [selectedExitConsumableKey, setSelectedExitConsumableKey] = useState('');
  const [exitQuantity, setExitQuantity] = useState('');
  const [exitSaving, setExitSaving] = useState(false);

  const consumables: ConsumableRow[] = useMemo(() => {
    const wb = workbook;
    if (!wb) return [];

    const byArticle = new Map<
      string,
      { designation: string; articleCode: string; entries: number; exits: number; minQty: number | null }
    >();

    for (const e of wb.entries) {
      const key = normalizeKey(e.article);
      if (!key) continue;
      const prev = byArticle.get(key) ?? {
        designation: e.article,
        articleCode: e.articleCode,
        entries: 0,
        exits: 0,
        minQty: null,
      };
      prev.entries += e.quantity;
      if (!prev.articleCode && e.articleCode) prev.articleCode = e.articleCode;
      byArticle.set(key, prev);
    }

    for (const s of wb.exits) {
      const key = normalizeKey(s.article);
      if (!key) continue;
      const prev = byArticle.get(key) ?? {
        designation: s.article,
        articleCode: s.articleCode,
        entries: 0,
        exits: 0,
        minQty: null,
      };
      prev.exits += s.quantity;
      if (!prev.articleCode && s.articleCode) prev.articleCode = s.articleCode;
      byArticle.set(key, prev);
    }

    const rows: ConsumableRow[] = [];
    for (const [articleKey, v] of byArticle.entries()) {
      const refColor = inferArticleRefAndColor(articleKey);
      const minQty = refColor ? (wb.minQtyByRefColor.get(`${refColor.ref}|${refColor.color}`) ?? null) : null;
      rows.push({
        id: articleKey,
        designation: v.designation,
        articleCode: v.articleCode,
        entries: v.entries,
        exits: v.exits,
        stock: v.entries - v.exits,
        minQty,
      });
    }

    rows.sort((a, b) => a.designation.localeCompare(b.designation));
    return rows;
  }, [workbook]);

  const selectedConsumable = useMemo(() => {
    if (!selectedConsumableKey) return null;
    return consumables.find((c) => String(c.id) === String(selectedConsumableKey)) ?? null;
  }, [consumables, selectedConsumableKey]);

  useEffect(() => {
    if (!addEntryOpen) return;
    if (selectedConsumableKey) return;
    if (consumables.length > 0) setSelectedConsumableKey(String(consumables[0].id));
  }, [addEntryOpen, consumables, selectedConsumableKey]);

  const resetEntryForm = useCallback(() => {
    setEntryDate('');
    setSelectedConsumableKey('');
    setEntryQuantity('');
    setEntrySaving(false);
  }, []);

  const submitEntry = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (entrySaving) return;

      const date = String(entryDate ?? '').trim();
      const article = String(selectedConsumable?.designation ?? '').trim();
      const articleCode = String(selectedConsumable?.articleCode ?? '').trim();
      const quantity = asNumber(entryQuantity);

      if (!date || !selectedConsumableKey || !article || !articleCode || quantity <= 0) {
        toast.error('Ajout entrée', { description: 'Veuillez remplir: date, consumable, quantité.' });
        return;
      }

      setEntrySaving(true);
      try {
        await createPrinterTonerEntry({
          date,
          article,
          articleCode,
          quantity,
        });
        toast.success('Entrée ajoutée');
        setAddEntryOpen(false);
        resetEntryForm();
        await loadWorkbook();
      } catch (err: any) {
        const msg = String(err?.message ?? 'Unable to add entry');
        toast.error('Ajout entrée', { description: msg });
      } finally {
        setEntrySaving(false);
      }
    },
    [entryDate, entryQuantity, entrySaving, loadWorkbook, resetEntryForm, selectedConsumable?.articleCode, selectedConsumable?.designation, selectedConsumableKey],
  );

  const selectedExitConsumable = useMemo(() => {
    if (!selectedExitConsumableKey) return null;
    return consumables.find((c) => String(c.id) === String(selectedExitConsumableKey)) ?? null;
  }, [consumables, selectedExitConsumableKey]);

  useEffect(() => {
    if (!addExitOpen) return;
    if (selectedExitConsumableKey) return;
    if (consumables.length > 0) setSelectedExitConsumableKey(String(consumables[0].id));
  }, [addExitOpen, consumables, selectedExitConsumableKey]);

  const resetExitForm = useCallback(() => {
    setExitDate('');
    setSelectedExitConsumableKey('');
    setExitQuantity('');
    setExitSaving(false);
  }, []);

  const submitExit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (exitSaving) return;

      const date = String(exitDate ?? '').trim();
      const article = String(selectedExitConsumable?.designation ?? '').trim();
      const articleCode = String(selectedExitConsumable?.articleCode ?? '').trim();
      const quantity = asNumber(exitQuantity);

      if (!date || !selectedExitConsumableKey || !article || !articleCode || quantity <= 0) {
        toast.error('Ajout sortie', { description: 'Veuillez remplir: date, consumable, quantité.' });
        return;
      }

      setExitSaving(true);
      try {
        await createPrinterTonerExit({
          date,
          article,
          articleCode,
          quantity,
        });
        toast.success('Sortie ajoutée');
        setAddExitOpen(false);
        resetExitForm();
        await loadWorkbook();
      } catch (err: any) {
        const msg = String(err?.message ?? 'Unable to add exit');
        toast.error('Ajout sortie', { description: msg });
      } finally {
        setExitSaving(false);
      }
    },
    [exitDate, exitQuantity, exitSaving, loadWorkbook, resetExitForm, selectedExitConsumable?.articleCode, selectedExitConsumable?.designation, selectedExitConsumableKey],
  );

  const printerAssets = useMemo(() => {
    return (assets || []).filter((a: any) => {
      const category = String(a?.category ?? '').trim().toLowerCase();
      const section = String((a as any)?.section ?? '').trim().toLowerCase();
      const combined = `${category} ${section}`.trim();
      if (!combined) return false;
      const isPrinter =
        combined.includes('printer') ||
        combined.includes('imprim') ||
        combined.includes('copier') ||
        combined.includes('mfp');
      if (!isPrinter) return false;
      if (isPrinterConsumableAsset(a)) return false;
      return true;
    });
  }, [assets]);

  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');

  useEffect(() => {
    if (!printerAssets.length) return;
    if (!selectedPrinterId) {
      setSelectedPrinterId(String((printerAssets[0] as any)?.id ?? ''));
      return;
    }
    if (!printerAssets.some((p: any) => String(p?.id ?? '') === selectedPrinterId)) {
      setSelectedPrinterId(String((printerAssets[0] as any)?.id ?? ''));
    }
  }, [printerAssets, selectedPrinterId]);

  const selectedPrinter: any = useMemo(() => {
    return (printerAssets as any[]).find((p) => String(p?.id ?? '') === selectedPrinterId) ?? null;
  }, [printerAssets, selectedPrinterId]);

  const selectedPrinterLabel = useMemo(() => {
    const assetTag = String(selectedPrinter?.assetTag ?? '').trim();
    const model = String(selectedPrinter?.model ?? '').trim();
    return assetTag || model || String(selectedPrinter?.id ?? '');
  }, [selectedPrinter]);

  const selectedTonerLevels = useMemo(() => {
    const seed = hashToSeed(String(selectedPrinterId || selectedPrinterLabel || 'printer'));
    return {
      Cyan: seededPercent(seed ^ 0x1a2b3c4d, 5, 100),
      Jaune: seededPercent(seed ^ 0x22334455, 5, 100),
      Magenta: seededPercent(seed ^ 0x33445566, 5, 100),
      Noir: seededPercent(seed ^ 0x44556677, 5, 100),
    } as Record<TonerColor, number>;
  }, [selectedPrinterId, selectedPrinterLabel]);

  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const entriesRows = useMemo(() => (workbook?.entries ?? []), [workbook]);
  const exitsRows = useMemo(() => (workbook?.exits ?? []), [workbook]);

  const totalPages = useMemo(() => {
    const totalItems =
      tab === 'consumables'
        ? consumables.length
        : tab === 'entries'
          ? entriesRows.length
          : tab === 'exits'
            ? exitsRows.length
            : 0;
    if (totalItems === 0) return 0;
    return Math.max(1, Math.ceil(totalItems / pageSize));
  }, [consumables.length, entriesRows.length, exitsRows.length, pageSize, tab]);

  const currentPage = useMemo(() => {
    const start = pageIndex * pageSize;
    if (tab === 'consumables') return consumables.slice(start, start + pageSize);
    if (tab === 'entries') return entriesRows.slice(start, start + pageSize);
    if (tab === 'exits') return exitsRows.slice(start, start + pageSize);
    return [] as any[];
  }, [consumables, entriesRows, exitsRows, pageIndex, pageSize, tab]);

  const headerTitle = tab === 'consumables' ? 'Consumables' : tab === 'entries' ? 'Entrées' : tab === 'exits' ? 'Sorties' : 'Printer Toner';

  return (
    <div className="w-full px-6">
      <div className="w-full">
        <div className="w-full">
          <div className="border-b border-border mb-6">
            <div className="flex gap-6">
              <TabButton active={tab === 'consumables'} onClick={() => { setTab('consumables'); setPageIndex(0); }}>
                Consumables
              </TabButton>
              <TabButton active={tab === 'entries'} onClick={() => setTab('entries')}>
                Entrées
              </TabButton>
              <TabButton active={tab === 'exits'} onClick={() => setTab('exits')}>
                Sorties
              </TabButton>
              <TabButton active={tab === 'incidents'} onClick={() => setTab('incidents')}>
                Printers
              </TabButton>
            </div>
          </div>

          {tab === 'incidents' ? (
            <div className="space-y-4">
              <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm">
                <div className="px-6 py-6">
                  <h2 className="text-2xl font-bold tracking-tight">Printer Toner</h2>
                  <p className="text-sm text-muted-foreground">Select a printer to view its toner dashboard.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
                <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border">
                    <div className="text-sm font-semibold">Printers</div>
                    <div className="text-xs text-muted-foreground">{printerAssets.length} printer(s)</div>
                  </div>
                  <div className="p-4 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-2">
                      {(printerAssets as any[]).map((p) => {
                        const id = String(p?.id ?? '');
                        const label = String(p?.assetTag ?? '').trim() || String(p?.model ?? '').trim() || id;
                        const active = id === selectedPrinterId;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setSelectedPrinterId(id)}
                            className={
                              [
                                'w-full text-left px-3 py-2 rounded-lg border transition-colors',
                                active
                                  ? 'bg-primary/10 border-primary/30 text-foreground'
                                  : 'bg-background border-border hover:bg-muted/50 text-foreground',
                              ].join(' ')
                            }
                            title={label}
                          >
                            <div className="text-sm font-medium truncate">{label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm">
                    <div className="px-6 py-5 border-b border-border">
                      <div className="text-xl font-semibold">{selectedPrinterLabel || '-'}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Brand: {String(selectedPrinter?.type ?? '-').trim() || '-'}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">{String(selectedPrinter?.model ?? '-').trim() || '-'}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">S/N: {String(selectedPrinter?.serialNumber ?? '-').trim() || '-'}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Asset: {String((selectedPrinter as any)?.immoNumber ?? '-').trim() || '-'}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Reception Date: {String((selectedPrinter as any)?.dateIn ?? '-').trim() || '-'}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Responsible: {String((selectedPrinter as any)?.pilote ?? '-').trim() || '-'}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Check: {String((selectedPrinter as any)?.bciCheck ?? '-').trim() || '-'}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Site: {String(selectedPrinter?.site ?? '-').trim() || '-'}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">IP: {String((selectedPrinter as any)?.ipAddress ?? '-').trim() || '-'}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Area: {String((selectedPrinter as any)?.area ?? '-').trim() || '-'}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Department: {String((selectedPrinter as any)?.department ?? '-').trim() || '-'}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Condition: {String((selectedPrinter as any)?.condition ?? '-').trim() || '-'}</span>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        {TONER_ORDER.map((c) => {
                          const value = selectedTonerLevels[c];
                          const tone = levelTone(value);
                          const label = c === 'Jaune' ? 'Y' : c[0];
                          return (
                            <div key={c} className="rounded-2xl border border-border bg-card/90 overflow-hidden w-full shadow-sm shadow-black/5 dark:shadow-black/25">
                              <div className="relative">
                                <div className={`h-2 ${colorBarClass(c)}`} aria-hidden />
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent dark:from-white/5" />
                              </div>
                              <div className="p-5">
                                <div className="flex items-center justify-between">
                                  <div className="text-sm font-semibold text-foreground">{c}</div>
                                  <div className="text-xs text-muted-foreground">{label}</div>
                                </div>
                                <div className="mt-2 flex items-end justify-between">
                                  <div className="text-2xl font-bold text-foreground">{value}%</div>
                                  <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${toneBadgeClasses(tone)}`}>{tone}</span>
                                </div>
                                <div className="mt-4 h-2.5 rounded-full bg-muted overflow-hidden">
                                  <div className={`h-full ${colorBarClass(c)}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm">
              <div className="px-6 pt-6 flex items-start justify-between gap-4">
                <h2 className="text-2xl font-bold tracking-tight">{headerTitle}</h2>

                {tab === 'entries' && (
                  <button
                    type="button"
                    className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium"
                    onClick={() => setAddEntryOpen(true)}
                  >
                    Ajouter
                  </button>
                )}

                {tab === 'exits' && (
                  <button
                    type="button"
                    className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium"
                    onClick={() => setAddExitOpen(true)}
                  >
                    Ajouter
                  </button>
                )}
              </div>

              {tab === 'consumables' && (
                <div className="px-6 py-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border">
                          <th className="text-left font-semibold py-3">Désignation</th>
                          <th className="text-left font-semibold py-3">Code Article</th>
                          <th className="text-left font-semibold py-3">Entrées</th>
                          <th className="text-left font-semibold py-3">Sorties</th>
                          <th className="text-left font-semibold py-3">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(currentPage as ConsumableRow[]).map((r) => (
                          <tr key={r.id} className="border-b border-border last:border-0">
                            <td className="py-3 pr-3 text-foreground">{r.designation || '-'}</td>
                            <td className="py-3 pr-3 text-foreground">{r.articleCode || '-'}</td>
                            <td className="py-3 pr-3 text-foreground">{r.entries}</td>
                            <td className="py-3 pr-3 text-foreground">{r.exits}</td>
                            <td className="py-3 pr-3 text-foreground">{r.stock}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'entries' && (
                <div className="px-6 py-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border">
                          <th className="text-left font-semibold py-3">Date d'entrée</th>
                          <th className="text-left font-semibold py-3">Article</th>
                          <th className="text-left font-semibold py-3">Code Article</th>
                          <th className="text-left font-semibold py-3">Quantité</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(currentPage as StockMovementRow[]).map((r, idx) => (
                          <tr key={`${r.article}-${idx}`} className="border-b border-border last:border-0">
                            <td className="py-3 pr-3 text-foreground">{formatDate(r.date)}</td>
                            <td className="py-3 pr-3 text-foreground">{r.article || '-'}</td>
                            <td className="py-3 pr-3 text-foreground">{r.articleCode || '-'}</td>
                            <td className="py-3 pr-3 text-foreground">{r.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'exits' && (
                <div className="px-6 py-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border">
                          <th className="text-left font-semibold py-3">Date de sortie</th>
                          <th className="text-left font-semibold py-3">Nom Article</th>
                          <th className="text-left font-semibold py-3">Code Article</th>
                          <th className="text-left font-semibold py-3">Quantité</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(currentPage as StockMovementRow[]).map((r, idx) => (
                          <tr key={`${r.article}-${idx}`} className="border-b border-border last:border-0">
                            <td className="py-3 pr-3 text-foreground">{formatDate(r.date)}</td>
                            <td className="py-3 pr-3 text-foreground">{r.article || '-'}</td>
                            <td className="py-3 pr-3 text-foreground">{r.articleCode || '-'}</td>
                            <td className="py-3 pr-3 text-foreground">{r.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Footer (pagination) */}
              {(tab === 'consumables' || tab === 'entries' || tab === 'exits') && (
                <div className="px-6 pb-6">
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Show</span>
                      <select
                        className="h-9 rounded-md border border-border bg-background px-2 text-foreground"
                        value={pageSize}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          setPageSize(Number.isFinite(next) && next > 0 ? next : 10);
                          setPageIndex(0);
                        }}
                      >
                        {[10, 25, 50].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <span>rows per page</span>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <button
                        type="button"
                        className="h-9 w-9 rounded-md border border-border bg-background text-foreground disabled:opacity-50"
                        disabled={pageIndex <= 0}
                        onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                        aria-label="Previous page"
                        title="Previous"
                      >
                        &lt;
                      </button>
                      <span>
                        Page {totalPages === 0 ? 1 : pageIndex + 1} of {totalPages}
                      </span>
                      <button
                        type="button"
                        className="h-9 w-9 rounded-md border border-border bg-background text-foreground disabled:opacity-50"
                        disabled={totalPages === 0 || pageIndex >= totalPages - 1}
                        onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                        aria-label="Next page"
                        title="Next"
                      >
                        &gt;
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={addEntryOpen}
        onOpenChange={(open) => {
          setAddEntryOpen(open);
          if (!open) resetEntryForm();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={submitEntry} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Ajouter une entrée</DialogTitle>
              <DialogDescription>Date, article, code article et quantité.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Consumable</label>
                <select
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-foreground"
                  value={selectedConsumableKey}
                  onChange={(ev) => setSelectedConsumableKey(ev.target.value)}
                  required
                >
                  <option value="" disabled>
                    {consumables.length ? 'Sélectionner…' : 'Aucun consumable disponible'}
                  </option>
                  {consumables.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {String(c.designation ?? '').trim() || '-'}{c.articleCode ? ` — ${c.articleCode}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Date</label>
                <input
                  type="date"
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-foreground"
                  value={entryDate}
                  onChange={(ev) => setEntryDate(ev.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Quantité</label>
                <input
                  type="number"
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-foreground"
                  value={entryQuantity}
                  onChange={(ev) => setEntryQuantity(ev.target.value)}
                  min={1}
                  step={1}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <button
                type="button"
                className="h-9 px-3 rounded-md border border-border bg-background text-foreground text-sm"
                onClick={() => setAddEntryOpen(false)}
                disabled={entrySaving}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                disabled={entrySaving || !consumables.length}
              >
                {entrySaving ? 'Enregistrement…' : 'Ajouter'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addExitOpen}
        onOpenChange={(open) => {
          setAddExitOpen(open);
          if (!open) resetExitForm();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={submitExit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Ajouter une sortie</DialogTitle>
              <DialogDescription>Date, consumable et quantité.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Consumable</label>
                <select
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-foreground"
                  value={selectedExitConsumableKey}
                  onChange={(ev) => setSelectedExitConsumableKey(ev.target.value)}
                  required
                >
                  <option value="" disabled>
                    {consumables.length ? 'Sélectionner…' : 'Aucun consumable disponible'}
                  </option>
                  {consumables.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {String(c.designation ?? '').trim() || '-'}{c.articleCode ? ` — ${c.articleCode}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Date</label>
                <input
                  type="date"
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-foreground"
                  value={exitDate}
                  onChange={(ev) => setExitDate(ev.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Quantité</label>
                <input
                  type="number"
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-foreground"
                  value={exitQuantity}
                  onChange={(ev) => setExitQuantity(ev.target.value)}
                  min={1}
                  step={1}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <button
                type="button"
                className="h-9 px-3 rounded-md border border-border bg-background text-foreground text-sm"
                onClick={() => setAddExitOpen(false)}
                disabled={exitSaving}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                disabled={exitSaving || !consumables.length}
              >
                {exitSaving ? 'Enregistrement…' : 'Ajouter'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
