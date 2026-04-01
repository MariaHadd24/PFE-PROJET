import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArchiveX,
  BadgeCheck,
  Cog,
  Laptop,
  Layers,
  Network,
  PhoneCall,
  Printer,
  Server,
  UserRoundCheck,
  Wrench,
} from 'lucide-react';

import { useData } from '../context/DataContext';
import type { Asset, AssetStatus } from '../types';

type Chip = {
  label: string;
  value: number;
};

type CategoryCard = {
  key: string;
  title: string;
  total: number;
  chips: Chip[];
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
};

const PIE_COLORS = [
  'var(--chart-blue-1)',
  'var(--chart-2)',
  'var(--chart-4)',
  'var(--chart-1)',
  'var(--destructive)',
  'var(--chart-blue-5)',
  'var(--chart-3)',
];

function norm(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function haystack(asset: Asset): string {
  return [
    norm(asset.category),
    norm(asset.type),
    norm(asset.model),
    norm(asset.description),
    norm(asset.department),
    norm(asset.supplier),
  ].join(' ');
}

function includesOne(text: string, keys: string[]): boolean {
  for (const key of keys) {
    if (text.includes(key)) return true;
  }
  return false;
}

function countStatus(assets: Asset[], status: AssetStatus): number {
  return assets.reduce((acc, a) => (a.status === status ? acc + 1 : acc), 0);
}

function buildCards(assets: Asset[]): CategoryCard[] {
  const rows = assets.map((asset) => {
    const key = norm(asset.assetTag) || norm(asset.serialNumber) || norm(asset.id);
    return { h: haystack(asset), k: key };
  });

  const count = (keys: string[]) => rows.reduce((acc, row) => (includesOne(row.h, keys) ? acc + 1 : acc), 0);
  const countUnique = (keys: string[]) => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.k) continue;
      if (!includesOne(row.h, keys)) continue;
      seen.add(row.k);
    }
    return seen.size;
  };
  const accessPointsCount = (() => {
    // Assets IT's APs view effectively counts unique devices (deduped by identity),
    // while the raw assets list can contain duplicates.
    const seen = new Set<string>();
    for (const asset of assets) {
      if (norm(asset.category) !== 'aps') continue;
      const tag = norm(asset.assetTag);
      const sn = norm(asset.serialNumber);
      const id = norm(asset.id);
      const key = tag || sn || id;
      if (key) seen.add(key);
    }
    return seen.size;
  })();

  const ciscoCount = (() => {
    const seen = new Set<string>();
    for (const asset of assets) {
      if (norm(asset.category) !== 'cisco') continue;
      const key = norm(asset.assetTag) || norm(asset.serialNumber) || norm(asset.id);
      if (key) seen.add(key);
    }
    return seen.size;
  })();

  const countCategoryUnique = (categories: string[]) => {
    const allowed = new Set(categories.map((c) => String(c).trim().toLowerCase()));
    const seen = new Set<string>();
    for (const asset of assets) {
      const cat = norm(asset.category);
      if (!allowed.has(cat)) continue;
      const key = norm(asset.assetTag) || norm(asset.serialNumber) || norm(asset.id);
      if (key) seen.add(key);
    }
    return seen.size;
  };

  const machinesTotals = (() => {
    const workstation = countCategoryUnique(['workstation']);
    const notebook = countCategoryUnique(['notebook']);
    const monitor = countCategoryUnique(['monitor']);

    const docking = countCategoryUnique(['docking station']);

    // Total should be unique across the union of these groups.
    const totalSeen = new Set<string>();
    for (const asset of assets) {
      const cat = norm(asset.category);
      if (cat !== 'workstation' && cat !== 'notebook' && cat !== 'monitor' && cat !== 'docking station') continue;
      const key = norm(asset.assetTag) || norm(asset.serialNumber) || norm(asset.id);
      if (key) totalSeen.add(key);
    }

    return { total: totalSeen.size, workstation, notebook, monitor, docking };
  })();

  const printersTotals = (() => {
    const brandOf = (asset: Asset): string => {
      const existing = String((asset as any)?.type ?? '').trim();
      if (existing) return existing;
      const modelRaw = String(asset.model ?? '').trim();
      if (!modelRaw) return '';
      const model = modelRaw.toLowerCase();
      if (model.includes('brother')) return 'Brother';
      if (model.includes('kyocera')) return 'KYOCERA';
      if (model.includes('zebra') || /\bzt\d{3,4}\b/.test(model)) return 'ZEBRA';
      if (model.includes('hp') || model.includes('laserjet') || model.includes('officejet')) return 'HP';
      return '';
    };

    const keyOf = (asset: Asset) => norm(asset.assetTag) || norm(asset.serialNumber) || norm(asset.id);

    const totalSeen = new Set<string>();
    const zebraSeen = new Set<string>();
    const hpSeen = new Set<string>();
    const kyoceraSeen = new Set<string>();

    for (const asset of assets) {
      if (norm(asset.category) !== 'printer') continue;
      const key = keyOf(asset);
      if (!key) continue;
      totalSeen.add(key);
      const brand = brandOf(asset).trim().toLowerCase();
      if (!brand) continue;
      if (brand === 'zebra') zebraSeen.add(key);
      if (brand === 'hp') hpSeen.add(key);
      if (brand === 'kyocera') kyoceraSeen.add(key);
    }

    return {
      total: totalSeen.size,
      zebra: zebraSeen.size,
      hp: hpSeen.size,
      kyocera: kyoceraSeen.size,
    };
  })();

  const scannersCount = (() => {
    const allowed = new Set(['scanner', 'scanners', 'cradle', 'barcode scanner', 'pistolet'].map((s) => s.toLowerCase()));
    const seen = new Set<string>();
    for (const asset of assets) {
      const key = norm(asset.assetTag) || norm(asset.serialNumber) || norm(asset.id);
      if (!key) continue;

      const cat = norm(asset.category);
      const section = norm((asset as any)?.section);
      if (!allowed.has(cat) && !allowed.has(section)) continue;
      seen.add(key);
    }
    return seen.size;
  })();

  return [
    {
      key: 'networking',
      title: 'Networking',
      total: countUnique(['cisco', 'network', 'switch', 'router', 'access point', 'ap ', 'wifi', 'kaba', 'terminal ip']),
      chips: [
        { label: 'Access points', value: accessPointsCount },
        { label: 'Cisco', value: ciscoCount },
        { label: 'Lecteurs Kaba', value: countUnique(['kaba', 'terminal ip']) },
      ],
      icon: Network,
      gradient: 'from-[#2D56FF] via-[#2850F2] to-[#2147DB]',
    },
    {
      key: 'servers',
      title: 'Servers',
      total: count(['server', 'srv', 'sv physique', 'vm', 'virtual']),
      chips: [
        { label: 'VMs', value: count(['vm', 'virtual']) },
        { label: 'SV Physique', value: count(['server', 'srv', 'sv physique']) },
      ],
      icon: Server,
      gradient: 'from-[#11B992] via-[#0FAF8A] to-[#0B9D7B]',
    },
    {
      key: 'machines',
      title: 'Machines',
      total: machinesTotals.total,
      chips: [
        { label: 'Workstation', value: machinesTotals.workstation },
        { label: 'Notebook', value: machinesTotals.notebook },
        { label: 'Monitor', value: machinesTotals.monitor },
        { label: 'Docking station', value: machinesTotals.docking },
      ],
      icon: Laptop,
      gradient: 'from-[#F7CE24] via-[#F0C100] to-[#E3AD00]',
    },
    {
      key: 'printers',
      title: 'Printers',
      total: printersTotals.total,
      chips: [
        { label: 'Zebra', value: printersTotals.zebra },
        { label: 'HP', value: printersTotals.hp },
        { label: 'KYOCERA', value: printersTotals.kyocera },
      ],
      icon: Printer,
      gradient: 'from-[#FF26B0] via-[#FF149E] to-[#E1008D]',
    },
    {
      key: 'voip',
      title: 'VoIP',
      total: count(['voip', 'ip phone', 'sip', 'yealink', 'alcatel', 'phone']),
      chips: [{ label: 'IP Phones', value: count(['voip', 'ip phone', 'sip', 'phone']) }],
      icon: PhoneCall,
      gradient: 'from-[#FF255E] via-[#FF0E53] to-[#E10045]',
    },
    {
      key: 'production',
      title: 'Production',
      total: countUnique(['scanner', 'barcode', 'pistolet', 'komax', 'agv', 'cradle']),
      chips: [
        { label: 'Scanners', value: scannersCount },
        { label: 'Komax', value: countUnique(['komax']) },
        { label: 'AGV', value: countUnique(['agv']) },
      ],
      icon: Cog,
      gradient: 'from-[#2644FF] via-[#213CE8] to-[#1A33CE]',
    },
  ];
}

function DashboardCategoryCard({
  card,
  order,
  dimmed,
  isExpanded,
  onCardClick,
}: {
  card: CategoryCard;
  order: number;
  dimmed?: boolean;
  isExpanded?: boolean;
  onCardClick?: (key: string) => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const Icon = card.icon;

  const navigate = useNavigate();

  const { assets } = useData();

  const [openChipLabel, setOpenChipLabel] = useState<string | null>(null);

  const [isApOpen, setIsApOpen] = useState(false);
  const [isCiscoOpen, setIsCiscoOpen] = useState(false);
  const [isScannersOpen, setIsScannersOpen] = useState(false);

  const expanded = Boolean(isExpanded);

  const goToStockInventory = (filter: { activeCategory?: string; searchTerm?: string }) => {
    navigate('/stock-inventory', { state: { stockInventoryFilter: filter } });
  };

  return (
    <motion.article
      layout
      className={
        dimmed
          ? 'hidden'
          : 'group relative min-w-0 flex-1 cursor-pointer overflow-hidden rounded-3xl p-4 text-white shadow-2xl ring-1 ring-white/20 transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40'
      }
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
      animate={
        shouldReduceMotion
          ? { opacity: 1 }
          : dimmed
            ? { opacity: 0, y: 10, scale: 0.98 }
            : {
                opacity: 1,
                y: expanded ? -6 : 0,
                scale: expanded ? 1.01 : 1,
                zIndex: expanded ? 30 : 1,
              }
      }
      exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.98 }}
      onClick={() => {
        onCardClick?.(card.key);
      }}
      tabIndex={0}
      role="button"
      aria-pressed={expanded}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCardClick?.(card.key);
        }
      }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : {
              duration: 0.24,
              ease: 'easeOut',
              delay: Math.min(order * 0.05, 0.24),
              layout: { type: 'spring', stiffness: 320, damping: 30, mass: 0.7 },
            }
      }
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} ${shouldReduceMotion ? '' : 'animate-gradient'}`} />
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/5 to-black/25" />
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.36) 1px, transparent 0)',
          backgroundSize: '11px 11px',
        }}
      />
      <div
        className={
          'absolute -right-12 -top-12 h-32 w-32 rounded-full bg-white/20 blur-xl ' +
          (shouldReduceMotion ? '' : 'animate-float-slow')
        }
      />
      <div
        className={
          'absolute -bottom-16 -left-16 h-36 w-36 rounded-full bg-white/10 blur-2xl ' +
          (shouldReduceMotion ? '' : 'animate-float-slower')
        }
      />
      <div
        className={
          'absolute inset-0 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 ' +
          (shouldReduceMotion ? '' : 'group-hover:animate-shimmer')
        }
        style={{
          backgroundImage:
            'linear-gradient(120deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.28) 45%, rgba(255,255,255,0) 70%)',
        }}
      />

      <div className="relative min-h-[300px] space-y-5">
        <div className="flex items-start justify-between">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/20 shadow-sm">
            <Icon className="h-5 w-5 opacity-95 drop-shadow-sm" />
          </div>
          <div className="rounded-full bg-white/95 px-3 py-1 text-sm font-black tabular-nums text-slate-900 shadow-sm">
            {card.total}
          </div>
        </div>

        <h2 className="text-xl xl:text-[28px] leading-[1.1] font-black tracking-tight drop-shadow-sm">
          {card.title}
        </h2>

        <div className="space-y-2">
          {card.chips.map((chip) => {
            const showApPreview = card.key === 'networking' && chip.label === 'Access points';
            const showCiscoExpand = card.key === 'networking' && chip.label === 'Cisco';
            const showScannersExpand = card.key === 'production' && chip.label === 'Scanners';

            const isGenericDetailsChip = !showApPreview && !showCiscoExpand && !showScannersExpand;
            const genericOpen = openChipLabel === chip.label;

            const normKey = (v: unknown) => String(v ?? '').trim().toLowerCase();
            const textOf = (a: Asset) =>
              [
                normKey(a.category),
                normKey(a.type),
                normKey(a.model),
                normKey(a.description),
                normKey(a.department),
                normKey(a.supplier),
              ].join(' ');
            const keyOf = (a: Asset) => normKey(a.assetTag) || normKey(a.serialNumber) || normKey(a.id);
            const dedupeByKey = (list: Asset[]) => {
              const seen = new Set<string>();
              const out: Asset[] = [];
              for (const a of list) {
                const k = keyOf(a);
                if (!k) continue;
                if (seen.has(k)) continue;
                seen.add(k);
                out.push(a);
              }
              return out;
            };

            const getChipAssets = (): Asset[] => {
              const k = card.key;
              const label = chip.label;

              if (k === 'servers') {
                const hay = (a: Asset) => textOf(a);
                if (label === 'VMs') return dedupeByKey(assets.filter((a) => hay(a).includes('vm') || hay(a).includes('virtual')));
                if (label === 'SV Physique') {
                  return dedupeByKey(assets.filter((a) => {
                    const h = hay(a);
                    return h.includes('server') || h.includes('srv') || h.includes('sv physique');
                  }));
                }
              }

              if (k === 'machines') {
                if (label === 'Workstation') return dedupeByKey(assets.filter((a) => normKey(a.category) === 'workstation'));
                if (label === 'Notebook') return dedupeByKey(assets.filter((a) => normKey(a.category) === 'notebook'));
                if (label === 'Monitor') return dedupeByKey(assets.filter((a) => normKey(a.category) === 'monitor'));
                if (label === 'Docking station') return dedupeByKey(assets.filter((a) => normKey(a.category) === 'docking station'));
              }

              if (k === 'printers') {
                const brandOf = (a: Asset): string => {
                  const existing = String((a as any)?.type ?? '').trim();
                  if (existing) return existing;
                  const modelRaw = String(a.model ?? '').trim();
                  if (!modelRaw) return '';
                  const m = modelRaw.toLowerCase();
                  if (m.includes('brother')) return 'Brother';
                  if (m.includes('kyocera')) return 'KYOCERA';
                  if (m.includes('zebra') || /\bzt\d{3,4}\b/.test(m)) return 'ZEBRA';
                  if (m.includes('hp') || m.includes('laserjet') || m.includes('officejet')) return 'HP';
                  return '';
                };

                const base = assets.filter((a) => normKey(a.category) === 'printer');
                if (label === 'Zebra') return dedupeByKey(base.filter((a) => brandOf(a).trim().toLowerCase() === 'zebra'));
                if (label === 'HP') return dedupeByKey(base.filter((a) => brandOf(a).trim().toLowerCase() === 'hp'));
                if (label === 'KYOCERA') return dedupeByKey(base.filter((a) => brandOf(a).trim().toLowerCase() === 'kyocera'));
              }

              if (k === 'voip') {
                const hay = (a: Asset) => textOf(a);
                if (label === 'IP Phones') {
                  return dedupeByKey(assets.filter((a) => {
                    const h = hay(a);
                    return h.includes('voip') || h.includes('ip phone') || h.includes('sip') || h.includes('phone');
                  }));
                }
              }

              if (k === 'production') {
                const hay = (a: Asset) => textOf(a);
                if (label === 'Scanners') {
                  return dedupeByKey(assets.filter((a) => {
                    const h = hay(a);
                    return h.includes('scanner') || h.includes('barcode') || h.includes('pistolet') || h.includes('cradle');
                  }));
                }
                if (label === 'Komax') return dedupeByKey(assets.filter((a) => hay(a).includes('komax')));
                if (label === 'AGV') return dedupeByKey(assets.filter((a) => hay(a).includes('agv')));
              }

              if (k === 'networking') {
                const hay = (a: Asset) => textOf(a);
                if (label === 'Lecteurs Kaba') return dedupeByKey(assets.filter((a) => {
                  const h = hay(a);
                  return h.includes('kaba') || h.includes('terminal ip');
                }));
              }

              return [];
            };

            if (showApPreview) {
              const viewFilter = { activeCategory: 'APs', searchTerm: '' };
              return (
                <div key={chip.label} className="space-y-2">
                  <div className="flex w-full items-center justify-between gap-3 rounded-full bg-white/10 px-3 py-1 backdrop-blur-md ring-1 ring-white/15 shadow-sm">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsApOpen((v) => !v);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-expanded={isApOpen}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/70" />
                      <span className="truncate text-[13px] font-semibold leading-snug text-white/95">{chip.label}</span>
                    </button>

                    <div className="inline-flex items-center gap-2">
                      {expanded ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            goToStockInventory(viewFilter);
                          }}
                          className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/90 ring-1 ring-white/20"
                        >
                          View
                        </button>
                      ) : null}
                      <span className="inline-flex min-w-9 items-center justify-center rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-black tabular-nums text-slate-900 shadow-sm">
                        {chip.value}
                      </span>
                    </div>
                  </div>

                  {isApOpen ? <AccessPointsHoverPreview /> : null}
                </div>
              );
            }

            if (showCiscoExpand) {
              const viewFilter = { activeCategory: 'Cisco', searchTerm: '' };
              return (
                <div key={chip.label} className="space-y-2">
                  <div className="flex w-full items-center justify-between gap-3 rounded-full bg-white/10 px-3 py-1 backdrop-blur-md ring-1 ring-white/15 shadow-sm">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCiscoOpen((v) => !v);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-expanded={isCiscoOpen}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/70" />
                      <span className="truncate text-[13px] font-semibold leading-snug text-white/95">{chip.label}</span>
                    </button>

                    <div className="inline-flex items-center gap-2">
                      {expanded ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            goToStockInventory(viewFilter);
                          }}
                          className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/90 ring-1 ring-white/20"
                        >
                          View
                        </button>
                      ) : null}
                      <span className="inline-flex min-w-9 items-center justify-center rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-black tabular-nums text-slate-900 shadow-sm">
                        {chip.value}
                      </span>
                    </div>
                  </div>

                  {isCiscoOpen ? <CiscoBreakdown showView={expanded} /> : null}
                </div>
              );
            }

            if (showScannersExpand) {
              const viewFilter = { activeCategory: 'Scanners', searchTerm: '' };
              return (
                <div key={chip.label} className="space-y-2">
                  <div className="flex w-full items-center justify-between gap-3 rounded-full bg-white/10 px-3 py-1 backdrop-blur-md ring-1 ring-white/15 shadow-sm">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsScannersOpen((v) => !v);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-expanded={isScannersOpen}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/70" />
                      <span className="truncate text-[13px] font-semibold leading-snug text-white/95">{chip.label}</span>
                    </button>

                    <div className="inline-flex items-center gap-2">
                      {expanded ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            goToStockInventory(viewFilter);
                          }}
                          className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/90 ring-1 ring-white/20"
                        >
                          View
                        </button>
                      ) : null}
                      <span className="inline-flex min-w-9 items-center justify-center rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-black tabular-nums text-slate-900 shadow-sm">
                        {chip.value}
                      </span>
                    </div>
                  </div>

                  {isScannersOpen ? <ScannersBreakdown isExpanded={expanded} /> : null}
                </div>
              );
            }

            if (isGenericDetailsChip) {
              const detailsAssets = genericOpen ? getChipAssets() : [];
              const viewFilter = (() => {
                const k = card.key;
                const label = chip.label;

                if (k === 'machines') {
                  if (label === 'Workstation') return { activeCategory: 'Workstation', searchTerm: '' };
                  if (label === 'Notebook') return { activeCategory: 'Notebook', searchTerm: '' };
                  if (label === 'Monitor') return { activeCategory: 'Monitor', searchTerm: '' };
                  if (label === 'Docking station') return { activeCategory: 'Docking station', searchTerm: '' };
                }

                if (k === 'servers') {
                  if (label === 'VMs') return { activeCategory: 'Server', searchTerm: 'vm' };
                  if (label === 'SV Physique') return { activeCategory: 'Server', searchTerm: 'physique' };
                }

                if (k === 'printers') {
                  if (label === 'Zebra') return { activeCategory: 'Printer', searchTerm: 'zebra' };
                  if (label === 'HP') return { activeCategory: 'Printer', searchTerm: 'hp' };
                  if (label === 'KYOCERA') return { activeCategory: 'Printer', searchTerm: 'kyocera' };
                }

                if (k === 'voip') {
                  if (label === 'IP Phones') return { activeCategory: 'VoIP', searchTerm: 'voip' };
                }

                if (k === 'production') {
                  if (label === 'Scanners') return { activeCategory: 'Scanner', searchTerm: '' };
                  if (label === 'Komax') return { activeCategory: '', searchTerm: 'komax' };
                  if (label === 'AGV') return { activeCategory: '', searchTerm: 'agv' };
                }

                if (k === 'networking') {
                  if (label === 'Lecteurs Kaba') return { activeCategory: 'Kaba', searchTerm: '' };
                }

                return { activeCategory: '', searchTerm: '' };
              })();

              return (
                <div key={chip.label} className="space-y-2">
                  <div className="flex w-full items-center justify-between gap-3 rounded-full bg-white/10 px-3 py-1 backdrop-blur-md ring-1 ring-white/15 shadow-sm">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenChipLabel((prev) => (prev === chip.label ? null : chip.label));
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-expanded={genericOpen}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/70" />
                      <span className="truncate text-[13px] font-semibold leading-snug text-white/95">{chip.label}</span>
                    </button>

                    <div className="inline-flex items-center gap-2">
                      {expanded ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            goToStockInventory(viewFilter);
                          }}
                          className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/90 ring-1 ring-white/20"
                        >
                          View
                        </button>
                      ) : null}
                      <span className="inline-flex min-w-9 items-center justify-center rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-black tabular-nums text-slate-900 shadow-sm">
                        {chip.value}
                      </span>
                    </div>
                  </div>

                  {genericOpen ? <AssetsDetailsPreview title={chip.label} assets={detailsAssets} /> : null}
                </div>
              );
            }

            return (
              <div
                key={chip.label}
                className="flex items-center justify-between gap-3 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-md ring-1 ring-white/15 shadow-sm"
              >
                <span className="inline-flex min-w-0 items-center gap-2 text-[13px] font-semibold leading-snug text-white/95">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                  <span className="truncate">{chip.label}</span>
                </span>
                <span className="inline-flex min-w-9 items-center justify-center rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-black tabular-nums text-slate-900 shadow-sm">
                  {chip.value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.article>
  );
}

function CiscoBreakdown({ showView }: { showView?: boolean }) {
  const { assets } = useData();
  const navigate = useNavigate();

  const [openKey, setOpenKey] = useState<'switch' | 'wireless' | 'router' | null>(null);

  const goToStockInventory = (filter: { activeCategory?: string; searchTerm?: string }) => {
    navigate('/stock-inventory', { state: { stockInventoryFilter: filter } });
  };

  const breakdown = useMemo(() => {
    const seen = new Set<string>();
    const switchAssets: Asset[] = [];
    const wirelessAssets: Asset[] = [];
    const routerAssets: Asset[] = [];

    const textOf = (asset: Asset) => {
      return [
        norm(asset.category),
        norm(asset.type),
        norm(asset.model),
        norm(asset.description),
        norm(asset.department),
        norm(asset.supplier),
      ].join(' ');
    };

    const classify = (asset: Asset): 'switch' | 'wireless' | 'router' => {
      const text = textOf(asset);
      const model = norm(asset.model);
      const type = norm(asset.type);

      const isWirelessController =
        text.includes('wireless controller') ||
        text.includes(' wlc') ||
        text.includes('wlc ') ||
        model.includes('9800') ||
        model.includes('c9800');

      const isAccessPoint =
        type.includes('access point') ||
        model.startsWith('c912') ||
        model.startsWith('c913') ||
        model.startsWith('c911') ||
        /^c91\d{2}/.test(model);

      if (isWirelessController || isAccessPoint) return 'wireless';

      const isRouter = text.includes('router') || text.includes('isr');
      if (isRouter) return 'router';

      return 'switch';
    };

    for (const asset of assets) {
      if (norm(asset.category) !== 'cisco') continue;
      const key = norm(asset.assetTag) || norm(asset.serialNumber) || norm(asset.id);
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);

      const bucket = classify(asset);
      if (bucket === 'wireless') wirelessAssets.push(asset);
      else if (bucket === 'router') routerAssets.push(asset);
      else switchAssets.push(asset);
    }

    const sort = (list: Asset[]) =>
      list.sort((a, b) => {
        const siteCmp = String(a.site ?? '').localeCompare(String(b.site ?? ''));
        if (siteCmp !== 0) return siteCmp;
        const tagA = String(a.assetTag ?? a.serialNumber ?? a.id ?? '');
        const tagB = String(b.assetTag ?? b.serialNumber ?? b.id ?? '');
        return tagA.localeCompare(tagB);
      });

    sort(switchAssets);
    sort(wirelessAssets);
    sort(routerAssets);

    return { switchAssets, wirelessAssets, routerAssets };
  }, [assets]);

  return (
    <div className="rounded-2xl bg-black/10 p-3 backdrop-blur-md ring-1 ring-white/15">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[11px] font-black tracking-[0.2em] text-white/70">CISCO BREAKDOWN</p>
        <p className="text-[11px] font-semibold text-white/70">Click for details</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div className="space-y-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenKey((prev) => (prev === 'switch' ? null : 'switch'));
            }}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/8 px-3 py-2 text-left ring-1 ring-white/10"
            aria-expanded={openKey === 'switch'}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-white/70" />
              <span className="truncate text-sm font-bold text-white/95">Switch</span>
            </div>
            <div className="flex items-center gap-2">
              {showView ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToStockInventory({ activeCategory: 'Cisco', searchTerm: 'Switch' });
                  }}
                  className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/90 ring-1 ring-white/20"
                >
                  View
                </button>
              ) : null}
              <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-black tabular-nums text-slate-900 shadow-sm">
                {breakdown.switchAssets.length}
              </span>
            </div>
          </button>
          {openKey === 'switch' ? (
            <div className="pl-4">
              <AssetsDetailsPreview title="Switch" assets={breakdown.switchAssets} />
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenKey((prev) => (prev === 'wireless' ? null : 'wireless'));
            }}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/8 px-3 py-2 text-left ring-1 ring-white/10"
            aria-expanded={openKey === 'wireless'}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-white/70" />
              <span className="truncate text-sm font-bold text-white/95">Wireless controller</span>
            </div>
            <div className="flex items-center gap-2">
              {showView ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToStockInventory({ activeCategory: 'Cisco', searchTerm: 'Wireless Controller' });
                  }}
                  className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/90 ring-1 ring-white/20"
                >
                  View
                </button>
              ) : null}
              <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-black tabular-nums text-slate-900 shadow-sm">
                {breakdown.wirelessAssets.length}
              </span>
            </div>
          </button>
          {openKey === 'wireless' ? (
            <div className="pl-4">
              <AssetsDetailsPreview title="Wireless" assets={breakdown.wirelessAssets} />
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenKey((prev) => (prev === 'router' ? null : 'router'));
            }}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/8 px-3 py-2 text-left ring-1 ring-white/10"
            aria-expanded={openKey === 'router'}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-white/70" />
              <span className="truncate text-sm font-bold text-white/95">Router</span>
            </div>
            <div className="flex items-center gap-2">
              {showView ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToStockInventory({ activeCategory: 'Cisco', searchTerm: 'Router' });
                  }}
                  className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/90 ring-1 ring-white/20"
                >
                  View
                </button>
              ) : null}
              <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-black tabular-nums text-slate-900 shadow-sm">
                {breakdown.routerAssets.length}
              </span>
            </div>
          </button>
          {openKey === 'router' ? (
            <div className="pl-4">
              <AssetsDetailsPreview title="Router" assets={breakdown.routerAssets} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AssetsDetailsPreview({ title, assets }: { title: string; assets: Asset[] }) {
  if (assets.length === 0) return null;

  return (
    <div className="w-full max-w-full max-h-40 overflow-x-hidden overflow-y-auto rounded-2xl bg-black/10 p-2 backdrop-blur-md ring-1 ring-white/15">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[11px] font-black tracking-wide text-white/90">{title} details</p>
        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-black tabular-nums text-slate-900 shadow-sm">
          {assets.length}
        </span>
      </div>

      <div className="mt-2 space-y-1">
        {assets.slice(0, 10).map((asset) => {
          const key = norm(asset.assetTag) || norm(asset.serialNumber) || norm(asset.id);
          const tag = String(asset.assetTag ?? asset.serialNumber ?? asset.id ?? '').trim();
          const model = String(asset.model ?? '').trim();
          const site = String(asset.site ?? '').trim();

          return (
            <div
              key={key || tag}
              className="flex min-w-0 items-start justify-between gap-3 rounded-xl bg-white/10 px-2 py-1 ring-1 ring-white/10"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-extrabold text-white">{tag || '—'}</p>
                {model ? <p className="truncate text-[11px] text-white/80">{model}</p> : null}
              </div>
              {site ? (
                <span className="min-w-0 max-w-24 truncate rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-900 shadow-sm">
                  {site}
                </span>
              ) : null}
            </div>
          );
        })}
        {assets.length > 10 ? (
          <p className="px-1 pt-1 text-[11px] font-semibold text-white/75">+{assets.length - 10} more</p>
        ) : null}
      </div>
    </div>
  );
}

function AccessPointsHoverPreview() {
  const { assets } = useData();

  const accessPoints = useMemo(() => {
    const byKey = new Map<string, Asset>();
    for (const asset of assets) {
      if (norm(asset.category) !== 'aps') continue;
      const key = norm(asset.assetTag) || norm(asset.serialNumber) || norm(asset.id);
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, asset);
    }

    return Array.from(byKey.values()).sort((a, b) => {
      const siteCmp = String(a.site ?? '').localeCompare(String(b.site ?? ''));
      if (siteCmp !== 0) return siteCmp;
      const tagA = String(a.assetTag ?? a.serialNumber ?? a.id ?? '');
      const tagB = String(b.assetTag ?? b.serialNumber ?? b.id ?? '');
      return tagA.localeCompare(tagB);
    });
  }, [assets]);

  if (accessPoints.length === 0) return null;

  return (
    <div className="w-full max-w-full max-h-44 overflow-x-hidden overflow-y-auto rounded-2xl bg-white/12 p-2 backdrop-blur-md ring-1 ring-white/15">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[11px] font-black tracking-wide text-white/90">APs preview</p>
        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-black tabular-nums text-slate-900 shadow-sm">
          {accessPoints.length}
        </span>
      </div>

      <div className="mt-2 space-y-1">
        {accessPoints.map((asset) => {
          const key = norm(asset.assetTag) || norm(asset.serialNumber) || norm(asset.id);
          const tag = String(asset.assetTag ?? asset.serialNumber ?? asset.id ?? '').trim();
          const model = String(asset.model ?? '').trim();
          const site = String(asset.site ?? '').trim();

          return (
            <div
              key={key || tag}
              className="flex min-w-0 items-start justify-between gap-3 rounded-xl bg-white/10 px-2 py-1 ring-1 ring-white/10"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-extrabold text-white">{tag || '—'}</p>
                {model ? <p className="truncate text-[11px] text-white/80">{model}</p> : null}
              </div>
              {site ? (
                <span className="min-w-0 max-w-24 truncate rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-900 shadow-sm">
                  {site}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScannersBreakdown({ isExpanded }: { isExpanded?: boolean }) {
  const { assets } = useData();
  const navigate = useNavigate();

  const [openKey, setOpenKey] = useState<'pistolet' | 'cradle' | 'barcode' | null>(null);

  const goToStockInventory = (filter: { activeCategory?: string; searchTerm?: string }) => {
    navigate('/stock-inventory', { state: { stockInventoryFilter: filter } });
  };

  const breakdown = useMemo(() => {
    const seen = new Set<string>();
    const pistoletAssets: Asset[] = [];
    const cradleAssets: Asset[] = [];
    const barcodeAssets: Asset[] = [];

    const textOf = (asset: Asset) => {
      return [
        norm(asset.category),
        norm(asset.type),
        norm(asset.model),
        norm(asset.description),
        norm(asset.department),
        norm(asset.supplier),
        norm((asset as any).section),
      ].join(' ');
    };

    const classify = (asset: Asset): 'pistolet' | 'cradle' | 'barcode' | 'other' => {
      const text = textOf(asset);
      if (text.includes('pistolet')) return 'pistolet';
      if (text.includes('cradle')) return 'cradle';
      if (text.includes('barcode scanner')) return 'barcode';
      if (text.includes('scanner')) return 'barcode';
      return 'other';
    };

    for (const asset of assets) {
      const key = norm(asset.assetTag) || norm(asset.serialNumber) || norm(asset.id);
      if (!key) continue;
      if (seen.has(key)) continue;

      const bucket = classify(asset);
      if (bucket === 'other') continue;

      seen.add(key);
      if (bucket === 'pistolet') pistoletAssets.push(asset);
      else if (bucket === 'cradle') cradleAssets.push(asset);
      else if (bucket === 'barcode') barcodeAssets.push(asset);
    }

    const sort = (list: Asset[]) =>
      list.sort((a, b) => {
        const siteCmp = String(a.site ?? '').localeCompare(String(b.site ?? ''));
        if (siteCmp !== 0) return siteCmp;
        const tagA = String(a.assetTag ?? a.serialNumber ?? a.id ?? '');
        const tagB = String(b.assetTag ?? b.serialNumber ?? b.id ?? '');
        return tagA.localeCompare(tagB);
      });

    sort(pistoletAssets);
    sort(cradleAssets);
    sort(barcodeAssets);

    return { pistoletAssets, cradleAssets, barcodeAssets };
  }, [assets]);

  return (
    <div className="rounded-2xl bg-black/10 p-3 backdrop-blur-md ring-1 ring-white/15">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[11px] font-black tracking-[0.2em] text-white/70">SCANNERS BREAKDOWN</p>
        <p className="text-[11px] font-semibold text-white/70">Click for details</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div className="space-y-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenKey((prev) => (prev === 'pistolet' ? null : 'pistolet'));
            }}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/8 px-3 py-2 text-left ring-1 ring-white/10"
            aria-expanded={openKey === 'pistolet'}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-white/70" />
              <span className="truncate text-sm font-bold text-white/95">Pistolet</span>
            </div>
            <div className="inline-flex items-center gap-2">
              {isExpanded ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToStockInventory({ activeCategory: 'Scanner', searchTerm: 'pistolet' });
                  }}
                  className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/90 ring-1 ring-white/20"
                >
                  View
                </button>
              ) : null}
              <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-black tabular-nums text-slate-900 shadow-sm">
                {breakdown.pistoletAssets.length}
              </span>
            </div>
          </button>
          {openKey === 'pistolet' ? (
            <div className="pl-4">
              <AssetsDetailsPreview title="Pistolet" assets={breakdown.pistoletAssets} />
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenKey((prev) => (prev === 'cradle' ? null : 'cradle'));
            }}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/8 px-3 py-2 text-left ring-1 ring-white/10"
            aria-expanded={openKey === 'cradle'}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-white/70" />
              <span className="truncate text-sm font-bold text-white/95">Cradle</span>
            </div>
            <div className="inline-flex items-center gap-2">
              {isExpanded ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToStockInventory({ activeCategory: 'Scanner', searchTerm: 'cradle' });
                  }}
                  className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/90 ring-1 ring-white/20"
                >
                  View
                </button>
              ) : null}
              <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-black tabular-nums text-slate-900 shadow-sm">
                {breakdown.cradleAssets.length}
              </span>
            </div>
          </button>
          {openKey === 'cradle' ? (
            <div className="pl-4">
              <AssetsDetailsPreview title="Cradle" assets={breakdown.cradleAssets} />
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenKey((prev) => (prev === 'barcode' ? null : 'barcode'));
            }}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/8 px-3 py-2 text-left ring-1 ring-white/10"
            aria-expanded={openKey === 'barcode'}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-white/70" />
              <span className="truncate text-sm font-bold text-white/95">Barcode Scanner</span>
            </div>
            <div className="inline-flex items-center gap-2">
              {isExpanded ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToStockInventory({ activeCategory: 'Scanner', searchTerm: 'barcode' });
                  }}
                  className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/90 ring-1 ring-white/20"
                >
                  View
                </button>
              ) : null}
              <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-black tabular-nums text-slate-900 shadow-sm">
                {breakdown.barcodeAssets.length}
              </span>
            </div>
          </button>
          {openKey === 'barcode' ? (
            <div className="pl-4">
              <AssetsDetailsPreview title="Barcode Scanner" assets={breakdown.barcodeAssets} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
  icon,
  order,
}: {
  title: string;
  value: number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  order: number;
}) {
  const Icon = icon;
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut', delay: Math.min(order * 0.05, 0.25) }}
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      className="group premium-surface rounded-3xl p-5 transition-shadow duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      tabIndex={0}
    >
      <div className="absolute inset-0 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(120deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.22) 45%, rgba(255,255,255,0) 70%)',
          }}
        />
      </div>

      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-1 text-4xl font-black tabular-nums tracking-tight" style={{ color }}>
            {value}
          </p>
        </div>
        <div
          className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground shadow-sm ring-1 ring-white/30"
          style={{ backgroundColor: color }}
        >
          <Icon className="h-7 w-7 drop-shadow-sm" />
        </div>
      </div>
    </motion.div>
  );
}

export function DashboardPage() {
  const { assets, maintenanceTickets, purchaseRequests } = useData();
  const cards = useMemo(() => buildCards(assets), [assets]);

  const shouldReduceMotion = useReducedMotion();

  const [lockedCardKey, setLockedCardKey] = useState<string | null>(null);

  const expandedKey = lockedCardKey;
  const isAnyExpanded = Boolean(expandedKey);

  const onCardClick = (key: string) => {
    setLockedCardKey((prev) => {
      return prev === key ? null : key;
    });
  };

  const totals = useMemo(() => {
    return {
      total: assets.length,
      available: countStatus(assets, 'Available'),
      assigned: countStatus(assets, 'Assigned'),
      inRepair: countStatus(assets, 'InRepair'),
      retired: countStatus(assets, 'Retired'),
    };
  }, [assets]);

  const formatPercent = (pct: number) => `${Math.round(pct)}%`;

  const makePieTooltipFormatter = (total: number) => (value: any, name: any) => {
    const numericValue = Number(value) || 0;
    const percent = total > 0 ? (numericValue / total) * 100 : 0;
    return [`${numericValue} (${formatPercent(percent)})`, name];
  };

  const categoryChartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assets) {
      const key = String(a.category ?? '').trim() || 'Uncategorized';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [assets]);

  const categoryChartTotal = useMemo(() => {
    return categoryChartData.reduce((acc, entry) => acc + (Number(entry.value) || 0), 0);
  }, [categoryChartData]);

  const statusChartData = useMemo(() => {
    return [
      { name: 'Available', value: totals.available, color: 'var(--chart-2)' },
      { name: 'Assigned', value: totals.assigned, color: 'var(--chart-blue-1)' },
      { name: 'In Repair', value: totals.inRepair, color: 'var(--chart-4)' },
      { name: 'Retired', value: totals.retired, color: 'var(--destructive)' },
    ];
  }, [totals]);

  const statusChartTotal = useMemo(() => {
    return statusChartData.reduce((acc, entry) => acc + (Number(entry.value) || 0), 0);
  }, [statusChartData]);

  const maintenanceChartData = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const t of maintenanceTickets) {
      const status = String(t.status ?? 'Unknown').trim();
      byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    }
    return Array.from(byStatus.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [maintenanceTickets]);

  const purchaseChartData = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const p of purchaseRequests) {
      const status = String(p.status ?? 'Unknown').trim();
      byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    }
    return Array.from(byStatus.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [purchaseRequests]);

  return (
    <div className="relative p-4 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div
          className={
            'absolute -top-20 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl ' +
            (shouldReduceMotion ? '' : 'animate-float-slow')
          }
        />
        <div
          className={
            'absolute -bottom-24 right-[-10rem] h-96 w-96 rounded-full bg-accent/70 blur-3xl ' +
            (shouldReduceMotion ? '' : 'animate-float-slower')
          }
        />
      </div>

      <motion.div
        initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
        className="mb-8 flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Vue d’ensemble des actifs, tickets et demandes</p>
        </div>
      </motion.div>

      <div className="mb-8 flex flex-nowrap items-stretch justify-start gap-6 overflow-x-auto pb-4">
        {cards.map((card, i) => (
          <DashboardCategoryCard
            key={card.key}
            card={card}
            order={i}
            dimmed={isAnyExpanded && expandedKey !== card.key}
            isExpanded={expandedKey === card.key}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total Assets" value={totals.total} color="var(--chart-blue-10)" icon={Layers} order={0} />
        <StatCard title="Available" value={totals.available} color="var(--chart-2)" icon={BadgeCheck} order={1} />
        <StatCard title="Assigned" value={totals.assigned} color="var(--chart-blue-1)" icon={UserRoundCheck} order={2} />
        <StatCard title="In Repair" value={totals.inRepair} color="var(--chart-4)" icon={Wrench} order={3} />
        <StatCard title="Retired" value={totals.retired} color="var(--destructive)" icon={ArchiveX} order={4} />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <motion.section
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut', delay: 0.05 }}
          className="premium-surface flex h-full flex-col rounded-3xl p-5"
        >
          <h2 className="text-lg font-bold">Assets by Category</h2>
          <div className="mt-4 flex h-64 flex-col gap-3">
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                    labelLine={false}
                    label={false}
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={makePieTooltipFormatter(categoryChartTotal)}
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                    }}
                    labelStyle={{ color: 'var(--muted-foreground)', fontWeight: 700 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="h-28 min-h-0 w-full shrink-0 overflow-auto pr-1">
              <div className="space-y-1">
                {categoryChartData.map((entry, index) => {
                  const value = Number(entry.value) || 0;
                  const percent = categoryChartTotal > 0 ? (value / categoryChartTotal) * 100 : 0;
                  const color = PIE_COLORS[index % PIE_COLORS.length];

                  return (
                    <div key={String(entry.name)} className="flex items-center justify-between gap-2 rounded-xl px-1.5 py-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        <span className="truncate text-xs font-semibold">{String(entry.name)}</span>
                      </div>
                      <div className="shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                        {formatPercent(percent)}
                        <span className="ml-2 opacity-70">{value}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut', delay: 0.08 }}
          className="premium-surface flex h-full flex-col rounded-3xl p-5"
        >
          <h2 className="text-lg font-bold">Assets by Status</h2>
          <div className="mt-4 flex h-64 flex-col gap-3">
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                    labelLine={false}
                    label={false}
                  >
                    {statusChartData.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={makePieTooltipFormatter(statusChartTotal)}
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                    }}
                    labelStyle={{ color: 'var(--muted-foreground)', fontWeight: 700 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="h-28 min-h-0 w-full shrink-0 overflow-auto pr-1">
              <div className="space-y-1">
                {statusChartData.map((entry) => {
                  const value = Number(entry.value) || 0;
                  const percent = statusChartTotal > 0 ? (value / statusChartTotal) * 100 : 0;

                  return (
                    <div key={String(entry.name)} className="flex items-center justify-between gap-2 rounded-xl px-1.5 py-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="truncate text-xs font-semibold">{String(entry.name)}</span>
                      </div>
                      <div className="shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                        {formatPercent(percent)}
                        <span className="ml-2 opacity-70">{value}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut', delay: 0.11 }}
          className="premium-surface flex h-full flex-col rounded-3xl p-5"
        >
          <h2 className="text-lg font-bold">Maintenance Tickets</h2>
          <div className="mt-4 h-64">
            {maintenanceChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-muted-foreground">
                No data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={maintenanceChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600 }} />
                  <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                    }}
                    labelStyle={{ color: 'var(--muted-foreground)', fontWeight: 700 }}
                  />
                  <Bar dataKey="value" fill="var(--chart-blue-2)" radius={[10, 10, 10, 10]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut', delay: 0.14 }}
          className="premium-surface flex h-full flex-col rounded-3xl p-5"
        >
          <h2 className="text-lg font-bold">Purchase Requests</h2>
          <div className="mt-4 h-64">
            {purchaseChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-muted-foreground">
                No data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={purchaseChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600 }} />
                  <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                    }}
                    labelStyle={{ color: 'var(--muted-foreground)', fontWeight: 700 }}
                  />
                  <Bar dataKey="value" fill="var(--chart-2)" radius={[10, 10, 10, 10]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}