// src/app/components/ui/OrderStatusTracker.tsx
import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  ChevronDown,
  ClipboardList,
  FileText,
  Loader2,
  Package,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import type { POStatus } from '../../types';

// ─── Config des statuts ───────────────────────────────────────────────────────

export const PO_STATUS_FLOW: POStatus[] = ['Draft', 'Approved', 'Ordered', 'Received', 'Closed'];

const STATUS_META: Record<
  POStatus,
  {
    label: string;
    labelFr: string;
    icon: React.ElementType;
    badge: string;      // classes Tailwind badge
    dot: string;        // couleur point timeline
    menu: string;       // classes dropdown item
  }
> = {
  Draft: {
    label: 'Draft',
    labelFr: 'Brouillon',
    icon: FileText,
    badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
    menu: 'text-slate-700 dark:text-slate-300',
  },
  Approved: {
    label: 'Approved',
    labelFr: 'Approuvée',
    icon: ShieldCheck,
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800',
    dot: 'bg-blue-500',
    menu: 'text-blue-700 dark:text-blue-300',
  },
  Ordered: {
    label: 'Ordered',
    labelFr: 'Commandée',
    icon: ClipboardList,
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
    dot: 'bg-amber-500',
    menu: 'text-amber-700 dark:text-amber-300',
  },
  Received: {
    label: 'Received',
    labelFr: 'Reçue',
    icon: Package,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    menu: 'text-emerald-700 dark:text-emerald-300',
  },
  Closed: {
    label: 'Closed',
    labelFr: 'Clôturée',
    icon: Check,
    badge: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
    dot: 'bg-gray-400',
    menu: 'text-gray-600 dark:text-gray-400',
  },
};

// Transitions autorisées
const ALLOWED_NEXT: Record<POStatus, POStatus[]> = {
  Draft:    ['Approved'],
  Approved: ['Ordered', 'Draft'],
  Ordered:  ['Received'],
  Received: ['Closed'],
  Closed:   [],
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface OrderStatusTrackerProps {
  poId: string;
  currentStatus: POStatus;
  canManage: boolean;
  onStatusChange: (poId: string, newStatus: POStatus) => Promise<void>;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function OrderStatusTracker({
  poId,
  currentStatus,
  canManage,
  onStatusChange,
}: OrderStatusTrackerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const meta = STATUS_META[currentStatus];
  const Icon = meta.icon;
  const allowed = ALLOWED_NEXT[currentStatus];
  const canChange = canManage && allowed.length > 0;

  // Fermeture clic extérieur
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = async (next: POStatus) => {
    setOpen(false);
    setLoading(true);
    try {
      await onStatusChange(poId, next);
      toast.success('Statut mis à jour', {
        description: `${poId} → ${STATUS_META[next].labelFr}`,
      });
    } catch (err: any) {
      toast.error('Erreur de mise à jour', {
        description: String(err?.message ?? 'Impossible de changer le statut'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Badge statut cliquable */}
      <button
        onClick={() => canChange && setOpen((v) => !v)}
        disabled={loading || !canChange}
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border
          transition-all duration-150 select-none
          ${meta.badge}
          ${canChange ? 'cursor-pointer hover:shadow-sm hover:scale-[1.02]' : 'cursor-default'}
          ${loading ? 'opacity-60' : ''}
        `}
        title={canChange ? 'Cliquer pour changer le statut' : undefined}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Icon className="h-3 w-3" />
        )}
        <span>{meta.labelFr}</span>
        {canChange && !loading && <ChevronDown className="h-3 w-3 opacity-60" />}
        {!canChange && currentStatus !== 'Closed' && <Lock className="h-2.5 w-2.5 opacity-40" />}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="
              absolute left-0 top-full mt-1.5 z-50 min-w-[200px]
              bg-card border border-border rounded-xl shadow-xl
              overflow-hidden
            "
          >
            {/* Mini timeline dans le dropdown */}
            <div className="px-3 pt-3 pb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Changer le statut
              </p>
              <div className="flex flex-col gap-1">
                {PO_STATUS_FLOW.map((st, idx) => {
                  const m = STATUS_META[st];
                  const StIcon = m.icon;
                  const isActive = st === currentStatus;
                  const isPast = PO_STATUS_FLOW.indexOf(st) < PO_STATUS_FLOW.indexOf(currentStatus);
                  const isNext = allowed.includes(st);
                  const isDisabled = !isNext && !isActive && !isPast;

                  return (
                    <div key={st} className="flex items-center gap-2.5">
                      {/* Connecteur vertical */}
                      <div className="flex flex-col items-center" style={{ width: 16 }}>
                        <div
                          className={`
                            w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                            ${isActive ? `${m.dot} border-transparent` : ''}
                            ${isPast ? 'bg-emerald-500 border-transparent' : ''}
                            ${isDisabled && !isNext ? 'bg-muted border-border' : ''}
                            ${isNext ? `${m.dot} border-transparent opacity-70` : ''}
                          `}
                        >
                          {isPast && <Check className="h-2 w-2 text-white" />}
                          {isActive && <span className="block w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        {idx < PO_STATUS_FLOW.length - 1 && (
                          <div className={`w-0.5 h-3 ${isPast ? 'bg-emerald-400' : 'bg-border'}`} />
                        )}
                      </div>

                      {/* Bouton / label */}
                      {isNext ? (
                        <button
                          onClick={() => handleSelect(st)}
                          className={`
                            flex-1 text-left text-xs font-semibold px-2 py-1 rounded-md
                            ${m.menu}
                            hover:bg-muted/60 transition-colors duration-100
                          `}
                        >
                          → {m.labelFr}
                        </button>
                      ) : (
                        <span
                          className={`
                            flex-1 text-xs px-2 py-1
                            ${isActive ? 'font-bold text-foreground' : 'text-muted-foreground'}
                          `}
                        >
                          {isActive ? `● ${m.labelFr}` : m.labelFr}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pied du dropdown */}
            <div className="border-t border-border px-3 py-2">
              <p className="text-[9px] text-muted-foreground">
                Seules les transitions autorisées sont disponibles.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
