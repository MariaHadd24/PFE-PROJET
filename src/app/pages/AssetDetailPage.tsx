import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { ArrowLeft, Calendar, DollarSign, MapPin, Package, User } from 'lucide-react';
import type { AssetStatus } from '../types';
import { useData } from '../context/DataContext';
import { formatMAD } from '../lib/money';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import { toast } from 'sonner';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../components/ui/utils';

const statusStyles: Record<AssetStatus, string> = {
  Available: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  Assigned: 'bg-primary/10 text-primary border-primary/20',
  InRepair: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  Retired: 'bg-rose-500/10 text-rose-600 border-rose-500/20'
};

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

const SCANNER_TYPES = ['Cradle', 'Pistolet', 'Barcode Scanner'] as const;
const CISCO_TYPES = ['Switch', 'Router', 'Wireless Controller', 'Access Point'] as const;
const KABA_TYPES = ['Datamanager', 'Pointeuse IP', 'Lecteur Kaba'] as const;

function isKabaCategory(category: unknown): boolean {
  const v = String(category ?? '').trim();
  if (!v) return false;
  return v.toLowerCase() === 'kaba' || v.toUpperCase() === 'KABA';
}

function normalizeKabaType(value: unknown): string {
  const v = String(value ?? '').trim();
  if (!v) return '';
  const low = v.toLowerCase();
  if (low.includes('data manager') || low.includes('datamanager') || low.includes('data-manager')) return 'Datamanager';
  if (low.includes('terminal ip') || low.includes('pointeuse ip') || low.includes('pointeuse')) return 'Pointeuse IP';
  if (low.includes('lecteur') || low.includes('kaba')) return 'Lecteur Kaba';
  return v;
}

function normalizeAssetType(category: unknown, value: unknown): string {
  if (isKabaCategory(category)) return normalizeKabaType(value);
  return normalizeCiscoType(value);
}

function normalizeCiscoType(value: unknown): string {
  const v = String(value ?? '').trim();
  const up = v.toUpperCase();

  // Legacy values we previously used
  if (up === 'SWITCH' || up === 'SWITCHES') return 'Switch';
  if (up === 'ROUTER') return 'Router';
  if (up === 'WIRELESS CONTROLLER') return 'Wireless Controller';
  if (up === 'ACCESS POINT') return 'Access Point';

  // Types we removed
  if (up === 'SERVER' || up === 'SERVERS') return '';

  // Already-correct or other custom value
  return v;
}

function isScannerCategory(category: string) {
  return category === 'Scanner' || category === 'Scanners';
}

function isCiscoCategory(category: unknown): boolean {
  return String(category ?? '').trim().toLowerCase() === 'cisco';
}

function isWorkstationCategory(category: string) {
  return category === 'Workstation';
}

function isNotebookCategory(category: string) {
  return category === 'Notebook';
}

function categoryNeedsType(category: string) {
  return isScannerCategory(category) || isCiscoCategory(category) || isKabaCategory(category);
}

export function AssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { assets, categories, sites, suppliers, stockMovements, assignments, maintenanceTickets, updateAsset, removeAsset } =
    useData();
  const [activeTab, setActiveTab] = useState<'info' | 'movements' | 'assignments' | 'maintenance'>('info');
  const [editMode, setEditMode] = useState(false);

  const asset = assets.find(a => a.id === id);
  const assetMovements = stockMovements.filter(m => m.assetId === id);
  const assetAssignments = assignments.filter(a => a.assetId === id);
  const assetTickets = maintenanceTickets.filter(t => t.assetId === id);

  const formatAssignmentDeviceInfo = (a: any): string => {
    const parts: string[] = [];
    if (a.device_category) parts.push(String(a.device_category));

    const add = (label: string, value: any) => {
      if (value === undefined || value === null) return;
      const v = String(value).trim();
      if (!v) return;
      parts.push(`${label}: ${v}`);
    };

    add('hostname', a.hostname);

    // Workstation-specific
    add('usb_status', a.usb_status);
    add('user', a.user);
    add('ws_sn', a.ws_sn);
    add('ws_model', a.ws_model);
    add('immo_ws', a.immo_ws);
    add('bci_ws', a.bci_ws);

    // Notebook-specific
    add('usb', a.usb);
    add('username', a.username);
    add('nb_sn', a.nb_sn);
    add('model_nb', a.model_nb);
    add('mac_address', a.mac_address);
    add('immo_number', a.immo_number);
    add('bci', a.bci);

    // Common-ish
    add('full_name', a.full_name);
    add('service', a.service);
    add('os', a.os);
    add('acquisition_date', a.acquisition_date);
    add('assignment_date', a.assignment_date);
    add('end_of_support_date', a.end_of_support_date);
    add('monitor_model', a.monitor_model);
    add('monitor_sn', a.monitor_sn);
    add('monitor_immo', a.monitor_immo);
    add('monitor_bci', a.monitor_bci);

    return parts.join(' • ');
  };

  if (!asset) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Asset not found</p>
      </div>
    );
  }

  const categoryOptions = useMemo(() => {
    const values = [asset.category, ...categories.map((c) => c.name)].filter(Boolean);
    return Array.from(new Set(values));
  }, [asset.category, categories]);
  const siteOptions = useMemo(() => {
    const values = [asset.site, ...sites.map((s) => s.name)].filter(Boolean);
    return Array.from(new Set(values));
  }, [asset.site, sites]);
  const supplierOptions = useMemo(() => {
    const values = [asset.supplier, ...suppliers.map((s) => s.name)].filter(Boolean);
    return Array.from(new Set(values));
  }, [asset.supplier, suppliers]);

  const [form, setForm] = useState(() => ({
    assetTag: asset.assetTag,
    serialNumber: asset.serialNumber,
    macAddress: asset.macAddress ?? '',
    model: asset.model,
    category: asset.category,
    type: normalizeAssetType(asset.category, (asset as any).type ?? ''),
    supplier: asset.supplier,
    site: asset.site,
    status: asset.status,
    acquisitionDate: asset.acquisitionDate,
    warrantyEndDate: asset.warrantyEndDate,
    value: String(asset.value ?? 0),
    deviceProfile: (asset as any).deviceProfile ?? null,
  }));

  useEffect(() => {
    setForm({
      assetTag: asset.assetTag,
      serialNumber: asset.serialNumber,
      macAddress: asset.macAddress ?? '',
      model: asset.model,
      category: asset.category,
      type: normalizeAssetType(asset.category, (asset as any).type ?? ''),
      supplier: asset.supplier,
      site: asset.site,
      status: asset.status,
      acquisitionDate: asset.acquisitionDate,
      warrantyEndDate: asset.warrantyEndDate,
      value: String(asset.value ?? 0),
      deviceProfile: (asset as any).deviceProfile ?? null,
    });
    setEditMode(false);
  }, [asset.id]);

  const onSave = async () => {
    const value = Number(form.value);
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Invalid value', { description: 'Value must be a number ≥ 0' });
      return;
    }

    if (categoryNeedsType(form.category) && !String(form.type ?? '').trim()) {
      toast.error('Invalid type', { description: 'Type is required for Scanner / Cisco / Kaba' });
      return;
    }

    const macAddress = form.macAddress.trim();

    try {
      const payload: any = {
        assetTag: form.assetTag.trim(),
        serialNumber: form.serialNumber.trim(),
        macAddress: macAddress || undefined,
        model: form.model.trim(),
        category: form.category,
        supplier: form.supplier,
        site: form.site,
        status: form.status,
        acquisitionDate: form.acquisitionDate,
        warrantyEndDate: form.warrantyEndDate,
        value,
      };

      if (categoryNeedsType(form.category)) {
        payload.type = String(form.type ?? '').trim();
      } else if (categoryNeedsType(asset.category)) {
        // When switching away from a typed category, clear stored type.
        payload.type = null;
      }

      if (isWorkstationCategory(form.category) || isNotebookCategory(form.category)) {
        payload.deviceProfile = form.deviceProfile ?? null;
      } else if (isWorkstationCategory(asset.category) || isNotebookCategory(asset.category)) {
        payload.deviceProfile = null;
      }

      await updateAsset(asset.id, payload);
      toast.success('Asset updated');
      setEditMode(false);
    } catch (e: any) {
      toast.error('Unable to update asset', { description: String(e?.message ?? 'Network error') });
    }
  };

  const onDelete = async () => {
    try {
      await removeAsset(asset.id);
      toast.success('Asset deleted');
      navigate('/stock-inventory');
    } catch (e: any) {
      toast.error('Unable to delete asset', { description: String(e?.message ?? 'Network error') });
    }
  };

  const tabs = [
    { id: 'info', label: 'General information' },
    { id: 'movements', label: 'Movement history' },
    { id: 'assignments', label: 'Assignments' },
    { id: 'maintenance', label: 'Maintenance' }
  ] as const;

  const deviceProfileKeys = useMemo(() => {
    if (isWorkstationCategory(form.category)) {
      return [
        'hostname',
        'site',
        'usb_status',
        'user',
        'full_name',
        'service',
        'ws_sn',
        'ws_model',
        'os',
        'immo_ws',
        'bci_ws',
        'acquisition_date',
        'assignment_date',
        'end_of_support_date',
        'monitor_model',
        'monitor_sn',
        'monitor_immo',
        'monitor_bci',
      ];
    }
    if (isNotebookCategory(form.category)) {
      return [
        'hostname',
        'site',
        'usb',
        'username',
        'full_name',
        'service',
        'nb_sn',
        'model_nb',
        'mac_address',
        'os',
        'immo_number',
        'bci',
        'acquisition_date',
        'assignment_date',
        'end_of_support_date',
        'monitor_model',
        'monitor_sn',
        'monitor_immo',
        'monitor_bci',
      ];
    }
    return [] as string[];
  }, [form.category]);

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
            <Link to="/stock-inventory" className="chip-industrial inline-flex items-center gap-2 text-primary hover:text-cyan-600 mb-6 px-0 uppercase tracking-widest text-[10px] font-black transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Assets IT
            </Link>

            <div className="page-hero__title-row">
              <div className="page-hero__icon" aria-hidden>
                <Package className="h-[18px] w-[18px]" />
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="page-hero__badge">Asset</span>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
                    statusStyles[asset.status]
                  )}>
                    {asset.status}
                  </span>
                </div>

                <h1 className="page-hero__title">
                  <span className="page-hero__title-stack">
                    <span className="page-hero__title-glow" aria-hidden>
                      {asset.assetTag}
                    </span>
                    <span className="page-hero__title-text">{asset.assetTag}</span>
                  </span>
                </h1>

                <div className="page-hero__underline" aria-hidden />
                <p className="page-hero__subtitle">{asset.model}</p>
              </div>
            </div>
          </div>

          <div className="page-hero__actions flex items-center gap-3">
            {activeTab === 'info' && (
              <>
                {!editMode ? (
                  <motion.button
                    whileHover={shouldReduceMotion ? undefined : { scale: 1.05, y: -2 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                    onClick={() => setEditMode(true)}
                    className="chip-industrial flex items-center gap-2 bg-muted/50 border border-border text-foreground px-6 py-3 rounded-xl shadow-sm transition-all font-bold text-xs uppercase tracking-widest"
                  >
                    Edit Asset
                  </motion.button>
                ) : (
                  <>
                    <button
                      onClick={() => setEditMode(false)}
                      className="px-6 py-3 rounded-xl bg-muted/30 border border-border text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <motion.button
                      whileHover={shouldReduceMotion ? undefined : { scale: 1.05, y: -2 }}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                      onClick={onSave}
                      className="chip-industrial flex items-center gap-2 bg-gradient-to-br from-primary to-cyan-600 text-white px-8 py-3 rounded-xl shadow-lg shadow-primary/20 transition-all font-bold text-xs uppercase tracking-widest"
                    >
                      Save Changes
                    </motion.button>
                  </>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="p-3 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/20 hover:bg-rose-500/20 transition-colors">
                      <DollarSign className="w-5 h-5 rotate-45" /> {/* Use as a pseudo-delete icon if needed, or stick to Button */}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Delete asset?</AlertDialogTitle>
                      <AlertDialogDescription className="text-sm font-medium">
                        This will permanently delete <span className="text-foreground font-bold">{asset.assetTag}</span>. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3">
                      <AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-[10px]">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete} className="rounded-xl bg-rose-600 font-bold uppercase tracking-widest text-[10px] hover:bg-rose-700">Delete Permanently</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        className="premium-surface rounded-2xl p-1.5 flex flex-wrap gap-1"
        variants={shouldReduceMotion ? undefined : pageItemVariants}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300",
                isActive 
                  ? "text-primary shadow-sm" 
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeAssetTab"
                  className="absolute inset-0 bg-primary/10 rounded-xl border border-primary/20"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </motion.div>

      {/* Tab Content */}
      <motion.div
        className="panel-frame bg-card/30 backdrop-blur-md rounded-3xl border border-border/60 shadow-xl overflow-hidden"
        variants={shouldReduceMotion ? undefined : pageItemVariants}
      >
        <div className="p-8">
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div className="flex items-center gap-3 pb-4 border-b border-border/50">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Package className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">Identification</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Asset Tag</label>
                    {editMode ? (
                      <Input value={form.assetTag} className="rounded-xl border-border/80 focus:ring-primary/10" onChange={(e) => setForm((p) => ({ ...p, assetTag: e.target.value }))} />
                    ) : (
                      <p className="text-sm font-bold text-foreground tabular-nums">{asset.assetTag}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Serial Number</label>
                    {editMode ? (
                      <Input
                        value={form.serialNumber}
                        className="rounded-xl border-border/80 focus:ring-primary/10"
                        onChange={(e) => setForm((p) => ({ ...p, serialNumber: e.target.value }))}
                      />
                    ) : (
                      <p className="text-sm font-bold text-foreground tabular-nums">{asset.serialNumber}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">MAC Address</label>
                    {editMode ? (
                      <Input
                        value={form.macAddress}
                        className="rounded-xl border-border/80 focus:ring-primary/10"
                        onChange={(e) => setForm((p) => ({ ...p, macAddress: e.target.value }))}
                      />
                    ) : (
                      <p className="text-sm font-bold text-foreground tabular-nums">{asset.macAddress || '-'}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Model</label>
                    {editMode ? (
                      <Input value={form.model} className="rounded-xl border-border/80 focus:ring-primary/10" onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))} />
                    ) : (
                      <p className="text-sm font-bold text-foreground">{asset.model}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Category</label>
                    {editMode ? (
                      <Select
                        value={form.category}
                        onValueChange={(v) =>
                          setForm((p) => ({
                            ...p,
                            category: v,
                            type: '',
                          }))
                        }
                      >
                        <SelectTrigger className="rounded-xl border-border/80">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-xl border-border/60">
                          {categoryOptions.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex">
                        <span className="px-2 py-0.5 rounded bg-muted/50 border border-border text-[10px] font-black uppercase tracking-widest text-primary">
                          {asset.category}
                        </span>
                      </div>
                    )}
                  </div>

                  {categoryNeedsType(form.category) && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Type</label>
                      {editMode ? (
                        <Select value={String(form.type ?? '')} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                          <SelectTrigger className="rounded-xl border-border/80">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl shadow-xl border-border/60">
                            {(isKabaCategory(form.category)
                              ? KABA_TYPES
                              : isScannerCategory(form.category)
                                ? SCANNER_TYPES
                                : CISCO_TYPES
                            ).map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm font-bold text-foreground">{String((asset as any).type ?? '-')}</p>
                      )}
                    </div>
                  )}
                </div>

                {(isWorkstationCategory(form.category) || isNotebookCategory(form.category)) && (
                  <div className="pt-6 border-t border-border/50">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600">
                        <User className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">Device profile</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                      {deviceProfileKeys.map((key) => (
                        <div key={key} className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{key.replace(/_/g, ' ')}</label>
                          {editMode ? (
                            <Input
                              type={key.endsWith('_date') ? 'date' : 'text'}
                              className="rounded-xl border-border/80 focus:ring-primary/10 h-9 text-xs"
                              value={String((form.deviceProfile as any)?.[key] ?? '')}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  deviceProfile: {
                                    kind: isWorkstationCategory(p.category) ? 'Workstation' : 'Notebook',
                                    ...(p.deviceProfile as any),
                                    [key]: e.target.value,
                                  },
                                }))
                              }
                            />
                          ) : (
                            <p className="text-xs font-bold text-foreground/70 tabular-nums">{String(((asset as any).deviceProfile as any)?.[key] ?? '-')}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-3 pb-4 border-b border-border/50">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">Details & Finance</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Supplier</label>
                    {editMode ? (
                      <Select value={form.supplier} onValueChange={(v) => setForm((p) => ({ ...p, supplier: v }))}>
                        <SelectTrigger className="rounded-xl border-border/80">
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-xl border-border/60">
                          {supplierOptions.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-bold text-foreground">{asset.supplier}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Site</label>
                    {editMode ? (
                      <Select value={form.site} onValueChange={(v) => setForm((p) => ({ ...p, site: v }))}>
                        <SelectTrigger className="rounded-xl border-border/80">
                          <SelectValue placeholder="Select site" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-xl border-border/60">
                          {siteOptions.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-bold text-foreground">{asset.site}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Acquisition date</label>
                    {editMode ? (
                      <Input
                        type="date"
                        className="rounded-xl border-border/80 focus:ring-primary/10"
                        value={form.acquisitionDate}
                        onChange={(e) => setForm((p) => ({ ...p, acquisitionDate: e.target.value }))}
                      />
                    ) : (
                      <p className="text-sm font-bold text-foreground tabular-nums">{new Date(asset.acquisitionDate).toLocaleDateString('en-US')}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Warranty end date</label>
                    {editMode ? (
                      <Input
                        type="date"
                        className="rounded-xl border-border/80 focus:ring-primary/10"
                        value={form.warrantyEndDate}
                        onChange={(e) => setForm((p) => ({ ...p, warrantyEndDate: e.target.value }))}
                      />
                    ) : (
                      <p className="text-sm font-bold text-foreground tabular-nums">{new Date(asset.warrantyEndDate).toLocaleDateString('en-US')}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Valeur</label>
                    {editMode ? (
                      <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 font-black text-[10px]">MAD</div>
                        <Input
                          type="number"
                          inputMode="decimal"
                          className="pl-12 rounded-xl border-border/80 focus:ring-primary/10"
                          value={form.value}
                          onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
                        />
                      </div>
                    ) : (
                      <p className="text-lg font-black text-foreground tabular-nums tracking-tight">{formatMAD(asset.value)}</p>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-border/50">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">Asset Attributes</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                    {(
                      [
                        { label: 'Description', value: asset.description },
                        { label: 'BCI', value: asset.bci },
                        { label: 'BCE', value: asset.bce },
                        { label: 'BCI Check', value: asset.bciCheck },
                        { label: 'VNC', value: asset.vnc },
                        { label: 'Immo Number', value: asset.immoNumber },
                        { label: 'Pilote', value: asset.pilote },
                        { label: 'Pilote 1', value: asset.pilote1 },
                        { label: 'Stock IN', value: asset.stockIn },
                        { label: 'Date IN', value: asset.dateIn },
                        { label: 'Stock OUT', value: asset.stockOut },
                        { label: 'Date OUT', value: asset.dateOut },
                        { label: 'Barcode', value: asset.barcode },
                        { label: 'QR Code', value: asset.qrCode },
                        { label: 'Store', value: asset.storeLocation },
                        { label: 'Cabinet', value: asset.cabinet },
                        { label: 'Rack', value: asset.rack },
                        { label: 'Level', value: asset.level },
                        { label: 'Comment', value: asset.comment },
                      ] as Array<{ label: string; value: any }>
                    ).map((f) => (
                      <div key={f.label} className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{f.label}</label>
                        <p className="text-xs font-bold text-foreground/70 truncate">{String(f.value ?? '').trim() || '-'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'movements' && (
            <div className="max-w-3xl mx-auto py-4">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                  <Package className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Movement History</h3>
              </div>
              
              {assetMovements.length === 0 ? (
                <div className="text-center py-12 rounded-3xl border border-dashed border-border/60 bg-muted/20">
                  <p className="text-sm font-bold text-muted-foreground/60 uppercase tracking-widest">No movements recorded</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {assetMovements.map((movement) => (
                    <motion.div 
                      key={movement.id} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group relative pl-8 pb-8 last:pb-0"
                    >
                      <div className="absolute left-0 top-1 bottom-0 w-px bg-border group-last:bg-transparent">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]" />
                      </div>
                      
                      <div className="premium-surface p-5 rounded-2xl border-border/40 hover:border-primary/30 transition-all duration-300">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black uppercase tracking-widest text-foreground">{movement.type}</span>
                            <span className="px-2 py-0.5 rounded-full bg-muted border border-border text-[9px] font-black tabular-nums text-muted-foreground">
                              {new Date(movement.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">By {movement.user}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm font-bold text-foreground/80 mb-3">
                          {movement.sourceSite && <span className="text-primary">{movement.sourceSite}</span>}
                          {movement.sourceSite && movement.destinationSite && <ArrowLeft className="w-3 h-3 rotate-180 text-muted-foreground/40" />}
                          {movement.destinationSite && <span className="text-cyan-600">{movement.destinationSite}</span>}
                        </div>
                        
                        {movement.comment && (
                          <p className="text-xs font-medium text-muted-foreground/70 italic line-clamp-2">
                            "{movement.comment}"
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'assignments' && (
            <div className="max-w-3xl mx-auto py-4">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <User className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Assignment History</h3>
              </div>

              {assetAssignments.length === 0 ? (
                <div className="text-center py-12 rounded-3xl border border-dashed border-border/60 bg-muted/20">
                  <p className="text-sm font-bold text-muted-foreground/60 uppercase tracking-widest">No assignments recorded</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {assetAssignments.map((assignment) => (
                    <motion.div 
                      key={assignment.id} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group relative pl-8 pb-8 last:pb-0"
                    >
                      <div className="absolute left-0 top-1 bottom-0 w-px bg-border group-last:bg-transparent">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-emerald-600 shadow-[0_0_10px_rgba(5,150,105,0.4)]" />
                      </div>
                      
                      <div className="premium-surface p-6 rounded-2xl border-border/40 hover:border-emerald-500/30 transition-all duration-300">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                          <div className="flex items-center gap-4">
                            <h4 className="text-sm font-black uppercase tracking-tight text-foreground">{assignment.userName}</h4>
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border",
                              assignment.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                              assignment.status === 'Pending' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                              'bg-muted/50 text-muted-foreground border-border'
                            )}>
                              {assignment.status}
                            </span>
                          </div>
                          <span className="text-[9px] font-black tabular-nums text-muted-foreground/40">
                            {new Date(assignment.startDate).toLocaleDateString('en-US')}
                            {assignment.returnDate && ` — ${new Date(assignment.returnDate).toLocaleDateString('en-US')}`}
                          </span>
                        </div>
                        
                        <div className="space-y-3">
                          <p className="text-xs font-bold text-foreground/60 uppercase tracking-widest">
                            {assignment.department} <span className="mx-1 text-muted-foreground/30">/</span> {assignment.site}
                          </p>
                          
                          {formatAssignmentDeviceInfo(assignment) && (
                            <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                              <p className="text-[10px] leading-relaxed font-bold text-muted-foreground/70 uppercase tracking-wider">
                                {formatAssignmentDeviceInfo(assignment)}
                              </p>
                            </div>
                          )}
                          
                          {assignment.approvedBy && (
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
                              Approved by <span className="text-foreground/50">{assignment.approvedBy}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="max-w-4xl mx-auto py-4">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Maintenance Tickets</h3>
              </div>

              {assetTickets.length === 0 ? (
                <div className="text-center py-12 rounded-3xl border border-dashed border-border/60 bg-muted/20">
                  <p className="text-sm font-bold text-muted-foreground/60 uppercase tracking-widest">No maintenance history</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {assetTickets.map((ticket) => (
                    <motion.div 
                      key={ticket.id} 
                      className="premium-surface p-6 rounded-3xl border-border/60 group hover:border-amber-500/30 transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black tabular-nums text-muted-foreground group-hover:text-amber-600 transition-colors uppercase tracking-[0.2em]">{ticket.id}</span>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                          ticket.status === 'Open' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                          ticket.status === 'InProgress' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                          'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        )}>
                          {ticket.status}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-foreground mb-4 line-clamp-2">{ticket.description}</p>
                      
                      {ticket.actions && (
                        <div className="mb-4 text-xs font-medium text-muted-foreground/80 bg-muted/30 p-3 rounded-xl border border-border/40">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 block mb-1">Actions Taken</span>
                          {ticket.actions}
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-y-3 pt-4 border-t border-border/50">
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Provider</label>
                          <span className="text-xs font-bold text-foreground/70">{ticket.provider}</span>
                        </div>
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Cost</label>
                          <span className="text-xs font-black text-amber-600 tabular-nums">{formatMAD(ticket.cost)}</span>
                        </div>
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Opened</label>
                          <span className="text-[10px] font-bold text-foreground/50 tabular-nums">{new Date(ticket.openDate).toLocaleDateString()}</span>
                        </div>
                        {ticket.closeDate && (
                          <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Closed</label>
                            <span className="text-[10px] font-bold text-foreground/50 tabular-nums">{new Date(ticket.closeDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
