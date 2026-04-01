import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useData } from '../context/DataContext';
import { Button } from '../components/ui/button';
import { Slider } from '../components/ui/slider';

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

type TonerColor = 'Cyan' | 'Jaune' | 'Magenta' | 'Noir';

const tonerOrder: TonerColor[] = ['Cyan', 'Jaune', 'Magenta', 'Noir'];

function isPrinterConsumableAsset(asset: any): boolean {
  const type = String(asset?.type ?? '').trim().toLowerCase();
  const assetTag = String(asset?.assetTag ?? '').trim().toLowerCase();
  const model = String(asset?.model ?? '').trim().toLowerCase();
  const serialNumber = String(asset?.serialNumber ?? '').trim().toLowerCase();

  // Hard match on known toner IDs.
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

  // Generic fallback: toner codes are often W####...
  const looksLikeTonerCode = /^w\d{4}[a-z0-9-]*$/.test(model) || /^w\d{4}[a-z0-9-]*$/.test(serialNumber);
  const looksLikeStockTonerId = assetTag.startsWith('sn-w') || serialNumber.startsWith('sn-w');

  return looksLikeTonerCode || looksLikeStockTonerId;
}

function tonerSwatchClasses(color: TonerColor) {
  switch (color) {
    case 'Cyan':
      return { bg: 'bg-cyan-400', text: 'text-black' };
    case 'Jaune':
      return { bg: 'bg-yellow-300', text: 'text-black' };
    case 'Magenta':
      return { bg: 'bg-fuchsia-500', text: 'text-black' };
    case 'Noir':
      return { bg: 'bg-black', text: 'text-white' };
    default:
      return { bg: 'bg-muted', text: 'text-foreground' };
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

type PrinterTonerRow = {
  assetId: string;
  printerLabel: string;
  serial: string;
  type: string;
  model: string;
  area: string;
  department: string;
  condition: string;
  plant: string;
  ipAddress: string;
  immoNumber: string;
  dateIn: string;
  pilote: string;
  bciCheck: string;
  levels: Record<TonerColor, number>;
};

function levelTone(value: number) {
  if (value <= 10) return 'Critique';
  if (value <= 25) return 'Bas';
  if (value <= 50) return 'Moyen';
  return 'OK';
}

function toneAccentClasses(tone: ReturnType<typeof levelTone>) {
  switch (tone) {
    case 'Critique':
      return {
        ring: 'ring-1 ring-destructive/35',
        badge: 'bg-destructive/10 text-destructive',
      };
    case 'Bas':
      return {
        ring: 'ring-1 ring-primary/20',
        badge: 'bg-primary/10 text-primary',
      };
    case 'Moyen':
      return {
        ring: 'ring-1 ring-muted-foreground/15',
        badge: 'bg-muted text-foreground',
      };
    default:
      return {
        ring: 'ring-1 ring-emerald-500/15 dark:ring-emerald-400/15',
        badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      };
  }
}

export function PrinterIncidentsPage() {
  const shouldReduceMotion = useReducedMotion();
  const { assets, assignments } = useData();
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');

  const printerScrollerRef = useRef<HTMLDivElement | null>(null);
  const [printerScrollMax, setPrinterScrollMax] = useState(0);
  const [printerScrollValue, setPrinterScrollValue] = useState(0);

  const printerAssets = useMemo(() => {
    return (assets || []).filter((a: any) => {
      const category = String(a?.category ?? '').trim().toLowerCase();
      const section = String((a as any)?.section ?? '').trim().toLowerCase();
      const combined = `${category} ${section}`.trim();
      if (!combined) return false;
      const isPrinter = combined.includes('printer') || combined.includes('imprim') || combined.includes('copier') || combined.includes('mfp');
      if (!isPrinter) return false;
      if (isPrinterConsumableAsset(a)) return false;
      return true;
    });
  }, [assets]);

  const getPrinterLabel = (assetId: string) => {
    const asset: any = (assets || []).find((a: any) => a.id === assetId);
    const assetTag = String(asset?.assetTag ?? '').trim();
    const model = String(asset?.model ?? '').trim();
    return assetTag || model || assetId;
  };

  const getPrinterSerial = (assetId: string) => {
    const asset: any = (assets || []).find((a: any) => a.id === assetId);
    return String(asset?.serialNumber ?? '').trim() || '-';
  };

  const getPrinterModel = (assetId: string) => {
    const asset: any = (assets || []).find((a: any) => a.id === assetId);
    return String(asset?.model ?? '').trim() || '-';
  };

  const getPrinterType = (assetId: string) => {
    const asset: any = (assets || []).find((a: any) => a.id === assetId);
    return String(asset?.type ?? '').trim() || '-';
  };

  const getPrinterSite = (assetId: string) => {
    const asset: any = (assets || []).find((a: any) => a.id === assetId);
    return String(asset?.site ?? '').trim() || '-';
  };

  const getPrinterIp = (assetId: string) => {
    const asset: any = (assets || []).find((a: any) => a.id === assetId);
    return String(asset?.ipAddress ?? '').trim() || '-';
  };

  const getPrinterImmoNumber = (assetId: string) => {
    const asset: any = (assets || []).find((a: any) => a.id === assetId);
    return String(asset?.immoNumber ?? '').trim() || '-';
  };

  const getPrinterDateIn = (assetId: string) => {
    const asset: any = (assets || []).find((a: any) => a.id === assetId);
    return String(asset?.dateIn ?? '').trim() || '-';
  };

  const getPrinterPilote = (assetId: string) => {
    const asset: any = (assets || []).find((a: any) => a.id === assetId);
    return String(asset?.pilote ?? '').trim() || '-';
  };

  const getPrinterBciCheck = (assetId: string) => {
    const asset: any = (assets || []).find((a: any) => a.id === assetId);
    return String(asset?.bciCheck ?? '').trim() || '-';
  };

  const getPrinterArea = (assetId: string) => {
    const asset: any = (assets || []).find((a: any) => a.id === assetId);
    const fromAsset = String(asset?.area ?? '').trim();
    if (fromAsset) return fromAsset;
    const asn: any = (assignments || []).find(
      (a: any) => a.assetId === assetId && String(a.device_category ?? '').toLowerCase() === 'printer',
    );
    const area = String(asn?.area ?? asn?.userName ?? '').trim();
    return area || '-';
  };

  const getPrinterDepartment = (assetId: string) => {
    const asset: any = (assets || []).find((a: any) => a.id === assetId);
    const fromAsset = String(asset?.department ?? '').trim();
    if (fromAsset) return fromAsset;
    const asn: any = (assignments || []).find(
      (a: any) => a.assetId === assetId && String(a.device_category ?? '').toLowerCase() === 'printer',
    );
    return String(asn?.department ?? '').trim() || '-';
  };

  const getPrinterCondition = (assetId: string) => {
    const asset: any = (assets || []).find((a: any) => a.id === assetId);
    return String(asset?.condition ?? '').trim() || '-';
  };

  const tonerRows: PrinterTonerRow[] = useMemo(() => {
    return printerAssets
      .map((asset: any) => {
        const assetId = String(asset?.id ?? '').trim();
        const seed = hashToSeed(assetId);
        const levels: Record<TonerColor, number> = {
          Cyan: seededPercent(seed ^ 0x1a2b3c4d, 5, 100),
          Jaune: seededPercent(seed ^ 0x22334455, 5, 100),
          Magenta: seededPercent(seed ^ 0x33445566, 5, 100),
          Noir: seededPercent(seed ^ 0x44556677, 5, 100),
        };

        return {
          assetId,
          printerLabel: getPrinterLabel(assetId),
          serial: getPrinterSerial(assetId),
          type: getPrinterType(assetId),
          model: getPrinterModel(assetId),
          area: getPrinterArea(assetId),
          department: getPrinterDepartment(assetId),
          condition: getPrinterCondition(assetId),
          plant: getPrinterSite(assetId),
          ipAddress: getPrinterIp(assetId),
          immoNumber: getPrinterImmoNumber(assetId),
          dateIn: getPrinterDateIn(assetId),
          pilote: getPrinterPilote(assetId),
          bciCheck: getPrinterBciCheck(assetId),
          levels,
        };
      })
      .sort((a, b) => a.printerLabel.localeCompare(b.printerLabel));
  }, [printerAssets, assets, assignments]);

  useEffect(() => {
    if (!selectedAssetId && tonerRows.length > 0) {
      setSelectedAssetId(tonerRows[0].assetId);
    }
    if (selectedAssetId && tonerRows.length > 0 && !tonerRows.some((r) => r.assetId === selectedAssetId)) {
      setSelectedAssetId(tonerRows[0].assetId);
    }
  }, [selectedAssetId, tonerRows]);

  const syncPrinterScroll = () => {
    const el = printerScrollerRef.current;
    if (!el) return;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    setPrinterScrollMax(max);
    setPrinterScrollValue((prev) => {
      const next = Math.min(max, el.scrollLeft);
      return prev === next ? prev : next;
    });
  };

  useEffect(() => {
    // Sync after layout so scrollWidth/clientWidth are correct.
    const raf = window.requestAnimationFrame(() => syncPrinterScroll());
    const t = window.setTimeout(() => syncPrinterScroll(), 0);
    const el = printerScrollerRef.current;
    if (!el) return;

    const onScroll = () => {
      setPrinterScrollValue(el.scrollLeft);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', syncPrinterScroll);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t);
      el.removeEventListener('scroll', onScroll as any);
      window.removeEventListener('resize', syncPrinterScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tonerRows.length]);

  const selected = useMemo(() => tonerRows.find((r) => r.assetId === selectedAssetId), [tonerRows, selectedAssetId]);

  const tonerSquare = (color: TonerColor, value: number) => {
    const sw = tonerSwatchClasses(color);
    const label = color === 'Jaune' ? 'Y' : color[0];
    const tone = levelTone(value);
    const accent = toneAccentClasses(tone);
    return (
      <div className={`rounded-2xl border border-border bg-card/90 overflow-hidden w-full shadow-sm shadow-black/5 dark:shadow-black/25 ${accent.ring}`}>
        <div className="relative">
          <div className={`h-2 ${sw.bg}`} aria-hidden />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent dark:from-white/5" />
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">{color}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
          <div className="mt-2 flex items-end justify-between">
            <div className="text-2xl font-bold text-foreground">{value}%</div>
            <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${accent.badge}`}>{tone}</span>
          </div>
          <div className="mt-4 h-2.5 rounded-full bg-muted overflow-hidden">
            <div className={`h-full ${sw.bg}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      className="p-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: EASE_OUT }}
    >
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: EASE_OUT, delay: 0.02 }}
      >
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-foreground">Printer Toner</h1>
            <p className="text-muted-foreground">Select a printer to view its toner dashboard.</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: EASE_OUT, delay: 0.04 }}
      >
        {tonerRows.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground">
            No printers found in stock.
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 dark:bg-primary/10 shadow-sm">
              <div className="px-5 py-4 border-b border-primary/20">
                <div className="text-sm font-semibold text-foreground">Printers</div>
                <div className="text-xs text-muted-foreground">{tonerRows.length} printer(s)</div>
              </div>
              <div className="p-4">
                <div
                  ref={printerScrollerRef}
                  className="flex items-center gap-2 overflow-x-auto pb-2"
                >
                  {tonerRows.map((r) => (
                    <Button
                      key={r.assetId}
                      size="sm"
                      variant={r.assetId === (selectedAssetId || tonerRows[0].assetId) ? 'default' : 'outline'}
                      onClick={() => setSelectedAssetId(r.assetId)}
                      className="max-w-full shrink-0"
                      title={`${r.printerLabel} • ${r.model}`}
                    >
                      <span className="truncate max-w-[260px]">{r.printerLabel}</span>
                    </Button>
                  ))}
                </div>

                <div className="mt-3">
                  <Slider
                    value={[printerScrollValue]}
                    min={0}
                    max={Math.max(1, printerScrollMax)}
                    step={1}
                    disabled={printerScrollMax <= 0}
                    onValueChange={(v) => {
                      if (printerScrollMax <= 0) return;
                      const next = Math.max(0, Math.min(printerScrollMax, Number(v?.[0] ?? 0)));
                      const el = printerScrollerRef.current;
                      if (el) el.scrollLeft = next;
                      setPrinterScrollValue(next);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-sm">
              {selected ? (
                <>
                  <div className="px-6 py-5 border-b border-border">
                    <div className="flex flex-col gap-2">
                      <div className="text-xl font-semibold text-foreground">{selected.printerLabel}</div>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Brand: {selected.type}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">{selected.model}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">S/N: {selected.serial}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Asset: {selected.immoNumber}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Reception Date: {selected.dateIn}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Responsible: {selected.pilote}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Check: {selected.bciCheck}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Site: {selected.plant}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">IP: {selected.ipAddress}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Area: {selected.area}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Department: {selected.department}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Condition: {selected.condition}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                      {tonerOrder.map((c) => (
                        <motion.div
                          key={c}
                          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: EASE_OUT }}
                          whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                        >
                          {tonerSquare(c, selected.levels[c])}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-10 text-center text-muted-foreground">Select a printer.</div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
