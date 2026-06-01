import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Printer, LayoutDashboard, Plus, Search, ChevronRight } from 'lucide-react';
import { useData } from '../context/DataContext';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../components/ui/utils';
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
      return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
    case 'Bas':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'Moyen':
      return 'bg-muted text-foreground/60 border-border';
    default:
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
  }
}

function colorBarClass(color: TonerColor): string {
  switch (color) {
    case 'Cyan':    return 'bg-cyan-400';
    case 'Jaune':   return 'bg-yellow-300';
    case 'Magenta': return 'bg-fuchsia-500';
    case 'Noir':    return 'bg-black dark:bg-slate-400';
    default:        return 'bg-muted';
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
  const isColor = ['noir','black','cyan','jaune','yellow','magenta'].includes(type);
  if (!isColor) return false;
  const looksLikeTonerCode = /^w\d{4}[a-z0-9-]*$/.test(model) || /^w\d{4}[a-z0-9-]*$/.test(serialNumber);
  const looksLikeStockTonerId = assetTag.startsWith('sn-w') || serialNumber.startsWith('sn-w');
  return looksLikeTonerCode || looksLikeStockTonerId;
}

const pageContainerVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: 'easeOut', when: 'beforeChildren', staggerChildren: 0.05 },
  },
};

const pageItemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
};

export function PrinterTonerPage() {
  const shouldReduceMotion = useReducedMotion();
  const { assets } = useData();
  const [tab, setTab] = useState<TonerTab>('consumables');
  const [searchText, setSearchText] = useState('');
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [workbookLoading, setWorkbookLoading] = useState(false);
  const mountedRef = useRef(true);

  const loadWorkbook = useCallback(async () => {
    setWorkbookLoading(true);
    try {
      const [inc, ent, ex, min] = await Promise.all([
        listPrinterTonerIncidents(),
        listPrinterTonerEntries(),
        listPrinterTonerExits(),
        listPrinterTonerMinQty(),
      ]);
      const incidents: PrinterIncidentRow[] = (inc || []).map((i: any) => ({
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
      })).filter((r: any) => r.site || r.printerName || r.ticketNumber || r.problemNature);

      const entries: StockMovementRow[] = (ent || []).map((e: any) => ({
        date: parseExcelDate(e.date),
        article: String(e.article ?? '').trim(),
        articleCode: String(e.articleCode ?? '').trim(),
        quantity: asNumber(e.quantity),
      })).filter((r: any) => r.article || r.quantity);

      const exits: StockMovementRow[] = (ex || []).map((e: any) => ({
        date: parseExcelDate(e.date),
        article: String(e.article ?? '').trim(),
        articleCode: String(e.articleCode ?? '').trim(),
        quantity: asNumber(e.quantity),
      })).filter((r: any) => r.article || r.quantity);

      const minQtyByRefColor = new Map<string, number>();
      for (const m of min || []) {
        const ref = String(m.ref ?? '').trim();
        const color = String(m.color ?? '').trim().toUpperCase();
        const qty = asNumber(m.minQty);
        if (ref && color && qty) minQtyByRefColor.set(`${ref}|${color}`, qty);
      }
      if (mountedRef.current) setWorkbook({ incidents, entries, exits, minQtyByRefColor });
    } catch (e: any) {
      if (mountedRef.current) toast.error('Printer toner data error', { description: String(e?.message ?? 'Unable to load workbook') });
    } finally {
      if (mountedRef.current) setWorkbookLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadWorkbook();
    return () => { mountedRef.current = false; };
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
    const byArticle = new Map<string, { designation: string; articleCode: string; entries: number; exits: number; minQty: number | null }>();
    for (const e of wb.entries) {
      const key = normalizeKey(e.article);
      if (!key) continue;
      const prev = byArticle.get(key) ?? { designation: e.article, articleCode: e.articleCode, entries: 0, exits: 0, minQty: null };
      prev.entries += e.quantity;
      if (!prev.articleCode && e.articleCode) prev.articleCode = e.articleCode;
      byArticle.set(key, prev);
    }
    for (const s of wb.exits) {
      const key = normalizeKey(s.article);
      if (!key) continue;
      const prev = byArticle.get(key) ?? { designation: s.article, articleCode: s.articleCode, entries: 0, exits: 0, minQty: null };
      prev.exits += s.quantity;
      if (!prev.articleCode && s.articleCode) prev.articleCode = s.articleCode;
      byArticle.set(key, prev);
    }
    const rows: ConsumableRow[] = [];
    for (const [articleKey, v] of byArticle.entries()) {
      const refColor = inferArticleRefAndColor(articleKey);
      const minQty = refColor ? (wb.minQtyByRefColor.get(`${refColor.ref}|${refColor.color}`) ?? null) : null;
      rows.push({ id: articleKey, designation: v.designation, articleCode: v.articleCode, entries: v.entries, exits: v.exits, stock: v.entries - v.exits, minQty });
    }
    rows.sort((a, b) => a.designation.localeCompare(b.designation));
    return rows;
  }, [workbook]);

  const selectedConsumable = useMemo(() => consumables.find(c => String(c.id) === String(selectedConsumableKey)), [consumables, selectedConsumableKey]);
  const selectedExitConsumable = useMemo(() => consumables.find(c => String(c.id) === String(selectedExitConsumableKey)), [consumables, selectedExitConsumableKey]);

  const resetEntryForm = () => { setEntryDate(''); setSelectedConsumableKey(''); setEntryQuantity(''); setEntrySaving(false); };
  const resetExitForm = () => { setExitDate(''); setSelectedExitConsumableKey(''); setExitQuantity(''); setExitSaving(false); };

  const submitEntry = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (entrySaving || !selectedConsumable) return;
    const qty = asNumber(entryQuantity);
    if (!entryDate || qty <= 0) { toast.error('Invalid input'); return; }
    setEntrySaving(true);
    try {
      await createPrinterTonerEntry({ date: entryDate, article: selectedConsumable.designation, articleCode: selectedConsumable.articleCode, quantity: qty });
      toast.success('Entry added');
      setAddEntryOpen(false); resetEntryForm(); await loadWorkbook();
    } catch (err: any) { toast.error(String(err?.message ?? 'Error')); }
    finally { setEntrySaving(false); }
  };

  const submitExit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (exitSaving || !selectedExitConsumable) return;
    const qty = asNumber(exitQuantity);
    if (!exitDate || qty <= 0) { toast.error('Invalid input'); return; }
    setExitSaving(true);
    try {
      await createPrinterTonerExit({ date: exitDate, article: selectedExitConsumable.designation, articleCode: selectedExitConsumable.articleCode, quantity: qty });
      toast.success('Exit added');
      setAddExitOpen(false); resetExitForm(); await loadWorkbook();
    } catch (err: any) { toast.error(String(err?.message ?? 'Error')); }
    finally { setExitSaving(false); }
  };

  const printerAssets = useMemo(() => (assets || []).filter((a: any) => {
    const combined = `${a?.category} ${a?.section}`.toLowerCase();
    return (combined.includes('printer') || combined.includes('imprim')) && !isPrinterConsumableAsset(a);
  }), [assets]);

  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');
  useEffect(() => {
    if (printerAssets.length && !selectedPrinterId) setSelectedPrinterId(String(printerAssets[0]?.id));
  }, [printerAssets, selectedPrinterId]);

  const selectedPrinter = useMemo(() => printerAssets.find(p => String(p?.id) === selectedPrinterId), [printerAssets, selectedPrinterId]);
  const selectedPrinterLabel = selectedPrinter?.assetTag || selectedPrinter?.model || selectedPrinterId;

  const selectedTonerLevels = useMemo(() => {
    const seed = hashToSeed(String(selectedPrinterId || 'printer'));
    return {
      Cyan: seededPercent(seed ^ 0x1, 5, 100),
      Jaune: seededPercent(seed ^ 0x2, 5, 100),
      Magenta: seededPercent(seed ^ 0x3, 5, 100),
      Noir: seededPercent(seed ^ 0x4, 5, 100),
    } as Record<TonerColor, number>;
  }, [selectedPrinterId]);

  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const tabs: { id: TonerTab; label: string }[] = [
    { id: 'consumables', label: 'Consumables' },
    { id: 'entries', label: 'Entries' },
    { id: 'exits', label: 'Exits' },
    { id: 'incidents', label: 'Printers' },
  ];

  const headerTitle = tab === 'consumables' ? 'Consumables' : tab === 'entries' ? 'Entries' : tab === 'exits' ? 'Exits' : 'Printer Toner';
  const dataRows = tab === 'consumables' ? consumables : tab === 'entries' ? (workbook?.entries ?? []) : (workbook?.exits ?? []);
  const totalPages = Math.max(1, Math.ceil(dataRows.length / pageSize));
  const currentPage = dataRows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

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
                <Printer className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2"><span className="page-hero__badge">Inventory</span></div>
                <h1 className="page-hero__title">
                  <span className="page-hero__title-stack">
                    <span className="page-hero__title-glow" aria-hidden>{headerTitle}</span>
                    <span className="page-hero__title-text">{headerTitle}</span>
                  </span>
                </h1>
                <div className="page-hero__underline" aria-hidden />
                <p className="page-hero__subtitle">Printer supplies and monitoring</p>
              </div>
            </div>
          </div>
          <div className="page-hero__actions">
            {tab === 'entries' && (
              <motion.button whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => setAddEntryOpen(true)}
                className="chip-industrial flex items-center gap-2 bg-gradient-to-br from-primary to-cyan-600 text-white px-6 py-3 rounded-xl shadow-lg font-bold text-sm uppercase tracking-widest">
                <Plus className="w-4 h-4" /> Add entry
              </motion.button>
            )}
            {tab === 'exits' && (
              <motion.button whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => setAddExitOpen(true)}
                className="chip-industrial flex items-center gap-2 bg-gradient-to-br from-rose-500 to-rose-600 text-white px-6 py-3 rounded-xl shadow-lg font-bold text-sm uppercase tracking-widest">
                <Plus className="w-4 h-4" /> Add exit
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div className="premium-surface rounded-2xl p-1.5 flex flex-wrap gap-1" variants={shouldReduceMotion ? undefined : pageItemVariants}>
        {tabs.map((t) => {
          const isActive = tab === t.id;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); setPageIndex(0); }}
              className={cn("relative px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300",
                isActive ? "text-primary shadow-sm" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50")}>
              {isActive && <motion.div layoutId="activeTonerTab" className="absolute inset-0 bg-primary/10 rounded-xl border border-primary/20" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />}
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </motion.div>

      {/* Content */}
      <div className="w-full">
        {tab === 'incidents' ? (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
            <motion.div className="premium-surface rounded-3xl overflow-hidden flex flex-col h-[700px]" variants={shouldReduceMotion ? undefined : pageItemVariants}>
              <div className="px-8 py-6 border-b border-border/50 bg-gradient-to-r from-muted/30 to-transparent">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary"><Printer className="w-4 h-4" /></div>
                    <h2 className="text-sm font-black tracking-[0.2em] text-foreground uppercase">Printer Fleet</h2>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-muted border border-border text-[9px] font-black text-muted-foreground uppercase tracking-widest">{printerAssets.length} Units</span>
                </div>
                <div className="relative group">
                  <div className="absolute inset-0 bg-primary/5 rounded-xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40"><Search className="w-3.5 h-3.5" /></div>
                  <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search serial, tag..."
                    className="relative w-full h-9 pl-9 pr-4 rounded-xl border border-border/80 bg-card text-foreground placeholder:text-muted-foreground/30 text-[11px] font-bold outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/5" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto table-scrollbar p-4 space-y-1">
                {printerAssets.filter(p => {
                  const q = searchText.toLowerCase();
                  return String(p.assetTag).toLowerCase().includes(q) || String(p.serialNumber).toLowerCase().includes(q) || String(p.model).toLowerCase().includes(q);
                }).map((p) => {
                  const id = String(p?.id);
                  const label = p?.assetTag || p?.model || id;
                  const active = id === selectedPrinterId;
                  return (
                    <button key={id} onClick={() => setSelectedPrinterId(id)}
                      className={cn("w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 group",
                        active ? "bg-primary text-white shadow-lg shadow-primary/20 translate-x-1" : "hover:bg-muted/50 text-foreground/70")}>
                      <div className="flex flex-col items-start min-w-0">
                        <span className="text-[12px] font-black uppercase tracking-tight truncate w-full">{label}</span>
                        <span className={cn("text-[9px] font-bold uppercase tracking-widest mt-0.5", active ? "text-white/60" : "text-muted-foreground/50")}>{p?.serialNumber || '-'}</span>
                      </div>
                      <ChevronRight className={cn("w-4 h-4 transition-transform", active ? "text-white" : "text-muted-foreground/20 group-hover:text-muted-foreground/50")} />
                    </button>
                  );
                })}
              </div>
            </motion.div>

            <motion.div className="space-y-6" variants={shouldReduceMotion ? undefined : pageItemVariants}>
              {selectedPrinter ? (
                <>
                  <div className="premium-surface rounded-3xl p-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20">Printer Dashboard</span>
                          <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">ID: {selectedPrinter.id}</span>
                        </div>
                        <h2 className="text-3xl font-black text-foreground tracking-tight">{selectedPrinterLabel}</h2>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest mb-1">Current Status</p>
                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">Online</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-y-6 gap-x-8 pt-8 border-t border-border/50">
                      {[
                        { label: 'Brand', value: selectedPrinter.type }, { label: 'Model', value: selectedPrinter.model }, { label: 'S/N', value: selectedPrinter.serialNumber }, { label: 'Asset', value: selectedPrinter.immoNumber },
                        { label: 'IP Address', value: selectedPrinter.ipAddress }, { label: 'Site', value: selectedPrinter.site }, { label: 'Department', value: selectedPrinter.department }, { label: 'Responsible', value: selectedPrinter.pilote },
                      ].map(f => (
                        <div key={f.label} className="space-y-1">
                          <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">{f.label}</p>
                          <p className="text-[13px] font-bold text-foreground truncate">{String(f.value || '-').trim() || '-'}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                    {TONER_ORDER.map((c) => {
                      const value = selectedTonerLevels[c];
                      const tone = levelTone(value);
                      const label = c === 'Jaune' ? 'Y' : c[0];
                      return (
                        <motion.div key={c} whileHover={{ y: -2 }} className="premium-surface rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                          <div className={cn("h-2 w-full", colorBarClass(c))} />
                          <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-[11px] font-black uppercase tracking-widest text-foreground">{c}</span>
                              <span className="text-[10px] font-black text-muted-foreground/30">{label}</span>
                            </div>
                            <div className="flex items-end justify-between mb-6">
                              <span className="text-4xl font-black text-foreground tabular-nums tracking-tighter">{value}<span className="text-xl text-muted-foreground/40 ml-0.5">%</span></span>
                              <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border", toneBadgeClasses(tone))}>{tone}</span>
                            </div>
                            <div className="relative h-2 rounded-full bg-muted/50 overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 1, ease: "easeOut" }} className={cn("absolute inset-y-0 left-0 rounded-full", colorBarClass(c))} />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-12 premium-surface rounded-3xl border-dashed border-2 border-border/40">
                  <Printer className="w-16 h-16 text-muted-foreground/20 mb-6" />
                  <p className="text-lg font-black text-foreground uppercase tracking-tight">Select a printer</p>
                  <p className="text-sm font-medium text-muted-foreground">Choose a unit from the list to view telemetry.</p>
                </div>
              )}
            </motion.div>
          </div>
        ) : (
          <motion.div className="panel-frame overflow-hidden bg-card/30 backdrop-blur-md rounded-3xl border border-border/60 shadow-xl" variants={shouldReduceMotion ? undefined : pageItemVariants}>
            <div className="px-8 py-6 border-b border-border/50 bg-gradient-to-r from-muted/30 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary"><LayoutDashboard className="w-4 h-4" /></div>
                <h2 className="text-lg font-black tracking-tight text-foreground uppercase">{headerTitle} Registry</h2>
              </div>
              <div className="px-3 py-1 rounded-full bg-muted/50 border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">{dataRows.length} Total Records</div>
            </div>
            <div className="table-scrollbar sidebar-scroll">
              <div className="min-w-full inline-block align-middle">
                <table className="min-w-full premium-table">
                  <thead>
                    <tr className="bg-muted/20">
                      {(tab === 'consumables' ? ['Designation', 'Code Article', 'Entries', 'Exits', 'Stock'] : ['Date', 'Article', 'Code Article', 'Quantity']).map((h) => (
                        <th key={h} className="px-8 py-4 text-left text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] border-b border-border/50 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {currentPage.map((r: any, idx) => (
                      <tr key={idx} className="group transition-all duration-300">
                        {tab === 'consumables' ? (
                          <>
                            <td className="px-8 py-5 text-[13px] font-bold text-foreground leading-none whitespace-nowrap">{r.designation || '-'}</td>
                            <td className="px-8 py-5 text-[13px] font-medium text-muted-foreground whitespace-nowrap">{r.articleCode || '-'}</td>
                            <td className="px-8 py-5 text-[13px] font-black text-foreground tabular-nums whitespace-nowrap">{r.entries}</td>
                            <td className="px-8 py-5 text-[13px] font-black text-foreground tabular-nums whitespace-nowrap">{r.exits}</td>
                            <td className="px-8 py-5 whitespace-nowrap">
                              <span className={cn("text-[12px] font-black px-3 py-1 rounded-lg border tabular-nums", r.stock <= (r.minQty || 5) ? "bg-rose-500/10 text-rose-600 border-rose-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20")}>{r.stock}</span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-8 py-5 text-[13px] font-medium text-foreground tabular-nums whitespace-nowrap">{formatDate(r.date)}</td>
                            <td className="px-8 py-5 text-[13px] font-bold text-foreground leading-none whitespace-nowrap">{r.article || '-'}</td>
                            <td className="px-8 py-5 text-[13px] font-medium text-muted-foreground whitespace-nowrap">{r.articleCode || '-'}</td>
                            <td className="px-8 py-5 text-[13px] font-black text-foreground tabular-nums whitespace-nowrap">{r.quantity}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-8 py-6 border-t border-border/50 bg-muted/5 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
                <span>Show</span>
                <select className="h-8 rounded-lg border border-border/80 bg-card px-2 text-foreground outline-none" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPageIndex(0); }}>
                  {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span>Rows</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">Page {pageIndex + 1} / {totalPages}</div>
                <div className="flex items-center gap-2">
                  <button disabled={pageIndex <= 0} onClick={() => setPageIndex(p => p - 1)} className="p-2 rounded-xl border border-border bg-card disabled:opacity-30 hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4 rotate-180" /></button>
                  <button disabled={pageIndex >= totalPages - 1} onClick={() => setPageIndex(p => p + 1)} className="p-2 rounded-xl border border-border bg-card disabled:opacity-30 hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <Dialog open={addEntryOpen} onOpenChange={o => { setAddEntryOpen(o); if(!o) resetEntryForm(); }}>
        <DialogContent className="rounded-3xl">
          <form onSubmit={submitEntry} className="space-y-4">
            <DialogHeader><DialogTitle className="uppercase font-black">Add Entry</DialogTitle><DialogDescription>Select item and quantity to add to stock.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Consumable</label>
                <select className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-bold" value={selectedConsumableKey} onChange={e => setSelectedConsumableKey(e.target.value)} required>
                  <option value="" disabled>Select...</option>
                  {consumables.map(c => <option key={c.id} value={c.id}>{c.designation} {c.articleCode ? `(${c.articleCode})` : ''}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Date</label>
                  <input type="date" className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-bold" value={entryDate} onChange={e => setEntryDate(e.target.value)} required />
                </div>
                <div><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Quantity</label>
                  <input type="number" className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-bold" value={entryQuantity} onChange={e => setEntryQuantity(e.target.value)} min={1} required />
                </div>
              </div>
            </div>
            <DialogFooter><button type="button" onClick={() => setAddEntryOpen(false)} className="px-6 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px]">Cancel</button>
              <button type="submit" disabled={entrySaving} className="chip-industrial px-6 py-2 rounded-xl bg-primary text-white font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">{entrySaving ? 'Saving...' : 'Add Entry'}</button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addExitOpen} onOpenChange={o => { setAddExitOpen(o); if(!o) resetExitForm(); }}>
        <DialogContent className="rounded-3xl">
          <form onSubmit={submitExit} className="space-y-4">
            <DialogHeader><DialogTitle className="uppercase font-black">Add Exit</DialogTitle><DialogDescription>Select item and quantity to remove from stock.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Consumable</label>
                <select className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-bold" value={selectedExitConsumableKey} onChange={e => setSelectedExitConsumableKey(e.target.value)} required>
                  <option value="" disabled>Select...</option>
                  {consumables.map(c => <option key={c.id} value={c.id}>{c.designation} {c.articleCode ? `(${c.articleCode})` : ''}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Date</label>
                  <input type="date" className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-bold" value={exitDate} onChange={e => setExitDate(e.target.value)} required />
                </div>
                <div><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Quantity</label>
                  <input type="number" className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-bold" value={exitQuantity} onChange={e => setExitQuantity(e.target.value)} min={1} required />
                </div>
              </div>
            </div>
            <DialogFooter><button type="button" onClick={() => setAddExitOpen(false)} className="px-6 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px]">Cancel</button>
              <button type="submit" disabled={exitSaving} className="chip-industrial px-6 py-2 rounded-xl bg-rose-600 text-white font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-rose-600/20">{exitSaving ? 'Saving...' : 'Add Exit'}</button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
