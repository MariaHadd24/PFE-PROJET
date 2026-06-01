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
import type { OrderStatus } from '../../types';
import { cn } from './utils';

// ─── Config des statuts ───────────────────────────────────────────────────────

export const PO_STATUS_FLOW: OrderStatus[] = ['Draft', 'Approved', 'Ordered', 'Received', 'Closed'];

const STATUS_META: Record<
  OrderStatus,
  {
    label: string;
    labelFr: string;
    icon: React.ElementType;
    badge: string;      
    dot: string;        
    menu: string;       
    glow: string;
  }
> = {
  Draft: {
    label: 'Draft',
    labelFr: 'Brouillon',
    icon: FileText,
    badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
    menu: 'text-slate-700 dark:text-slate-300',
    glow: 'from-slate-400/20 to-transparent',
  },
  Approved: {
    label: 'Approved',
    labelFr: 'Approuvée',
    icon: ShieldCheck,
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800',
    dot: 'bg-blue-500',
    menu: 'text-blue-700 dark:text-blue-300',
    glow: 'from-blue-500/20 to-transparent',
  },
  Ordered: {
    label: 'Ordered',
    labelFr: 'Commandée',
    icon: ClipboardList,
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
    dot: 'bg-amber-500',
    menu: 'text-amber-700 dark:text-amber-300',
    glow: 'from-amber-500/20 to-transparent',
  },
  Received: {
    label: 'Received',
    labelFr: 'Reçue',
    icon: Package,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    menu: 'text-emerald-700 dark:text-emerald-300',
    glow: 'from-emerald-500/20 to-transparent',
  },
  Closed: {
    label: 'Closed',
    labelFr: 'Clôturée',
    icon: Check,
    badge: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
    dot: 'bg-gray-400',
    menu: 'text-gray-600 dark:text-gray-400',
    glow: 'from-gray-400/10 to-transparent',
  },
};

const ALLOWED_NEXT: Record<OrderStatus, OrderStatus[]> = {
  Draft:    ['Approved'],
  Approved: ['Ordered', 'Draft'],
  Ordered:  ['Received'],
  Received: ['Closed'],
  Closed:   [],
};

interface OrderStatusTrackerProps {
  poId: string;
  currentStatus: OrderStatus;
  canManage: boolean;
  onStatusChange: (poId: string, newStatus: OrderStatus) => Promise<void>;
}

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

  const handleSelect = async (next: OrderStatus) => {
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
      {/* Badge statut premium */}
      <motion.button
        onClick={() => canChange && setOpen((v) => !v)}
        disabled={loading || !canChange}
        whileHover={canChange ? { scale: 1.05, y: -1 } : {}}
        whileTap={canChange ? { scale: 0.95 } : {}}
        className={cn(
          "relative group inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border transition-all duration-300 shadow-sm",
          meta.badge,
          canChange ? "cursor-pointer hover:shadow-lg" : "cursor-default opacity-85",
          loading && "opacity-50 grayscale"
        )}
      >
        <div className={cn("absolute inset-0 rounded-full bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity", meta.glow)} />
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Icon className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
        )}
        <span className="relative z-10">{meta.labelFr}</span>
        {canChange && !loading && (
          <ChevronDown className={cn("h-3 w-3 transition-transform duration-300", open && "rotate-180")} />
        )}
        {!canChange && currentStatus !== 'Closed' && <Lock className="h-2.5 w-2.5 opacity-40" />}
      </motion.button>

      {/* Dropdown Style Industrial */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="panel-frame absolute left-0 top-full mt-2 z-[100] min-w-[220px] bg-card/90 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-4 pt-4 pb-2 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-4 px-1">
                Workflow Status
              </p>
              
              <div className="flex flex-col gap-1.5 relative z-10">
                {PO_STATUS_FLOW.map((st, idx) => {
                  const m = STATUS_META[st];
                  const isActive = st === currentStatus;
                  const isPast = PO_STATUS_FLOW.indexOf(st) < PO_STATUS_FLOW.indexOf(currentStatus);
                  const isNext = allowed.includes(st);
                  const isDisabled = !isNext && !isActive && !isPast;

                  return (
                    <div key={st} className="flex items-center gap-3.5 group/item">
                      {/* Timeline Connector */}
                      <div className="flex flex-col items-center" style={{ width: 20 }}>
                        <div
                          className={cn(
                            "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300",
                            isActive ? `${m.dot} border-transparent shadow-[0_0_8px_rgba(31,197,255,0.4)]` : "border-border",
                            isPast ? "bg-emerald-500 border-transparent" : "",
                            isNext ? "border-primary animate-pulse" : "",
                            isDisabled && "bg-muted/50 opacity-40"
                          )}
                        >
                          {isPast && <Check className="h-2.5 w-2.5 text-white" />}
                          {isActive && <motion.div layoutId="active-status" className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        {idx < PO_STATUS_FLOW.length - 1 && (
                          <div className={cn(
                            "w-0.5 h-4 transition-colors duration-500",
                            isPast ? "bg-emerald-400" : "bg-border"
                          )} />
                        )}
                      </div>

                      {/* Item Button */}
                      {isNext ? (
                        <button
                          onClick={() => handleSelect(st)}
                          className={cn(
                            "flex-1 text-left text-[11px] font-bold px-3 py-2 rounded-xl transition-all duration-200 border border-transparent hover:border-primary/30 hover:bg-primary/5 group/btn",
                            m.menu
                          )}
                        >
                          <span className="flex items-center justify-between">
                            {m.labelFr}
                            <span className="opacity-0 group-hover/btn:opacity-100 translate-x-[-4px] group-hover/btn:translate-x-0 transition-all">→</span>
                          </span>
                        </button>
                      ) : (
                        <span
                          className={cn(
                            "flex-1 text-[11px] px-3 py-2 font-medium tracking-tight",
                            isActive ? "font-black text-foreground" : "text-muted-foreground opacity-60",
                            isDisabled && "grayscale italic"
                          )}
                        >
                          {m.labelFr}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-muted/30 px-4 py-3 mt-2 border-t border-border/40">
              <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-relaxed">
                {currentStatus === 'Closed' ? 'La commande est verrouillée.' : 'Seules les étapes logiques sont activées.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

