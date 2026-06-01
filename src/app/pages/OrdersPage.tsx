// src/app/pages/OrdersPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import {
  ShoppingCart, Plus, FileText, Upload, Trash2, ChevronDown,
  Check, ClipboardList, Package, ShieldCheck, Lock, X, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { canPerformAction } from '../lib/rbac';
import { formatMAD } from '../lib/money';
import { deleteOrderFile, getOrderFile, putOrderFile } from '../lib/orderFilesDb';
import { createOrder, deleteOrder, listOrders, patchOrder } from '../data/api';
import type { Order, OrderFile, OrderStatus } from '../types';
import { apiPostFormData } from '../lib/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '../components/ui/dialog';

// Types are imported from ../types

// ─── Categories & subcategories (mirrors dashboard) ─────────────────────────

const CATEGORY_MAP: Record<string, string[]> = {
  Networking:  ['Access Points', 'Cisco Switch', 'Cisco Router', 'Wireless Controller'],
  Kaba:        ['Datamanager', 'IP Time Clock', 'Kaba Reader'],
  Servers:     ['VMs', 'Physical Server'],
  Machines:    ['Workstation', 'Notebook', 'Monitor', 'Docking Station'],
  Printers:    ['Zebra', 'HP', 'KYOCERA'],
  VoIP:        ['IP Phones'],
  Production:  ['Scanners', 'Komax', 'AGV'],
  Other:       ['Accessories', 'Cables', 'Consumables', 'Other'],
};

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_FLOW: OrderStatus[] = ['Draft', 'Approved', 'Ordered', 'Received', 'Closed'];

const STATUS_META: Record<OrderStatus, { label: string; icon: React.ElementType; badge: string; dot: string }> = {
  Draft:    { label: 'Draft',    icon: FileText,     badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',           dot: 'bg-slate-400'   },
  Approved: { label: 'Approved', icon: ShieldCheck,  badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800',              dot: 'bg-blue-500'    },
  Ordered:  { label: 'Ordered',  icon: ClipboardList,badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',        dot: 'bg-amber-500'   },
  Received: { label: 'Received', icon: Package,      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800', dot: 'bg-emerald-500' },
  Closed:   { label: 'Closed',   icon: Check,        badge: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',                 dot: 'bg-gray-400'    },
};

const ALLOWED_NEXT: Record<OrderStatus, OrderStatus[]> = {
  Draft:    ['Approved'],
  Approved: ['Ordered', 'Draft'],
  Ordered:  ['Received'],
  Received: ['Closed'],
  Closed:   [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOrderFileKey(orderId: string, type: 'bcFile' | 'blFile') {
  return `${orderId}:${type}`;
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; mime: string } {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] ?? 'application/octet-stream';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { blob: new Blob([bytes], { type: mime }), mime };
}
function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const pageContainerVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1], when: 'beforeChildren', staggerChildren: 0.05 } },
};
const pageItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } },
};

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ orderId, status, canManage, onChange }: {
  orderId: string; status: OrderStatus; canManage: boolean;
  onChange: (id: string, next: OrderStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const allowed = ALLOWED_NEXT[status];
  const canChange = canManage && allowed.length > 0;

  const updateMenuPosition = () => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minWidth = 210;
    const width = Math.max(minWidth, Math.round(rect.width));
    const viewportPad = 8;
    let left = Math.round(rect.left);
    let top = Math.round(rect.bottom + 6);

    // Clamp horizontally in viewport
    if (left + width > window.innerWidth - viewportPad) {
      left = Math.max(viewportPad, window.innerWidth - width - viewportPad);
    }
    if (left < viewportPad) left = viewportPad;

    setMenuPos({ top, left, width });
  };

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();

    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const btn = buttonRef.current;
      const menu = menuRef.current;
      if (btn && btn.contains(target)) return;
      if (menu && menu.contains(target)) return;
      setOpen(false);
    };

    const onScrollOrResize = () => updateMenuPosition();

    document.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('resize', onScrollOrResize);
    // capture=true so scroll inside containers also triggers repositioning
    window.addEventListener('scroll', onScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const btn = buttonRef.current;
    if (!menu || !btn || !menuPos) return;

    // If the menu would overflow the viewport bottom, flip upward.
    const rect = btn.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const viewportPad = 8;
    const overflowBottom = menuPos.top + menuRect.height > window.innerHeight - viewportPad;
    if (overflowBottom) {
      const top = Math.max(viewportPad, Math.round(rect.top - 6 - menuRect.height));
      setMenuPos(p => (p ? { ...p, top } : p));
    }
  }, [open, menuPos]);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => canChange && setOpen(v => !v)}
        disabled={!canChange}
        ref={buttonRef}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-150 select-none
          ${meta.badge} ${canChange ? 'cursor-pointer hover:shadow-sm hover:scale-[1.02]' : 'cursor-default'}`}
        title={canChange ? 'Change status' : undefined}
      >
        <Icon className="h-3 w-3" />
        <span>{meta.label}</span>
        {canChange && <ChevronDown className="h-3 w-3 opacity-60" />}
        {!canChange && status !== 'Closed' && <Lock className="h-2.5 w-2.5 opacity-40" />}
      </button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && menuPos && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: menuPos.width }}
              className="z-[9999] min-w-[210px] bg-card border border-border rounded-xl shadow-xl overflow-hidden"
            >
              <div className="px-3 pt-3 pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Change status</p>
                <div className="flex flex-col gap-0.5">
                  {STATUS_FLOW.map((st, idx) => {
                    const m = STATUS_META[st];
                    const isActive = st === status;
                    const isPast   = STATUS_FLOW.indexOf(st) < STATUS_FLOW.indexOf(status);
                    const isNext   = allowed.includes(st);
                    return (
                      <div key={st} className="flex items-center gap-2.5">
                        <div className="flex flex-col items-center" style={{ width: 16 }}>
                          <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                            ${isActive ? `${m.dot} border-transparent` : ''}
                            ${isPast ? 'bg-emerald-500 border-transparent' : ''}
                            ${!isActive && !isPast && !isNext ? 'bg-muted border-border' : ''}
                            ${isNext && !isActive && !isPast ? `${m.dot} border-transparent opacity-70` : ''}`}
                          >
                            {isPast   && <Check className="h-2 w-2 text-white" />}
                            {isActive && <span className="block w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          {idx < STATUS_FLOW.length - 1 && (
                            <div className={`w-0.5 h-3 ${isPast ? 'bg-emerald-400' : 'bg-border'}`} />
                          )}
                        </div>
                        {isNext ? (
                          <button onClick={() => { setOpen(false); onChange(orderId, st); }}
                            className="flex-1 text-left text-xs font-semibold px-2 py-1 rounded-md hover:bg-muted/60 transition-colors">
                            → {m.label}
                          </button>
                        ) : (
                          <span className={`flex-1 text-xs px-2 py-1 ${isActive ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                            {isActive ? `● ${m.label}` : m.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="border-t border-border px-3 py-2">
                <p className="text-[9px] text-muted-foreground">Only allowed transitions are clickable.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

// ─── FileCell — fix page blanche via blob URL ─────────────────────────────────

function FileCell({ file, label, canManage, onUpload, onRemove }: {
  file?: OrderFile | null; label: 'BC' | 'BL'; canManage: boolean;
  onUpload: (f: File) => void; onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLoading(true);
    try { await onUpload(f); }
    finally { setLoading(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  // Ouvre le fichier en blob URL pour éviter about:blank#blocked
  const openFile = () => {
    if (!file) return;
    (async () => {
      try {
        // Preferred: IndexedDB
        if (file.key) {
          const stored = await getOrderFile(file.key);
          if (stored?.blob) {
            const url = URL.createObjectURL(stored.blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
            return;
          }

          // Key exists but file payload is missing (e.g. storage cleared)
          toast.error('File not found', { description: 'Please re-upload the attachment.' });
          return;
        }

        // Legacy fallback: base64 dataUrl
        if (file.dataUrl) {
          const { blob } = dataUrlToBlob(file.dataUrl);
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
          return;
        }

        toast.error('Unable to open file');
      } catch {
        toast.error('Unable to open file');
      }
    })();
  };

  const isBC = label === 'BC';
  const colorBase = isBC
    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/70'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/70';

  if (file) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={openFile}
          title={`${file.name} (${fmtBytes(file.size)})`}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold border transition-colors ${colorBase}`}
        >
          <Eye className="h-3.5 w-3.5" />
          {label}
        </button>
        {canManage && (
          <button onClick={onRemove} title="Remove"
            className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  if (!canManage) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <>
      <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="hidden" onChange={handleChange} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        title={`Attach ${label}`}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold border transition-colors disabled:opacity-50 ${colorBase}`}
      >
        <Upload className="h-3.5 w-3.5" />
        {label}
      </button>
    </>
  );
}

// ─── New Order Modal ─────────────────────────────────────────────────────────

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (o: Order) => void;
  departments: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
}

function AddOrderModal({ isOpen, onClose, onAdd, departments, suppliers }: AddOrderModalProps) {
  const empty = { reference: '', supplier: '', total: '', date: '', category: '', subCategory: '', description: '', quantity: '1', department: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const subCategories = form.category ? (CATEGORY_MAP[form.category] ?? []) : [];

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    // Reset sous-catégorie si catégorie change
    if (name === 'category') {
      setForm(p => ({ ...p, category: value, subCategory: '' }));
    } else {
      setForm(p => ({ ...p, [name]: value }));
    }
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.reference.trim())  errs.reference  = 'Required field';
    if (!form.supplier.trim())   errs.supplier   = 'Required field';
    if (!form.date)              errs.date       = 'Required field';
    if (!form.department.trim()) errs.department = 'Required field';
    if (!form.category)          errs.category   = 'Required field';
    if (subCategories.length > 0 && !form.subCategory) errs.subCategory = 'Required field';
    if (isNaN(Number(form.quantity)) || Number(form.quantity) < 1) errs.quantity = 'Invalid quantity';
    if (form.total && (isNaN(Number(form.total)) || Number(form.total) < 0)) errs.total = 'Invalid amount';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const order: Order = {
      id: `ORD-${Date.now()}`,
      reference:   form.reference.trim(),
      supplier:    form.supplier.trim(),
      total:       Number(form.total) || 0,
      date:        form.date,
      category:    form.category,
      subCategory: form.subCategory,
      description: form.description.trim(),
      quantity:    Number(form.quantity) || 1,
      department:  form.department.trim(),
      status:      'Draft',
      createdAt:   new Date().toISOString(),
    };
    onAdd(order);
    setForm(empty);
    setErrors({});
    onClose();
  };

  const handleClose = () => { setForm(empty); setErrors({}); onClose(); };

  const inputCls = (field: string) =>
    `w-full h-10 px-3 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent text-sm
    ${errors[field] ? 'border-destructive' : 'border-border'}`;

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New order</DialogTitle>
            <DialogDescription>Fill in the order details.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">

            {/* Order No. */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Order No. <span className="text-destructive">*</span>
              </label>
              <input name="reference" value={form.reference} onChange={handle}
                placeholder="e.g. CMD-2025-001" className={inputCls('reference')} />
              {errors.reference && <p className="mt-1 text-xs text-destructive">{errors.reference}</p>}
            </div>

            {/* Date */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Date <span className="text-destructive">*</span>
              </label>
              <input type="date" name="date" value={form.date} onChange={handle} className={inputCls('date')} />
              {errors.date && <p className="mt-1 text-xs text-destructive">{errors.date}</p>}
            </div>

            {/* Supplier */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Supplier <span className="text-destructive">*</span>
              </label>
              {suppliers.length > 0 ? (
                <select name="supplier" value={form.supplier} onChange={handle} className={inputCls('supplier')}>
                  <option value="">Select…</option>
                  {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              ) : (
                <input name="supplier" value={form.supplier} onChange={handle}
                  placeholder="Supplier name" className={inputCls('supplier')} />
              )}
              {errors.supplier && <p className="mt-1 text-xs text-destructive">{errors.supplier}</p>}
            </div>

            {/* Department */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Department <span className="text-destructive">*</span>
              </label>
              {departments.length > 0 ? (
                <select name="department" value={form.department} onChange={handle} className={inputCls('department')}>
                  <option value="">Select…</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              ) : (
                <input name="department" value={form.department} onChange={handle}
                  placeholder="Department" className={inputCls('department')} />
              )}
              {errors.department && <p className="mt-1 text-xs text-destructive">{errors.department}</p>}
            </div>

            {/* ── Item separator ── */}
            <div className="col-span-2">
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ordered item</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </div>

            {/* Category */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Category <span className="text-destructive">*</span>
              </label>
              <select name="category" value={form.category} onChange={handle} className={inputCls('category')}>
                <option value="">Select…</option>
                {Object.keys(CATEGORY_MAP).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.category && <p className="mt-1 text-xs text-destructive">{errors.category}</p>}
            </div>

            {/* Subcategory */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Subcategory {subCategories.length > 0 && <span className="text-destructive">*</span>}
              </label>
              <select
                name="subCategory"
                value={form.subCategory}
                onChange={handle}
                disabled={subCategories.length === 0}
                className={`${inputCls('subCategory')} disabled:opacity-40`}
              >
                <option value="">{subCategories.length === 0 ? 'Choose category first' : 'Select…'}</option>
                {subCategories.map(sc => (
                  <option key={sc} value={sc}>{sc}</option>
                ))}
              </select>
              {errors.subCategory && <p className="mt-1 text-xs text-destructive">{errors.subCategory}</p>}
            </div>

            {/* Description */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">Description / Purpose</label>
              <textarea name="description" value={form.description} onChange={handle} rows={2}
                placeholder="Model, reference, specifications…"
                className={`${inputCls('description')} h-auto resize-none py-2`} />
            </div>

            {/* Quantity + Amount */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Quantity <span className="text-destructive">*</span>
              </label>
              <input type="number" min="1" name="quantity" value={form.quantity} onChange={handle}
                placeholder="1" className={inputCls('quantity')} />
              {errors.quantity && <p className="mt-1 text-xs text-destructive">{errors.quantity}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Unit price (MAD)</label>
              <input type="number" min="0" step="0.01" name="total" value={form.total} onChange={handle}
                placeholder="0.00" className={inputCls('total')} />
              {errors.total && <p className="mt-1 text-xs text-destructive">{errors.total}</p>}
            </div>
          </div>

          <DialogFooter>
            <button type="button" onClick={handleClose}
              className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted/40 text-sm transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="px-4 py-2 rounded-lg bg-[#1F3C88] text-white hover:bg-[#163069] text-sm font-medium transition-colors">
              Create order
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function OrdersPage() {
  const shouldReduceMotion = useReducedMotion();
  const { user } = useAuth();
  const role = user?.role ?? 'Reader';
  const canManageOrders = canPerformAction(role, 'manage_orders');
  const { suppliers, departments } = useData();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listOrders();
        if (!cancelled) setOrders(data);
      } catch (err: any) {
        toast.error('Failed to load orders', { description: String(err?.message ?? err) });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleAdd = async (order: Order) => {
    try {
      const created = await createOrder(order);
      setOrders(prev => [created, ...prev]);
      toast.success('Order created', { description: `${created.reference} — ${created.supplier}` });
    } catch (err: any) {
      toast.error('Create failed', { description: String(err?.message ?? err) });
    }
  };

  const handleStatusChange = async (id: string, next: OrderStatus) => {
    const current = orders.find(o => o.id === id);
    if (!current) return;

    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: next } : o));
    try {
      const updated = await patchOrder(id, { status: next });
      setOrders(prev => prev.map(o => o.id === id ? updated : o));
      toast.success('Status updated', { description: `${updated.reference} → ${STATUS_META[next].label}` });
    } catch (err: any) {
      setOrders(prev => prev.map(o => o.id === id ? current : o));
      toast.error('Update failed', { description: String(err?.message ?? err) });
    }
  };

  const handleUploadFile = async (orderId: string, type: 'bcFile' | 'blFile', file: File) => {
    try {
      const key = makeOrderFileKey(orderId, type);
      const stored = await putOrderFile({ key, file, uploadedAt: new Date().toISOString() });
      const orderFile: OrderFile = { name: stored.name, size: stored.size, uploadedAt: stored.uploadedAt, key: stored.key };
      const updated = await patchOrder(orderId, { [type]: orderFile } as any);
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));

      // If the attachment is a PDF, also store it on the server so it appears in PDF History.
      const isPdf = (file.type || '').toLowerCase().includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        const fd = new FormData();
        fd.append('file', file, file.name);
        apiPostFormData('/pdfs/upload?source=orders', fd).catch(() => {
          // Keep the order attachment working even if history upload fails.
          toast.warning('PDF history not updated', { description: 'The attachment was saved, but it could not be stored on the server.' });
        });
      }

      toast.success(`${type === 'bcFile' ? 'BC' : 'BL'} attached`, { description: `${file.name} (${fmtBytes(file.size)})` });
    } catch (err: any) {
      toast.error('Upload error', { description: String(err?.message ?? 'Invalid file') });
    }
  };

  const handleRemoveFile = async (orderId: string, type: 'bcFile' | 'blFile') => {
    const key = makeOrderFileKey(orderId, type);
    deleteOrderFile(key).catch(() => {});
    try {
      const updated = await patchOrder(orderId, { [type]: null } as any);
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
    } catch {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, [type]: undefined } : o));
    }
  };

  const handleDelete = async (id: string) => {
    const order = orders.find(o => o.id === id);
    if (order?.bcFile?.key) deleteOrderFile(order.bcFile.key).catch(() => {});
    if (order?.blFile?.key) deleteOrderFile(order.blFile.key).catch(() => {});
    setOrders(prev => prev.filter(o => o.id !== id));
    try {
      await deleteOrder(id);
      if (order) toast.info('Order deleted', { description: order.reference });
    } catch (err: any) {
      // Re-add on failure
      if (order) setOrders(prev => [order, ...prev]);
      toast.error('Delete failed', { description: String(err?.message ?? err) });
    }
  };

  const stats = {
    total:   orders.length,
    enCours: orders.filter(o => o.status === 'Ordered').length,
    recues:  orders.filter(o => o.status === 'Received' || o.status === 'Closed').length,
    montant: orders.reduce((s, o) => s + (o.total * (o.quantity || 0)), 0),
  };

  return (
    <motion.div className="space-y-6"
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
                <ShoppingCart className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="page-hero__badge">Procurement</span>
                </div>
                <h1 className="page-hero__title">
                  <span className="page-hero__title-stack">
                    <span className="page-hero__title-glow" aria-hidden>Orders</span>
                    <span className="page-hero__title-text">Orders</span>
                  </span>
                </h1>
                <div className="page-hero__underline" aria-hidden />
                <p className="page-hero__subtitle">Order tracking</p>
              </div>
            </div>
          </div>
          {canManageOrders && (
            <div className="page-hero__actions">
              <motion.button
                whileHover={shouldReduceMotion ? undefined : { scale: 1.05, y: -2 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                onClick={() => setIsModalOpen(true)}
                className="chip-industrial flex items-center gap-2 bg-gradient-to-br from-primary to-cyan-600 text-white px-6 py-3 rounded-xl shadow-lg shadow-primary/20 transition-all font-bold text-sm uppercase tracking-widest"
              >
                <Plus className="w-4 h-4" />
                New order
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" variants={shouldReduceMotion ? undefined : pageItemVariants}>
        {[
          { label: 'Total orders',  value: String(stats.total),        color: 'text-foreground', icon: ShoppingCart, iconBg: 'bg-primary/10', iconColor: 'text-primary' },
          { label: 'In progress',   value: String(stats.enCours),      color: 'text-amber-600 dark:text-amber-400', icon: ClipboardList, iconBg: 'bg-amber-500/10', iconColor: 'text-amber-600' },
          { label: 'Received',      value: String(stats.recues),       color: 'text-emerald-600 dark:text-emerald-400', icon: Package, iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-600' },
          { label: 'Total amount',  value: formatMAD(stats.montant),   color: 'text-primary', icon: ShoppingCart, iconBg: 'bg-primary/10', iconColor: 'text-primary' },
        ].map(s => (
          <motion.div 
            key={s.label} 
            className="premium-surface rounded-3xl p-6 transition-all duration-200 hover:shadow-md"
            whileHover={shouldReduceMotion ? undefined : { y: -1 }}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${s.iconBg} flex items-center justify-center border border-current opacity-20`} style={{ color: 'inherit' }}>
                <s.icon className={`w-6 h-6 ${s.iconColor}`} />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">{s.label}</p>
                <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Tableau */}
      <motion.div
        className="panel-frame overflow-hidden bg-card/30 backdrop-blur-md rounded-3xl border border-border/60 shadow-xl"
        variants={shouldReduceMotion ? undefined : pageItemVariants}
      >
        <div className="px-8 py-6 border-b border-border/50 bg-gradient-to-r from-muted/30 to-transparent flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ClipboardList className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-black tracking-tight text-foreground uppercase">Orders Registry</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 rounded-full bg-muted/50 border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              {orders.length} Records
            </div>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
              <ShoppingCart className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-lg font-black text-foreground uppercase tracking-tight mb-2">No orders yet</p>
            <p className="text-sm font-medium text-muted-foreground mb-8">Create your first order to start tracking.</p>
            {canManageOrders && (
              <button onClick={() => setIsModalOpen(true)}
                className="chip-industrial flex items-center gap-2 bg-gradient-to-br from-primary to-cyan-600 text-white px-6 py-3 rounded-xl shadow-lg shadow-primary/20 transition-all font-bold text-sm uppercase tracking-widest">
                <Plus className="w-4 h-4" /> New order
              </button>
            )}
          </div>
        ) : (
          <div className="table-scrollbar sidebar-scroll">
            <table className="w-full min-w-max premium-table">
              <thead>
                <tr>
                  {['Order No.', 'Supplier', 'Category', 'Subcategory', 'Qty', 'Amount', 'Date', 'Status', 'BC', 'BL', ''].map(h => (
                    <th key={h} className="px-8 py-4 text-left text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] border-b border-border/50">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {orders.map(order => (
                  <tr key={order.id} className="group transition-all duration-300">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="font-black text-foreground text-[13px] uppercase tracking-tight">{order.reference}</div>
                      {order.department && <div className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest mt-1">{order.department}</div>}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-[13px] font-bold text-foreground/70">{order.supplier}</td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20">
                        {order.category}
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-[12px] font-bold text-muted-foreground/60 uppercase tracking-tight">
                      {order.subCategory || '—'}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-[13px] font-black text-foreground tabular-nums text-center">
                      {order.quantity}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-[14px] font-black text-foreground tabular-nums tracking-tight">
                      {order.total > 0 ? formatMAD(order.total * (order.quantity || 0)) : '—'}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-[12px] font-bold text-muted-foreground/50 tabular-nums">
                      {new Date(order.date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <StatusBadge orderId={order.id} status={order.status} canManage={canManageOrders} onChange={handleStatusChange} />
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <FileCell file={order.bcFile} label="BC" canManage={canManageOrders}
                        onUpload={f => handleUploadFile(order.id, 'bcFile', f)}
                        onRemove={() => handleRemoveFile(order.id, 'bcFile')} />
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <FileCell file={order.blFile} label="BL" canManage={canManageOrders}
                        onUpload={f => handleUploadFile(order.id, 'blFile', f)}
                        onRemove={() => handleRemoveFile(order.id, 'blFile')} />
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      {canManageOrders && (
                        <button onClick={() => handleDelete(order.id)} title="Delete"
                          className="p-2 rounded-xl text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <AddOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAdd}
        departments={departments}
        suppliers={suppliers}
      />
    </motion.div>
  );
}
