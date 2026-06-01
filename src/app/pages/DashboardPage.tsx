import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  ReferenceLine,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArchiveX,
  BadgeCheck,
  Cog,
  KeyRound,
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
import { formatMADCompact } from '../lib/money';

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

const END_OF_LIFE_YEARS = 5;

function parseDateValue(value: unknown): Date | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const ms = Date.parse(s);
  if (!Number.isNaN(ms)) return new Date(ms);
  return null;
}

function isEndOfLifeByAge(dateOut: unknown): boolean {
  const d = parseDateValue(dateOut);
  if (!d) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - END_OF_LIFE_YEARS);
  return d.getTime() <= cutoff.getTime();
}

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

function truncateLabel(input: unknown, max = 14): string {
  const s = String(input ?? '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

function CenterLabel({
  title,
  total,
  subtitle,
}: {
  title: string;
  total: number;
  subtitle?: string;
}) {
  const hasSubtitle = Boolean(subtitle);
  return (
    <g>
      {hasSubtitle ? (
        <text
          x="50%"
          y="34%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--muted-foreground)"
          fontWeight={800}
          fontSize={11}
        >
          {subtitle}
        </text>
      ) : null}

      <text
        x="50%"
        y={hasSubtitle ? '50%' : '48%'}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--foreground)"
        fontWeight={900}
        fontSize={22}
      >
        {total}
      </text>

      <text
        x="50%"
        y={hasSubtitle ? '66%' : '61%'}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--muted-foreground)"
        fontWeight={700}
        fontSize={11}
      >
        {title}
      </text>
    </g>
  );
}

function renderActiveDonutSector(props: any) {
  const outerRadius = Number(props?.outerRadius ?? 0);
  return (
    <Sector
      {...props}
      outerRadius={outerRadius + 7}
      stroke="var(--background)"
      strokeWidth={2}
    />
  );
}

function ChartGradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor={`color-mix(in oklch, ${color} 92%, var(--background))`} />
      <stop offset="100%" stopColor={`color-mix(in oklch, ${color} 62%, transparent)`} />
    </linearGradient>
  );
}

function averageValue(rows: Array<{ value?: unknown }>): number {
  const values = rows
    .map((r) => Number((r as any)?.value) || 0)
    .filter((v) => Number.isFinite(v) && v > 0);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function makeBarValuePercentLabel(total?: number, withPercent = true) {
  return (props: any) => {
    const value = Number(props?.value ?? 0);
    const pct = withPercent && total && total > 0 ? Math.round((value / total) * 100) : null;

    const x = Number(props?.x ?? 0) + Number(props?.width ?? 0) + 8;
    const y = Number(props?.y ?? 0) + Number(props?.height ?? 0) / 2;

    const text = pct != null ? `${value} (${pct}%)` : String(value);
    return (
      <text
        x={x}
        y={y}
        dominantBaseline="middle"
        textAnchor="start"
        fill="var(--muted-foreground)"
        fontSize={11}
        fontWeight={800}
      >
        {text}
      </text>
    );
  };
}

function TooltipCard({
  label,
  payload,
  total,
}: {
  label?: any;
  payload?: any[];
  total?: number;
}) {
  const items = Array.isArray(payload) ? payload : [];
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
      {label != null ? <div className="text-xs font-semibold text-muted-foreground">{String(label)}</div> : null}
      <div className="mt-1 space-y-1">
        {items
          .filter((p) => p && (p.value != null || p.payload))
          .map((p, idx) => {
            const name = String(p?.name ?? p?.dataKey ?? '');
            const value = Number(p?.value ?? 0);
            const percent = total && total > 0 ? (value / total) * 100 : null;
            const color = String(p?.color ?? 'var(--muted-foreground)');
            return (
              <div key={`${name}-${idx}`} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="truncate font-semibold text-foreground">{name}</span>
                </div>
                <span className="shrink-0 font-black tabular-nums text-foreground">
                  {value}
                  {percent != null ? <span className="ml-2 text-muted-foreground">({Math.round(percent)}%)</span> : null}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
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
  const countUniqueWithin = (baseKeys: string[], keys: string[]) => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.k) continue;
      if (!includesOne(row.h, baseKeys)) continue;
      if (!includesOne(row.h, keys)) continue;
      seen.add(row.k);
    }
    return seen.size;
  };
  const uniqueKeysWithin = (baseKeys: string[], keys: string[]) => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.k) continue;
      if (!includesOne(row.h, baseKeys)) continue;
      if (!includesOne(row.h, keys)) continue;
      seen.add(row.k);
    }
    return seen;
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

  const kabaTotals = (() => {
    const base = ['kaba', 'terminal ip', 'pointeuse', 'datamanager', 'data manager'];

    const baseSet = uniqueKeysWithin(base, base);

    const datamanagerSet = uniqueKeysWithin(base, ['datamanager', 'data manager', 'data-manager']);
    const pointeuseSet = uniqueKeysWithin(base, ['terminal ip', 'pointeuse', 'pointeuse ip']);

    const lecteurSet = new Set<string>();
    for (const k of baseSet) {
      if (datamanagerSet.has(k)) continue;
      if (pointeuseSet.has(k)) continue;
      lecteurSet.add(k);
    }

    return {
      total: baseSet.size,
      datamanager: datamanagerSet.size,
      pointeuseIp: pointeuseSet.size,
      lecteurKaba: lecteurSet.size,
    };
  })();

  return [
    {
      key: 'networking',
      title: 'Networking',
      total: countUnique(['cisco', 'network', 'switch', 'router', 'access point', 'ap ', 'wifi']),
      chips: [
        { label: 'Access points', value: accessPointsCount },
        { label: 'Cisco', value: ciscoCount },
      ],
      icon: Network,
      gradient: 'from-[#2D56FF] via-[#2850F2] to-[#2147DB]',
    },
    {
      key: 'kaba',
      title: 'Kaba',
      total: kabaTotals.total,
      chips: [
        { label: 'Datamanager', value: kabaTotals.datamanager },
        { label: 'Pointeuse IP', value: kabaTotals.pointeuseIp },
        { label: 'Lecteur Kaba', value: kabaTotals.lecteurKaba },
      ],
      icon: KeyRound,
      gradient: 'from-[#8B5CF6] via-[#7C3AED] to-[#6D28D9]',
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
      gradient: 'from-[#F97316] via-[#FB923C] to-[#EA580C]',
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
          : 'group relative min-w-[220px] flex-1 cursor-pointer overflow-hidden rounded-3xl p-5 text-white shadow-2xl ring-1 ring-white/20 transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40'
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
          <div className="rounded-2xl bg-white/95 px-3.5 py-1.5 text-xs font-extrabold tracking-wide tabular-nums text-slate-900 shadow-sm ring-1 ring-white/40">
            {card.total}
          </div>
        </div>

        <h2 className="break-words text-lg xl:text-2xl leading-[1.05] font-black tracking-tight drop-shadow-sm">
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

              if (k === 'kaba') {
                const hay = (a: Asset) => textOf(a);
                const isKaba = (a: Asset) => {
                  const h = hay(a);
                  return (
                    h.includes('kaba') ||
                    h.includes('terminal ip') ||
                    h.includes('pointeuse') ||
                    h.includes('datamanager') ||
                    h.includes('data manager')
                  );
                };

                const isDatamanager = (a: Asset) => {
                  const h = hay(a);
                  return h.includes('datamanager') || h.includes('data manager') || h.includes('data-manager');
                };

                const isPointeuse = (a: Asset) => {
                  const h = hay(a);
                  return h.includes('terminal ip') || h.includes('pointeuse') || h.includes('pointeuse ip');
                };

                if (label === 'Datamanager') {
                  return dedupeByKey(assets.filter((a) => isKaba(a) && isDatamanager(a)));
                }

                if (label === 'Pointeuse IP') {
                  return dedupeByKey(assets.filter((a) => isKaba(a) && isPointeuse(a)));
                }

                if (label === 'Lecteur Kaba') {
                  return dedupeByKey(assets.filter((a) => isKaba(a) && !isDatamanager(a) && !isPointeuse(a)));
                }
              }

              return [];
            };

            if (showApPreview) {
              const viewFilter = { activeCategory: 'APs', searchTerm: '' };
              return (
                <div key={chip.label} className="space-y-2">
                  <div className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-2 backdrop-blur-md ring-1 ring-white/15 shadow-sm">
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
                      <span className="truncate text-[13px] font-semibold leading-snug tracking-tight text-white/95">{chip.label}</span>
                    </button>

                    <div className="inline-flex items-center gap-2">
                      {expanded ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            goToStockInventory(viewFilter);
                          }}
                          className="rounded-xl bg-white/10 px-2.5 py-1 text-[11px] font-bold tracking-tight text-white/90 ring-1 ring-white/20"
                        >
                          View
                        </button>
                      ) : null}
                      <span className="inline-flex min-w-9 items-center justify-center rounded-xl bg-white/95 px-3 py-1 text-[11px] font-extrabold tracking-tight tabular-nums text-slate-900 shadow-sm">
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
                  <div className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-2 backdrop-blur-md ring-1 ring-white/15 shadow-sm">
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
                      <span className="truncate text-[13px] font-semibold leading-snug tracking-tight text-white/95">{chip.label}</span>
                    </button>

                    <div className="inline-flex items-center gap-2">
                      {expanded ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            goToStockInventory(viewFilter);
                          }}
                          className="rounded-xl bg-white/10 px-2.5 py-1 text-[11px] font-bold tracking-tight text-white/90 ring-1 ring-white/20"
                        >
                          View
                        </button>
                      ) : null}
                      <span className="inline-flex min-w-9 items-center justify-center rounded-xl bg-white/95 px-3 py-1 text-[11px] font-extrabold tracking-tight tabular-nums text-slate-900 shadow-sm">
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
                  <div className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-2 backdrop-blur-md ring-1 ring-white/15 shadow-sm">
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
                      <span className="truncate text-[13px] font-semibold leading-snug tracking-tight text-white/95">{chip.label}</span>
                    </button>

                    <div className="inline-flex items-center gap-2">
                      {expanded ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            goToStockInventory(viewFilter);
                          }}
                          className="rounded-xl bg-white/10 px-2.5 py-1 text-[11px] font-bold tracking-tight text-white/90 ring-1 ring-white/20"
                        >
                          View
                        </button>
                      ) : null}
                      <span className="inline-flex min-w-9 items-center justify-center rounded-xl bg-white/95 px-3 py-1 text-[11px] font-extrabold tracking-tight tabular-nums text-slate-900 shadow-sm">
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

                if (k === 'kaba') {
                  if (label === 'Datamanager') return { activeCategory: 'Kaba', searchTerm: 'datamanager' };
                  if (label === 'Pointeuse IP') return { activeCategory: 'Kaba', searchTerm: 'terminal ip' };
                  if (label === 'Lecteur Kaba') return { activeCategory: 'Kaba', searchTerm: 'kaba' };
                }

                return { activeCategory: '', searchTerm: '' };
              })();

              return (
                <div key={chip.label} className="space-y-2">
                  <div className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-2 backdrop-blur-md ring-1 ring-white/15 shadow-sm">
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
                      <span className="truncate text-[13px] font-semibold leading-snug tracking-tight text-white/95">{chip.label}</span>
                    </button>

                    <div className="inline-flex items-center gap-2">
                      {expanded ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            goToStockInventory(viewFilter);
                          }}
                          className="rounded-xl bg-white/10 px-2.5 py-1 text-[11px] font-bold tracking-tight text-white/90 ring-1 ring-white/20"
                        >
                          View
                        </button>
                      ) : null}
                      <span className="inline-flex min-w-9 items-center justify-center rounded-xl bg-white/95 px-3 py-1 text-[11px] font-extrabold tracking-tight tabular-nums text-slate-900 shadow-sm">
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
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-2 backdrop-blur-md ring-1 ring-white/15 shadow-sm"
              >
                <span className="inline-flex min-w-0 items-center gap-2 text-[13px] font-semibold leading-snug tracking-tight text-white/95">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                  <span className="truncate">{chip.label}</span>
                </span>
                <span className="inline-flex min-w-9 items-center justify-center rounded-xl bg-white/95 px-3 py-1 text-xs font-extrabold tracking-tight tabular-nums text-slate-900 shadow-sm">
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
  variant = 'default',
  onClick,
}: {
  title: string;
  value: number | string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  order: number;
  variant?: 'default' | 'admin';
  onClick?: () => void;
}) {
  const Icon = icon;
  const shouldReduceMotion = useReducedMotion();

  const displayValue = typeof value === 'number' ? value.toLocaleString() : value;
  const valueClass = typeof value === 'number' ? 'tabular-nums' : '';
  const valueSizeClass = (() => {
    if (typeof value === 'number') return 'text-4xl';
    const len = String(value ?? '').length;
    return len > 10 ? 'text-3xl' : 'text-4xl';
  })();

  const isAdmin = variant === 'admin';
  const cardClassName =
    'premium-surface rounded-3xl transition-shadow duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ' +
    (isAdmin ? 'min-h-[96px] p-4' : 'min-h-[104px] p-4');

  const iconStyle = isAdmin
    ? {
        background:
          `linear-gradient(135deg, color-mix(in oklch, ${color} 16%, transparent), color-mix(in oklch, ${color} 36%, transparent))`,
        color,
      }
    : {
        background:
          `linear-gradient(135deg, color-mix(in oklch, ${color} 92%, var(--background)), color-mix(in oklch, ${color} 72%, var(--background)))`,
      };

  const haloStyle = isAdmin
    ? undefined
    : ({
        background:
          `radial-gradient(900px circle at 85% 10%, color-mix(in oklch, ${color} 22%, transparent), transparent 60%),
           radial-gradient(900px circle at 10% 90%, color-mix(in oklch, ${color} 12%, transparent), transparent 55%)`,
      } as React.CSSProperties);

  const toplineStyle = ({
    background:
      `linear-gradient(to right, transparent, color-mix(in oklch, ${color} 34%, transparent), color-mix(in oklch, ${color} 18%, transparent), transparent)`,
  } as React.CSSProperties);

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1, y: 0  } : { opacity: 0, y: 10 }}
      animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut', delay: Math.min(order * 0.05, 0.25) }}
      whileHover={shouldReduceMotion ? undefined : { y: -1 }}
      className={cardClassName + (onClick ? ' cursor-pointer' : '')}
      tabIndex={onClick ? 0 : -1}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `${title} - open related page` : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {!isAdmin ? (
        <>
          <div className="pointer-events-none absolute inset-0" style={haloStyle} aria-hidden />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5" style={toplineStyle} aria-hidden />
        </>
      ) : null}

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={"h-1.5 w-1.5 shrink-0 rounded-full " + (isAdmin ? '' : 'opacity-70')}
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <p
              className={
                'text-[12px] font-semibold leading-none text-muted-foreground ' +
                (isAdmin ? 'tracking-[0.04em]' : 'tracking-[0.06em]')
              }
            >
              {title}
            </p>
          </div>
          <p
            className={"mt-1.5 whitespace-nowrap font-black leading-none tracking-tight " + valueSizeClass + ' ' + valueClass}
            style={isAdmin ? undefined : { color }}
          >
            {displayValue}
          </p>
        </div>
        <div
          className={
            'relative mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/20 ' +
            (isAdmin ? 'text-current' : 'text-primary-foreground')
          }
          style={iconStyle}
        >
          <Icon className="h-6 w-6 drop-shadow-sm text-current" />
        </div>
      </div>
    </motion.div>
  );
}

export function DashboardPage() {
  const { assets, maintenanceTickets, users, sites, categories, suppliers, departments } = useData();
  const cards = useMemo(() => buildCards(assets), [assets]);
  const navigate = useNavigate();

  const shouldReduceMotion = useReducedMotion();

  const [lockedCardKey, setLockedCardKey] = useState<string | null>(null);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number | null>(null);
  const [activeStatusIndex, setActiveStatusIndex] = useState<number | null>(null);
  const [activeLifecycleIndex, setActiveLifecycleIndex] = useState<number | null>(null);

  const expandedKey = lockedCardKey;
  const isAnyExpanded = Boolean(expandedKey);

  const onCardClick = (key: string) => {
    setLockedCardKey((prev) => {
      return prev === key ? null : key;
    });
  };

  const goToStockInventory = (filter?: {
    activeCategory?: string;
    searchTerm?: string;
    filterStatus?: AssetStatus | '';
  }) => {
    navigate('/stock-inventory', { state: { stockInventoryFilter: filter } });
  };

  const goToAdminTab = (tab: 'users' | 'roles' | 'sites' | 'categories' | 'suppliers' | 'departments') => {
    navigate(`/admin?tab=${tab}`);
  };

  const goToMaintenance = () => {
    navigate('/maintenance');
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

  const extraStats = useMemo(() => {
    const normalizeStatus = (value: unknown) => String(value ?? '').trim().toLowerCase();

    const eolByAge = assets.reduce((acc, a) => {
      if (a.status === 'Retired') return acc;
      return isEndOfLifeByAge((a as any)?.dateOut) ? acc + 1 : acc;
    }, 0);

    const ticketsTotal = maintenanceTickets.length;
    const ticketsOpen = maintenanceTickets.reduce((acc, t) => {
      const s = normalizeStatus((t as any)?.status);
      if (!s) return acc + 1;
      const closed =
        s.includes('closed') ||
        s.includes('done') ||
        s.includes('resolved') ||
        s.includes('completed') ||
        s.includes('finish') ||
        s.includes('cancel');
      return closed ? acc : acc + 1;
    }, 0);

    return {
      eolByAge,
      ticketsTotal,
      ticketsOpen,
    };
  }, [assets, maintenanceTickets]);

  const adminCounts = useMemo(() => {
    const roleSet = new Set<string>();
    for (const u of users) {
      const r = String((u as any)?.role ?? '').trim();
      if (r) roleSet.add(r);
    }

    return {
      users: users.length,
      roles: roleSet.size,
      sites: sites.length,
      categories: categories.length,
      suppliers: suppliers.length,
      departments: departments.length,
    };
  }, [categories.length, departments.length, sites.length, suppliers.length, users]);

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

  const categoryDonutData = useMemo(() => {
    const sorted = categoryChartData
      .map((e) => ({ name: String(e.name), value: Number((e as any).value) || 0 }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value);

    const top = sorted.slice(0, 8);
    const rest = sorted.slice(top.length);
    const restValue = rest.reduce((acc, e) => acc + e.value, 0);

    const withOthers = restValue > 0 ? [...top, { name: 'Others', value: restValue }] : top;
    return withOthers.map((e, index) => ({
      ...e,
      color: PIE_COLORS[index % PIE_COLORS.length],
    }));
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

  const maintenanceChartTotal = useMemo(() => {
    return maintenanceChartData.reduce((acc, entry) => acc + (Number((entry as any).value) || 0), 0);
  }, [maintenanceChartData]);

  const maintenanceChartAvg = useMemo(() => {
    return averageValue(maintenanceChartData as any);
  }, [maintenanceChartData]);

 

  const departmentChartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assets) {
      const key = String(a.department ?? '').trim() || 'Unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [assets]);

  const siteChartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assets) {
      const key = String((a as any)?.site ?? '').trim() || 'Unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [assets]);

  const siteChartTotal = useMemo(() => {
    return siteChartData.reduce((acc, entry) => acc + (Number((entry as any).value) || 0), 0);
  }, [siteChartData]);

  const siteChartAvg = useMemo(() => {
    return averageValue(siteChartData as any);
  }, [siteChartData]);

  const assetAgeChartData = useMemo(() => {
    const now = new Date();
    const buckets = [
      { name: '0–1y', value: 0 },
      { name: '1–2y', value: 0 },
      { name: '2–3y', value: 0 },
      { name: '3–5y', value: 0 },
      { name: '5y+', value: 0 },
    ];

    for (const a of assets) {
      const d = parseDateValue((a as any)?.acquisitionDate);
      if (!d) continue;
      const years = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (years < 1) buckets[0].value += 1;
      else if (years < 2) buckets[1].value += 1;
      else if (years < 3) buckets[2].value += 1;
      else if (years < 5) buckets[3].value += 1;
      else buckets[4].value += 1;
    }

    return buckets;
  }, [assets]);

  const assetAgeChartTotal = useMemo(() => {
    return assetAgeChartData.reduce((acc, entry) => acc + (Number((entry as any).value) || 0), 0);
  }, [assetAgeChartData]);

  const assetAgeChartAvg = useMemo(() => {
    return averageValue(assetAgeChartData as any);
  }, [assetAgeChartData]);

  const warrantyChartData = useMemo(() => {
    const now = new Date();
    const buckets = [
      { name: 'Expired', value: 0 },
      { name: '0–30d', value: 0 },
      { name: '31–60d', value: 0 },
      { name: '61–90d', value: 0 },
      { name: '90d+', value: 0 },
    ];

    const dayDiff = (d: Date) => Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    for (const a of assets) {
      const d = parseDateValue((a as any)?.warrantyEndDate);
      if (!d) continue;
      const days = dayDiff(d);
      if (days < 0) buckets[0].value += 1;
      else if (days <= 30) buckets[1].value += 1;
      else if (days <= 60) buckets[2].value += 1;
      else if (days <= 90) buckets[3].value += 1;
      else buckets[4].value += 1;
    }

    return buckets;
  }, [assets]);

  const warrantyChartTotal = useMemo(() => {
    return warrantyChartData.reduce((acc, entry) => acc + (Number((entry as any).value) || 0), 0);
  }, [warrantyChartData]);

  const warrantyChartAvg = useMemo(() => {
    return averageValue(warrantyChartData as any);
  }, [warrantyChartData]);

  const maintenanceCostByProviderChartData = useMemo(() => {
    const byProvider = new Map<string, number>();
    for (const t of maintenanceTickets) {
      const key = String((t as any)?.provider ?? '').trim() || 'Unknown';
      byProvider.set(key, (byProvider.get(key) ?? 0) + (Number((t as any)?.cost) || 0));
    }

    return Array.from(byProvider.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [maintenanceTickets]);

  const maintenanceCostByProviderTotal = useMemo(() => {
    return maintenanceCostByProviderChartData.reduce((acc, entry) => acc + (Number((entry as any).value) || 0), 0);
  }, [maintenanceCostByProviderChartData]);

  const maintenanceCostByProviderAvg = useMemo(() => {
    return averageValue(maintenanceCostByProviderChartData as any);
  }, [maintenanceCostByProviderChartData]);

  const activityTrendData = useMemo(() => {
    const now = new Date();
    const months: { key: string; start: Date }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, start: d });
    }

    const byKey = new Map<string, { month: string; tickets: number }>();
    for (const m of months) byKey.set(m.key, { month: m.key, tickets: 0 });

    const keyFor = (value: unknown) => {
      const d = parseDateValue(value);
      if (!d) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    for (const t of maintenanceTickets) {
      const k = keyFor((t as any)?.openDate);
      if (!k) continue;
      const row = byKey.get(k);
      if (row) row.tickets += 1;
    }

    return months.map((m) => byKey.get(m.key)!).filter(Boolean);
  }, [maintenanceTickets]);

  const activityTrendTotals = useMemo(() => {
    const t = activityTrendData.reduce((acc, row) => acc + (Number((row as any)?.tickets) || 0), 0);
    return { tickets: t };
  }, [activityTrendData]);

  const supplierChartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assets) {
      const raw = String(a.supplier ?? '').trim();
      const key = raw || 'Unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [assets]);

  const departmentChartTotal = useMemo(() => {
    return departmentChartData.reduce((acc, entry) => acc + (Number((entry as any).value) || 0), 0);
  }, [departmentChartData]);

  const departmentChartAvg = useMemo(() => {
    return averageValue(departmentChartData as any);
  }, [departmentChartData]);

  const supplierChartTotal = useMemo(() => {
    return supplierChartData.reduce((acc, entry) => acc + (Number((entry as any).value) || 0), 0);
  }, [supplierChartData]);

  const supplierChartAvg = useMemo(() => {
    return averageValue(supplierChartData as any);
  }, [supplierChartData]);

  const lifecycleChartData = useMemo(() => {
    const retired = totals.retired;
    const eol = extraStats.eolByAge;
    const ok = Math.max(0, totals.total - retired - eol);

    return [
      { name: 'OK', value: ok, color: 'var(--chart-2)' },
      { name: `EOL (>${END_OF_LIFE_YEARS}y)`, value: eol, color: 'var(--chart-1)' },
      { name: 'Retired', value: retired, color: 'var(--destructive)' },
    ];
  }, [extraStats.eolByAge, totals.retired, totals.total]);

  const lifecycleChartTotal = useMemo(() => {
    return lifecycleChartData.reduce((acc, entry) => acc + (Number(entry.value) || 0), 0);
  }, [lifecycleChartData]);

  const activeCategory = activeCategoryIndex != null ? categoryDonutData[activeCategoryIndex] : null;
  const categoryCenterTitle = activeCategory ? truncateLabel(activeCategory.name, 16) : 'TOTAL';
  const categoryCenterTotal = activeCategory ? Number((activeCategory as any).value || 0) : categoryChartTotal;
  const categoryCenterSubtitle =
    activeCategory && categoryChartTotal > 0 ? formatPercent((categoryCenterTotal / categoryChartTotal) * 100) : undefined;

  const activeStatus = activeStatusIndex != null ? statusChartData[activeStatusIndex] : null;
  const statusCenterTitle = activeStatus ? truncateLabel(activeStatus.name, 16) : 'TOTAL';
  const statusCenterTotal = activeStatus ? Number((activeStatus as any).value || 0) : statusChartTotal;
  const statusCenterSubtitle =
    activeStatus && statusChartTotal > 0 ? formatPercent((statusCenterTotal / statusChartTotal) * 100) : undefined;

  const activeLifecycle = activeLifecycleIndex != null ? lifecycleChartData[activeLifecycleIndex] : null;
  const lifecycleCenterTitle = activeLifecycle ? truncateLabel(activeLifecycle.name, 16) : 'TOTAL';
  const lifecycleCenterTotal = activeLifecycle ? Number((activeLifecycle as any).value || 0) : lifecycleChartTotal;
  const lifecycleCenterSubtitle =
    activeLifecycle && lifecycleChartTotal > 0 ? formatPercent((lifecycleCenterTotal / lifecycleChartTotal) * 100) : undefined;

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
        className="premium-surface relative mb-8 flex flex-col gap-3 overflow-hidden px-6 py-5 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="min-w-0">
          <div className="page-hero__topline" aria-hidden />
          <div className="flex items-start gap-4">
            <div
              className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-primary ring-1 ring-primary/15 shadow-sm"
              style={{
                background:
                  'linear-gradient(135deg, color-mix(in oklch, var(--primary) 16%, transparent), color-mix(in oklch, var(--chart-blue-5) 24%, transparent))',
              }}
              aria-hidden
            >
              <Layers className="h-[18px] w-[18px]" />
            </div>

            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight leading-[1.02] text-foreground sm:text-3xl lg:text-4xl">
                <span className="relative inline-block">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-clip-text text-transparent blur-[12px] opacity-45"
                    style={{
                      backgroundImage:
                        'linear-gradient(90deg, var(--primary), var(--chart-blue-5), color-mix(in oklch, var(--foreground) 82%, var(--primary)))',
                    }}
                  >
                    Dashboard
                  </span>
                  <span
                    className="relative bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        'linear-gradient(90deg, var(--primary), var(--chart-blue-5), color-mix(in oklch, var(--foreground) 82%, var(--primary)))',
                    }}
                  >
                    Dashboard
                  </span>
                </span>
              </h1>

              <div
                className="mt-2 h-1 w-24 rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, var(--primary), var(--chart-blue-5), transparent)',
                }}
                aria-hidden
              />

              <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
                Overview of assets and tickets
              </p>
            </div>
          </div>
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
        <StatCard title="Total Assets" value={totals.total} color="var(--chart-blue-10)" icon={Layers} order={0} onClick={() => goToStockInventory()} />
        <StatCard title="Available" value={totals.available} color="var(--chart-2)" icon={BadgeCheck} order={1} onClick={() => goToStockInventory({ filterStatus: 'Available' })} />
        <StatCard title="Assigned" value={totals.assigned} color="var(--chart-blue-1)" icon={UserRoundCheck} order={2} onClick={() => goToStockInventory({ filterStatus: 'Assigned' })} />
        <StatCard title="In Repair" value={totals.inRepair} color="var(--chart-4)" icon={Wrench} order={3} onClick={() => goToStockInventory({ filterStatus: 'InRepair' })} />
        <StatCard title="Retired" value={totals.retired} color="var(--destructive)" icon={ArchiveX} order={4} onClick={() => goToStockInventory({ filterStatus: 'Retired' })} />
        <StatCard title={`EOL (>${END_OF_LIFE_YEARS}y)`} value={extraStats.eolByAge} color="var(--chart-1)" icon={AlertTriangle} order={5} onClick={() => goToStockInventory({ activeCategory: 'Obsolete' })} />
        <StatCard title="Maintenance Tickets" value={extraStats.ticketsTotal} color="var(--chart-blue-5)" icon={Wrench} order={6} onClick={goToMaintenance} />
        <StatCard title="Open Tickets" value={extraStats.ticketsOpen} color="var(--chart-4)" icon={AlertTriangle} order={7} onClick={goToMaintenance} />
      </div>

      <section className="premium-surface mb-8 rounded-3xl p-5">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold tracking-tight text-foreground">Administration</h2>
            <p className="mt-1 text-sm text-muted-foreground">Reference data overview</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-6">
          <StatCard title="Users" value={adminCounts.users} color="var(--chart-blue-10)" icon={UserRoundCheck} order={0} variant="admin" onClick={() => goToAdminTab('users')} />
          <StatCard title="Roles" value={adminCounts.roles} color="var(--chart-blue-5)" icon={KeyRound} order={1} variant="admin" onClick={() => goToAdminTab('roles')} />
          <StatCard title="Sites" value={adminCounts.sites} color="var(--chart-2)" icon={Network} order={2} variant="admin" onClick={() => goToAdminTab('sites')} />
          <StatCard title="Categories" value={adminCounts.categories} color="var(--primary)" icon={Layers} order={3} variant="admin" onClick={() => goToAdminTab('categories')} />
          <StatCard title="Suppliers" value={adminCounts.suppliers} color="var(--chart-4)" icon={PhoneCall} order={4} variant="admin" onClick={() => goToAdminTab('suppliers')} />
          <StatCard title="Departments" value={adminCounts.departments} color="var(--chart-blue-1)" icon={Server} order={5} variant="admin" onClick={() => goToAdminTab('departments')} />
        </div>
      </section>

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
                    data={categoryDonutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                    labelLine={false}
                    label={false}
                    activeIndex={activeCategoryIndex ?? undefined}
                    activeShape={renderActiveDonutSector}
                    onMouseEnter={(_, index) => setActiveCategoryIndex(index)}
                    onMouseLeave={() => setActiveCategoryIndex(null)}
                    isAnimationActive={!shouldReduceMotion}
                  >
                    {categoryDonutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={String((entry as any).color ?? PIE_COLORS[index % PIE_COLORS.length])} />
                    ))}
                    <Label
                      content={() => (
                        <CenterLabel
                          title={categoryCenterTitle}
                          total={categoryCenterTotal}
                          subtitle={categoryCenterSubtitle}
                        />
                      )}
                      position="center"
                    />
                  </Pie>
                  <Tooltip
                    content={({ payload }) => <TooltipCard payload={payload as any[]} total={categoryChartTotal} />}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="h-28 min-h-0 w-full shrink-0 overflow-auto pr-1">
              <div className="space-y-1">
                {categoryDonutData.map((entry, index) => {
                  const value = Number(entry.value) || 0;
                  const percent = categoryChartTotal > 0 ? (value / categoryChartTotal) * 100 : 0;
                  const color = String((entry as any).color ?? PIE_COLORS[index % PIE_COLORS.length]);

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
                    activeIndex={activeStatusIndex ?? undefined}
                    activeShape={renderActiveDonutSector}
                    onMouseEnter={(_, index) => setActiveStatusIndex(index)}
                    onMouseLeave={() => setActiveStatusIndex(null)}
                    isAnimationActive={!shouldReduceMotion}
                  >
                    {statusChartData.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={entry.color} />
                    ))}
                    <Label
                      content={() => (
                        <CenterLabel
                          title={statusCenterTitle}
                          total={statusCenterTotal}
                          subtitle={statusCenterSubtitle}
                        />
                      )}
                      position="center"
                    />
                  </Pie>
                  <Tooltip
                    content={({ label, payload }) => <TooltipCard label={label} payload={payload as any[]} total={statusChartTotal} />}
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
                <BarChart data={maintenanceChartData} layout="vertical" margin={{ left: 12, right: 64, top: 8, bottom: 8 }}>
                  <defs>
                    <ChartGradient id="grad-maint" color="var(--chart-blue-2)" />
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }}
                    tickFormatter={(v) => truncateLabel(v, 14)}
                  />
                  {maintenanceChartAvg > 0 ? (
                    <ReferenceLine x={maintenanceChartAvg} stroke="var(--muted-foreground)" strokeOpacity={0.45} strokeDasharray="4 4" />
                  ) : null}
                  <Tooltip
                    content={({ label, payload }) => <TooltipCard label={label} payload={payload as any[]} total={maintenanceChartTotal} />}
                  />
                  <Bar
                    dataKey="value"
                    fill="url(#grad-maint)"
                    stroke="var(--chart-blue-2)"
                    strokeOpacity={0.75}
                    radius={[10, 10, 10, 10]}
                    barSize={18}
                    background={{ fill: 'color-mix(in oklch, var(--muted) 35%, transparent)', radius: 10 }}
                  >
                    <LabelList dataKey="value" content={makeBarValuePercentLabel(maintenanceChartTotal, true)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut', delay: 0.17 }}
          className="premium-surface flex h-full flex-col rounded-3xl p-5"
        >
          <h2 className="text-lg font-bold">Top Departments</h2>
          <div className="mt-4 h-64">
            {departmentChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-muted-foreground">
                No data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentChartData} layout="vertical" margin={{ left: 12, right: 48, top: 8, bottom: 8 }}>
                  <defs>
                    <ChartGradient id="grad-dept" color="var(--chart-blue-5)" />
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }}
                    tickFormatter={(v) => truncateLabel(v, 14)}
                  />
                  {departmentChartAvg > 0 ? (
                    <ReferenceLine x={departmentChartAvg} stroke="var(--muted-foreground)" strokeOpacity={0.4} strokeDasharray="4 4" />
                  ) : null}
                  <Tooltip
                    content={({ label, payload }) => <TooltipCard label={label} payload={payload as any[]} total={departmentChartTotal} />}
                  />
                  <Bar
                    dataKey="value"
                    fill="url(#grad-dept)"
                    stroke="var(--chart-blue-5)"
                    strokeOpacity={0.75}
                    radius={[10, 10, 10, 10]}
                    barSize={18}
                    background={{ fill: 'color-mix(in oklch, var(--muted) 32%, transparent)', radius: 10 }}
                  >
                    <LabelList dataKey="value" content={makeBarValuePercentLabel(departmentChartTotal, false)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut', delay: 0.19 }}
          className="premium-surface flex h-full flex-col rounded-3xl p-5"
        >
          <h2 className="text-lg font-bold">Assets by Site</h2>
          <div className="mt-4 h-64">
            {siteChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-muted-foreground">
                No data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={siteChartData} layout="vertical" margin={{ left: 12, right: 48, top: 8, bottom: 8 }}>
                  <defs>
                    <ChartGradient id="grad-site" color="var(--chart-blue-3)" />
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }}
                    tickFormatter={(v) => truncateLabel(v, 14)}
                  />
                  {siteChartAvg > 0 ? (
                    <ReferenceLine x={siteChartAvg} stroke="var(--muted-foreground)" strokeOpacity={0.4} strokeDasharray="4 4" />
                  ) : null}
                  <Tooltip content={({ label, payload }) => <TooltipCard label={label} payload={payload as any[]} total={siteChartTotal} />} />
                  <Bar
                    dataKey="value"
                    fill="url(#grad-site)"
                    stroke="var(--chart-blue-3)"
                    strokeOpacity={0.75}
                    radius={[10, 10, 10, 10]}
                    barSize={18}
                    background={{ fill: 'color-mix(in oklch, var(--muted) 32%, transparent)', radius: 10 }}
                  >
                    <LabelList dataKey="value" content={makeBarValuePercentLabel(siteChartTotal, false)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut', delay: 0.2 }}
          className="premium-surface flex h-full flex-col rounded-3xl p-5"
        >
          <h2 className="text-lg font-bold">Top Suppliers</h2>
          <div className="mt-4 h-64">
            {supplierChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-muted-foreground">
                No data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supplierChartData} layout="vertical" margin={{ left: 12, right: 48, top: 8, bottom: 8 }}>
                  <defs>
                    <ChartGradient id="grad-supplier" color="var(--chart-2)" />
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }}
                    tickFormatter={(v) => truncateLabel(v, 14)}
                  />
                  {supplierChartAvg > 0 ? (
                    <ReferenceLine x={supplierChartAvg} stroke="var(--muted-foreground)" strokeOpacity={0.4} strokeDasharray="4 4" />
                  ) : null}
                  <Tooltip
                    content={({ label, payload }) => <TooltipCard label={label} payload={payload as any[]} total={supplierChartTotal} />}
                  />
                  <Bar
                    dataKey="value"
                    fill="url(#grad-supplier)"
                    stroke="var(--chart-2)"
                    strokeOpacity={0.75}
                    radius={[10, 10, 10, 10]}
                    barSize={18}
                    background={{ fill: 'color-mix(in oklch, var(--muted) 32%, transparent)', radius: 10 }}
                  >
                    <LabelList dataKey="value" content={makeBarValuePercentLabel(supplierChartTotal, false)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut', delay: 0.22 }}
          className="premium-surface flex h-full flex-col rounded-3xl p-5"
        >
          <h2 className="text-lg font-bold">Assets Age Distribution</h2>
          <div className="mt-4 h-64">
            {assetAgeChartTotal === 0 ? (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-muted-foreground">
                No data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assetAgeChartData} margin={{ left: 8, right: 12, top: 8, bottom: 8 }}>
                  <defs>
                    <ChartGradient id="grad-age" color="var(--chart-blue-6)" />
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }} />
                  {assetAgeChartAvg > 0 ? (
                    <ReferenceLine y={assetAgeChartAvg} stroke="var(--muted-foreground)" strokeOpacity={0.4} strokeDasharray="4 4" />
                  ) : null}
                  <Tooltip content={({ label, payload }) => <TooltipCard label={label} payload={payload as any[]} total={assetAgeChartTotal} />} />
                  <Bar
                    dataKey="value"
                    fill="url(#grad-age)"
                    stroke="var(--chart-blue-6)"
                    strokeOpacity={0.75}
                    radius={[10, 10, 0, 0]}
                    barSize={28}
                    background={{ fill: 'color-mix(in oklch, var(--muted) 28%, transparent)' }}
                  >
                    <LabelList dataKey="value" position="top" fill="var(--muted-foreground)" fontSize={11} fontWeight={800} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut', delay: 0.24 }}
          className="premium-surface flex h-full flex-col rounded-3xl p-5"
        >
          <h2 className="text-lg font-bold">Warranty Timeline</h2>
          <div className="mt-4 h-64">
            {warrantyChartTotal === 0 ? (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-muted-foreground">
                No data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={warrantyChartData} margin={{ left: 8, right: 12, top: 8, bottom: 8 }}>
                  <defs>
                    <ChartGradient id="grad-warranty" color="var(--chart-4)" />
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }} />
                  {warrantyChartAvg > 0 ? (
                    <ReferenceLine y={warrantyChartAvg} stroke="var(--muted-foreground)" strokeOpacity={0.4} strokeDasharray="4 4" />
                  ) : null}
                  <Tooltip content={({ label, payload }) => <TooltipCard label={label} payload={payload as any[]} total={warrantyChartTotal} />} />
                  <Bar
                    dataKey="value"
                    fill="url(#grad-warranty)"
                    stroke="var(--chart-4)"
                    strokeOpacity={0.75}
                    radius={[10, 10, 0, 0]}
                    barSize={28}
                    background={{ fill: 'color-mix(in oklch, var(--muted) 28%, transparent)' }}
                  >
                    <LabelList dataKey="value" position="top" fill="var(--muted-foreground)" fontSize={11} fontWeight={800} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut', delay: 0.26 }}
          className="premium-surface flex h-full flex-col rounded-3xl p-5"
        >
          <h2 className="text-lg font-bold">Maintenance Cost by Provider</h2>
          <div className="mt-4 h-64">
            {maintenanceCostByProviderChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-muted-foreground">
                No data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={maintenanceCostByProviderChartData} layout="vertical" margin={{ left: 12, right: 64, top: 8, bottom: 8 }}>
                  <defs>
                    <ChartGradient id="grad-cost" color="var(--chart-blue-4)" />
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={160}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }}
                    tickFormatter={(v) => truncateLabel(v, 18)}
                  />
                  {maintenanceCostByProviderAvg > 0 ? (
                    <ReferenceLine x={maintenanceCostByProviderAvg} stroke="var(--muted-foreground)" strokeOpacity={0.4} strokeDasharray="4 4" />
                  ) : null}
                  <Tooltip
                    content={({ label, payload }) => {
                      const fixed = (Array.isArray(payload) ? payload : []).map((p: any) => ({ ...p, value: Number(p?.value) || 0 }));
                      return <TooltipCard label={label} payload={fixed as any[]} total={maintenanceCostByProviderTotal} />;
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="url(#grad-cost)"
                    stroke="var(--chart-blue-4)"
                    strokeOpacity={0.75}
                    radius={[10, 10, 10, 10]}
                    barSize={18}
                    background={{ fill: 'color-mix(in oklch, var(--muted) 32%, transparent)', radius: 10 }}
                  >
                    <LabelList
                      dataKey="value"
                      content={(props: any) => {
                        const raw = Number(props?.value ?? 0);
                        const x = Number(props?.x ?? 0) + Number(props?.width ?? 0) + 8;
                        const y = Number(props?.y ?? 0) + Number(props?.height ?? 0) / 2;
                        return (
                          <text x={x} y={y} dominantBaseline="middle" fill="var(--muted-foreground)" fontSize={11} fontWeight={800}>
                            {formatMADCompact(raw)}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut', delay: 0.3 }}
          className="premium-surface flex h-full flex-col rounded-3xl p-5"
        >
          <h2 className="text-lg font-bold">Activity Trend (6 months)</h2>
          <div className="mt-4 h-64">
            {activityTrendData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-muted-foreground">
                No data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activityTrendData} margin={{ left: 8, right: 12, top: 12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }}
                    tickFormatter={(v) => {
                      const s = String(v);
                      const d = parseDateValue(s + '-01');
                      if (!d) return s;
                      return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d);
                    }}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }} />
                  <Tooltip
                    content={({ label, payload }) => {
                      const month = String(label ?? '');
                      const d = parseDateValue(month + '-01');
                      const pretty = d ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d) : month;
                      return <TooltipCard label={pretty} payload={payload as any[]} total={activityTrendTotals.tickets} />;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tickets"
                    name="Tickets"
                    stroke="var(--chart-blue-2)"
                    strokeWidth={3}
                    dot={{ r: 3, strokeWidth: 2, fill: 'var(--background)' }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={!shouldReduceMotion}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut', delay: 0.23 }}
          className="premium-surface flex h-full flex-col rounded-3xl p-5"
        >
          <h2 className="text-lg font-bold">Lifecycle Overview</h2>
          <div className="mt-4 flex h-64 flex-col gap-3">
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={lifecycleChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                    labelLine={false}
                    label={false}
                    activeIndex={activeLifecycleIndex ?? undefined}
                    activeShape={renderActiveDonutSector}
                    onMouseEnter={(_, index) => setActiveLifecycleIndex(index)}
                    onMouseLeave={() => setActiveLifecycleIndex(null)}
                    isAnimationActive={!shouldReduceMotion}
                  >
                    {lifecycleChartData.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={entry.color} />
                    ))}
                    <Label
                      content={() => (
                        <CenterLabel
                          title={lifecycleCenterTitle}
                          total={lifecycleCenterTotal}
                          subtitle={lifecycleCenterSubtitle}
                        />
                      )}
                      position="center"
                    />
                  </Pie>
                  <Tooltip
                    content={({ label, payload }) => <TooltipCard label={label} payload={payload as any[]} total={lifecycleChartTotal} />}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="h-28 min-h-0 w-full shrink-0 overflow-auto pr-1">
              <div className="space-y-1">
                {lifecycleChartData.map((entry) => {
                  const value = Number(entry.value) || 0;
                  const percent = lifecycleChartTotal > 0 ? (value / lifecycleChartTotal) * 100 : 0;

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
      </div>
    </div>
  );
}