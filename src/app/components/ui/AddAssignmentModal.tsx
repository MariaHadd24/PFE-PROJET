import React, { useState } from 'react';
import type { Asset, AssignmentStatus, Department, Site, User } from '../../types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

interface AddAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (assignment: any) => void | Promise<void>;
  assets: Asset[];
  users: User[];
  departments: Department[];
  sites: Site[];
  initial?: {
    device_category?: '' | 'Workstation' | 'Notebook' | 'Printer';
    assetId?: string;
    area?: string;
    assignment_date?: string;
  };
}

export function AddAssignmentModal({ isOpen, onClose, onAdd, assets, users: usersList, departments, sites, initial }: AddAssignmentModalProps) {
  const DEVICE_BRANDS = ['HP', 'Dell'] as const;
  const END_OF_LIFE_YEARS = 5;

  const parseDate = (value: unknown): Date | null => {
    const s = String(value ?? '').trim();
    if (!s) return null;
    const ms = Date.parse(s);
    if (!Number.isNaN(ms)) return new Date(ms);
    return null;
  };

  const isEndOfLifeByAge = (inServiceDate: unknown): boolean => {
    const d = parseDate(inServiceDate);
    if (!d) return false;
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - END_OF_LIFE_YEARS);
    return d.getTime() <= cutoff.getTime();
  };

  const isAssetObsolete = (asset: Asset): boolean => {
    const status = String((asset as any)?.status ?? '').trim();
    if (status === 'Retired') return true;
    return isEndOfLifeByAge((asset as any)?.dateOut);
  };

  const [formData, setFormData] = useState({
    device_category: '' as '' | 'Workstation' | 'Notebook' | 'Printer',

    assetId: '',

    area: '',

    brand: '',

    hostname: '',
    usb_status: '',
    usb: '',
    user: '',
    username: '',
    full_name: '',
    service: '',
    ws_sn: '',
    ws_model: '',
    nb_sn: '',
    model_nb: '',
    mac_address: '',
    os: '',
    immo_ws: '',
    immo_number: '',
    bci_ws: '',
    bci: '',
    acquisition_date: '',
    assignment_date: new Date().toISOString().split('T')[0],
    end_of_support_date: '',
    monitor_model: '',
    monitor_sn: '',
    monitor_immo: '',
    monitor_bci: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedAsset = (assets || []).find((a) => a.id === formData.assetId);
  const selectedAssetCategory = selectedAsset ? inferDeviceCategoryFromAsset(selectedAsset) : '';
  const selectedPrinter = (formData.device_category === 'Printer' || selectedAssetCategory === 'Printer') ? selectedAsset : undefined;

  const displayValue = (value: unknown) => {
    const s = String(value ?? '').trim();
    return s || '-';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    setFormData(prev => {
      if (name === 'device_category') {
        return { ...prev, device_category: value as any, assetId: '', brand: '' };
      }
      return { ...prev, [name]: value };
    });

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.device_category) {
      newErrors.device_category = 'Device category is required';
    }

    if (formData.device_category === 'Printer') {
      if (!formData.assetId) {
        newErrors.assetId = 'Please select a printer from stock';
      }
      if (!formData.area.trim()) {
        newErrors.area = 'Area is required for printers';
      }
    } else {
      // Either pick an existing asset, or enter device details.
      if (!formData.assetId && !formData.hostname) {
        newErrors.hostname = 'hostname is required';
      }

      if ((formData.device_category === 'Workstation' || formData.device_category === 'Notebook') && !String(formData.brand ?? '').trim()) {
        newErrors.brand = 'Brand is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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
    return s;
  }

  function normalizeCategoryTabLabel(input: unknown): string {
    const s = String(input ?? '').trim();
    if (!s) return '';
    const key = s.toLowerCase();
    if (key === 'computer') return 'Workstation';
    if (key === 'laptop') return 'Notebook';
    return s;
  }

  function inferDeviceCategoryFromAsset(asset: Asset): '' | 'Workstation' | 'Notebook' | 'Printer' {
    const profileKind = String((asset as any)?.deviceProfile?.kind ?? '').trim();
    if (profileKind === 'Workstation' || profileKind === 'Notebook') return profileKind as any;

    const category = normalizeCategory((asset as any)?.category);
    const section = normalizeCategory((asset as any)?.section);
    const categoryTab = normalizeCategoryTabLabel(category);
    const sectionTab = normalizeCategoryTabLabel(section);

    if (categoryTab === 'Printer' || sectionTab === 'Printer') return 'Printer';
    if (categoryTab === 'Notebook' || sectionTab === 'Notebook') return 'Notebook';
    if (categoryTab === 'Workstation' || sectionTab === 'Workstation') return 'Workstation';

    // Fallback: handle common variants that appear in assignment data.
    const raw = String((asset as any)?.category ?? '').trim().toLowerCase();
    const sectionRaw = String((asset as any)?.section ?? '').trim().toLowerCase();
    const combined = `${raw} ${sectionRaw}`.trim();
    if (!combined) return '';
    if (combined.includes('printer') || combined.includes('imprim') || combined.includes('copier') || combined.includes('mfp')) return 'Printer';
    if (combined.includes('notebook') || combined.includes('laptop') || combined === 'nb') return 'Notebook';
    if (combined.includes('workstation') || combined === 'workstations' || combined.includes('computer/ws') || combined.includes('desktop')) return 'Workstation';

    // Extra heuristic for Stock Inventory imports where category/section can be a brand (e.g., ZEBRA, HP)
    const modelRaw = String((asset as any)?.model ?? '').trim().toLowerCase();
    const typeRaw = String((asset as any)?.type ?? '').trim().toLowerCase();
    const supplierRaw = String((asset as any)?.supplier ?? '').trim().toLowerCase();
    const ipRaw = String((asset as any)?.ipAddress ?? '').trim().toLowerCase();

    const looksLikePrinter =
      modelRaw.includes('printer') ||
      modelRaw.includes('laserjet') ||
      modelRaw.includes('mfp') ||
      modelRaw.includes('copier') ||
      modelRaw.includes('imprim') ||
      // Zebra printer models (ZT/ZQ etc.)
      /^z[tq]\d+/.test(modelRaw.replace(/\s+/g, '')) ||
      typeRaw.includes('zebra') ||
      typeRaw.includes('printer') ||
      // Many printers have an IP address (helps when category is ambiguous)
      (!!ipRaw && (typeRaw.includes('hp') || supplierRaw.includes('hp') || modelRaw.includes('hp') || typeRaw.includes('zebra') || supplierRaw.includes('zebra')));

    if (looksLikePrinter) return 'Printer';
    return '';
  }

  const getAssignableAssets = () => {
    const target = formData.device_category;
    return (assets || [])
      .filter((a) => {
        if (isAssetObsolete(a)) return false;
        const status = String((a as any)?.status ?? 'Available').trim();
        if (status && status !== 'Available') return false;

        const inferred = inferDeviceCategoryFromAsset(a);
        const isWorkstation = inferred === 'Workstation';
        const isNotebook = inferred === 'Notebook';
        const isPrinter = inferred === 'Printer';
        if (target === 'Workstation') return isWorkstation;
        if (target === 'Notebook') return isNotebook;
        if (target === 'Printer') return isPrinter;
        return isWorkstation || isNotebook || isPrinter;
      })
      .sort((a, b) => {
        const ia = inferDeviceCategoryFromAsset(a);
        const ib = inferDeviceCategoryFromAsset(b);

        const sa = String((a as any)?.status ?? 'Available').trim().toLowerCase();
        const sb = String((b as any)?.status ?? 'Available').trim().toLowerCase();
        const aAvailable = sa === 'available';
        const bAvailable = sb === 'available';

        // Available first
        if (aAvailable !== bAvailable) return aAvailable ? -1 : 1;

        return 0;
      });
  };

  const handleAssetSelect = (assetId: string) => {
    const selected = (assets || []).find((a) => a.id === assetId);
    if (!selected) {
      setFormData((prev) => ({ ...prev, assetId: '' }));
      return;
    }

    if (isAssetObsolete(selected) || String((selected as any)?.status ?? '').trim() === 'Retired') {
      setFormData((prev) => ({ ...prev, assetId: '' }));
      setErrors((prev) => ({ ...prev, assetId: `Asset is obsolete (Retired or > ${END_OF_LIFE_YEARS} years) and cannot be assigned` }));
      return;
    }

    const inferBrand = (supplier: unknown): '' | 'HP' | 'Dell' => {
      const s = String(supplier ?? '').trim().toLowerCase();
      if (!s) return '';
      if (s.includes('hp')) return 'HP';
      if (s.includes('dell')) return 'Dell';
      return '';
    };

    const inferredCategory = inferDeviceCategoryFromAsset(selected);
    const effectiveCategory = inferredCategory || formData.device_category;

    const hostnameFromProfile = (selected as any)?.deviceProfile?.hostname;
    const hostname = String(hostnameFromProfile ?? '').trim() || String(selected.assetTag ?? '').trim();

    const serial = String(selected.serialNumber ?? '').trim();
    const model = String(selected.model ?? '').trim();
    const mac = String((selected as any).macAddress ?? '').trim();
    const immo = String((selected as any).immoNumber ?? '').trim();
    const bci = String((selected as any).bci ?? '').trim();
    const acquisition = String((selected as any).acquisitionDate ?? '').trim();

    setFormData((prev) => ({
      ...prev,
      assetId: selected.id,
      device_category: (effectiveCategory || prev.device_category) as any,
      area: prev.area,
      brand: inferBrand((selected as any)?.supplier) || prev.brand,
      hostname: hostname || prev.hostname,
      mac_address: mac || prev.mac_address,
      acquisition_date: acquisition || prev.acquisition_date,
      ws_sn: effectiveCategory === 'Workstation' ? (serial || prev.ws_sn) : prev.ws_sn,
      ws_model: effectiveCategory === 'Workstation' ? (model || prev.ws_model) : prev.ws_model,
      immo_ws: effectiveCategory === 'Workstation' ? (immo || prev.immo_ws) : prev.immo_ws,
      bci_ws: effectiveCategory === 'Workstation' ? (bci || prev.bci_ws) : prev.bci_ws,
      nb_sn: effectiveCategory === 'Notebook' ? (serial || prev.nb_sn) : prev.nb_sn,
      model_nb: effectiveCategory === 'Notebook' ? (model || prev.model_nb) : prev.model_nb,
      immo_number: effectiveCategory === 'Notebook' ? (immo || prev.immo_number) : prev.immo_number,
      bci: effectiveCategory === 'Notebook' ? (bci || prev.bci) : prev.bci,
    }));

    if (errors.assetId || errors.device_category || errors.hostname || errors.area) {
      setErrors((prev) => ({ ...prev, assetId: '', device_category: '', hostname: '', area: '' }));
    }
  };

  React.useEffect(() => {
    if (!isOpen) return;
    if (!initial) return;

    const nextDeviceCategory = (initial.device_category ?? '') as any;
    const nextAssetId = String(initial.assetId ?? '').trim();
    const nextArea = String(initial.area ?? '').trim();
    const nextAssignmentDate = String(initial.assignment_date ?? '').trim();

    setFormData((prev) => ({
      ...prev,
      device_category: nextDeviceCategory || prev.device_category,
      assetId: nextAssetId || prev.assetId,
      area: nextArea || prev.area,
      assignment_date: nextAssignmentDate || prev.assignment_date,
    }));

    if (nextAssetId) {
      handleAssetSelect(nextAssetId);
    }
  }, [isOpen, initial?.assetId, initial?.device_category, initial?.area, initial?.assignment_date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!validateForm()) {
      return;
    }

    const isPrinter = formData.device_category === 'Printer';

    const effectiveUserName = (isPrinter
      ? (formData.area || 'Unknown')
      : (formData.full_name || formData.username || formData.user || 'Unknown')
    ).trim();

    const effectiveDepartment = (isPrinter ? 'Area' : (formData.service || 'Unknown')).trim();
    const effectiveSite = 'Unknown';
    const effectiveStartDate = (formData.assignment_date || new Date().toISOString().split('T')[0]).trim();

    const newAssignment = {
      id: `ASG-${Date.now()}`,
      userName: effectiveUserName,
      brand: String(formData.brand ?? '').trim() || undefined,
      area: isPrinter ? (formData.area || undefined) : undefined,
      department: effectiveDepartment,
      site: effectiveSite,
      startDate: effectiveStartDate,
      status: 'Pending' as AssignmentStatus,

      assetId: formData.assetId || undefined,

      device_category: formData.device_category || undefined,

      hostname: formData.hostname || undefined,
      usb_status: formData.usb_status || undefined,
      usb: formData.usb || undefined,
      user: formData.user || undefined,
      username: formData.username || undefined,
      full_name: formData.full_name || undefined,
      service: formData.service || undefined,
      ws_sn: formData.ws_sn || undefined,
      ws_model: formData.ws_model || undefined,
      nb_sn: formData.nb_sn || undefined,
      model_nb: formData.model_nb || undefined,
      mac_address: formData.mac_address || undefined,
      os: formData.os || undefined,
      immo_ws: formData.immo_ws || undefined,
      immo_number: formData.immo_number || undefined,
      bci_ws: formData.bci_ws || undefined,
      bci: formData.bci || undefined,
      acquisition_date: formData.acquisition_date || undefined,
      assignment_date: formData.assignment_date || undefined,
      end_of_support_date: formData.end_of_support_date || undefined,
      monitor_model: formData.monitor_model || undefined,
      monitor_sn: formData.monitor_sn || undefined,
      monitor_immo: formData.monitor_immo || undefined,
      monitor_bci: formData.monitor_bci || undefined,
    };

    try {
      setIsSubmitting(true);
      await Promise.resolve(onAdd(newAssignment));
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      device_category: '',

      assetId: '',
      area: '',
      brand: '',
      hostname: '',
      usb_status: '',
      usb: '',
      user: '',
      username: '',
      full_name: '',
      service: '',
      ws_sn: '',
      ws_model: '',
      nb_sn: '',
      model_nb: '',
      mac_address: '',
      os: '',
      immo_ws: '',
      immo_number: '',
      bci_ws: '',
      bci: '',
      acquisition_date: '',
      assignment_date: new Date().toISOString().split('T')[0],
      end_of_support_date: '',
      monitor_model: '',
      monitor_sn: '',
      monitor_immo: '',
      monitor_bci: '',
    });
    setErrors({});
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>New assignment</DialogTitle>
            <DialogDescription>Assign an available Workstation, Notebook, or Printer.</DialogDescription>
          </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Device Category */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Device category</label>
                <select
                  name="device_category"
                  value={formData.device_category}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none ${
                    errors.device_category ? 'border-destructive' : 'border-border'
                  }`}
                >
                  <option value="">Select...</option>
                  <option value="Workstation">Workstation</option>
                  <option value="Notebook">Notebook</option>
                  <option value="Printer">Printer</option>
                </select>
                {errors.device_category && <p className="mt-1 text-sm text-destructive">{errors.device_category}</p>}
              </div>

              {/* Existing Asset */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Asset (from stock)</label>
                <select
                  name="assetId"
                  value={formData.assetId}
                  onChange={(e) => handleAssetSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent disabled:opacity-60"
                >
                  <option value="">Select an asset...</option>
                  {getAssignableAssets().map((a) => {
                    const inferred = inferDeviceCategoryFromAsset(a);
                    const status = String((a as any)?.status ?? 'Available').trim();
                    const isAvailable = status.toLowerCase() === 'available';
                    const isAssignable = Boolean(inferred);
                    const brand = String((a as any)?.type ?? '').trim();
                    const brandPart = brand ? `${brand} — ` : '';

                    return (
                    <option
                      key={a.id}
                      value={a.id}
                      disabled={!isAvailable || !isAssignable}
                    >
                      {`${a.assetTag} — ${brandPart}${a.model} — ${a.serialNumber} — ${String((a as any)?.ipAddress ?? '-')} — ${String((a as any)?.site ?? '-')} — ${String(a.category ?? '-')} (${status})`}
                    </option>
                    );
                  })}
                </select>
                {errors.assetId && <p className="mt-1 text-sm text-destructive">{errors.assetId}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  Shows assets for the selected category; only <strong>Available</strong> can be selected.
                </p>
              </div>

              {formData.device_category === 'Printer' && (
                <div className="md:col-span-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Area</label>
                      <input
                        type="text"
                        name="area"
                        value={formData.area}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent ${
                          errors.area ? 'border-destructive' : 'border-border'
                        }`}
                      />
                      {errors.area && <p className="mt-1 text-sm text-destructive">{errors.area}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">assignment_date</label>
                      <input
                        type="date"
                        name="assignment_date"
                        value={formData.assignment_date}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                      />
                    </div>
                  </div>

                  {selectedPrinter && (
                    <div className="mt-4 p-4 border border-border rounded-lg bg-card">
                      <p className="text-sm font-medium text-foreground mb-3">Printer details</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">Brand</label>
                          <input
                            type="text"
                            value={displayValue((selectedPrinter as any)?.type)}
                            disabled
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none disabled:opacity-60"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">Model</label>
                          <input
                            type="text"
                            value={displayValue(selectedPrinter.model)}
                            disabled
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none disabled:opacity-60"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">Serial Number</label>
                          <input
                            type="text"
                            value={displayValue(selectedPrinter.serialNumber)}
                            disabled
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none disabled:opacity-60"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">Status</label>
                          <input
                            type="text"
                            value={displayValue((selectedPrinter as any)?.condition || (selectedPrinter as any)?.status)}
                            disabled
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none disabled:opacity-60"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">Asset</label>
                          <input
                            type="text"
                            value={displayValue((selectedPrinter as any)?.immoNumber)}
                            disabled
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none disabled:opacity-60"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">Reception Date</label>
                          <input
                            type="text"
                            value={displayValue((selectedPrinter as any)?.dateIn)}
                            disabled
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none disabled:opacity-60"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">Responsible</label>
                          <input
                            type="text"
                            value={displayValue((selectedPrinter as any)?.pilote)}
                            disabled
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none disabled:opacity-60"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">Check</label>
                          <input
                            type="text"
                            value={displayValue((selectedPrinter as any)?.bciCheck)}
                            disabled
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none disabled:opacity-60"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">Owner</label>
                          <input
                            type="text"
                            value={displayValue((selectedPrinter as any)?.department)}
                            disabled
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none disabled:opacity-60"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">Printer Name</label>
                          <input
                            type="text"
                            value={displayValue((selectedPrinter as any)?.assetTag)}
                            disabled
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none disabled:opacity-60"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">Site</label>
                          <input
                            type="text"
                            value={displayValue((selectedPrinter as any)?.site)}
                            disabled
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none disabled:opacity-60"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">IP</label>
                          <input
                            type="text"
                            value={displayValue((selectedPrinter as any)?.ipAddress)}
                            disabled
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none disabled:opacity-60"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(formData.device_category === 'Workstation' || formData.device_category === 'Notebook') && (
                <div className="md:col-span-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">hostname</label>
                      <input
                        type="text"
                        name="hostname"
                        value={formData.hostname}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                      />
                      {errors.hostname && <p className="mt-1 text-sm text-destructive">{errors.hostname}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Brand</label>
                      <select
                        name="brand"
                        value={formData.brand}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent ${
                          errors.brand ? 'border-destructive' : 'border-border'
                        }`}
                      >
                        <option value="">Select...</option>
                        {DEVICE_BRANDS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                      {errors.brand && <p className="mt-1 text-sm text-destructive">{errors.brand}</p>}
                    </div>

                    {formData.device_category === 'Workstation' ? (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">usb_status</label>
                          <input
                            type="text"
                            name="usb_status"
                            value={formData.usb_status}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">user</label>
                          <input
                            type="text"
                            name="user"
                            value={formData.user}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">ws_sn</label>
                          <input
                            type="text"
                            name="ws_sn"
                            value={formData.ws_sn}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">ws_model</label>
                          <input
                            type="text"
                            name="ws_model"
                            value={formData.ws_model}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">immo_ws</label>
                          <input
                            type="text"
                            name="immo_ws"
                            value={formData.immo_ws}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">bci_ws</label>
                          <input
                            type="text"
                            name="bci_ws"
                            value={formData.bci_ws}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">usb</label>
                          <input
                            type="text"
                            name="usb"
                            value={formData.usb}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">username</label>
                          <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">nb_sn</label>
                          <input
                            type="text"
                            name="nb_sn"
                            value={formData.nb_sn}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">model_nb</label>
                          <input
                            type="text"
                            name="model_nb"
                            value={formData.model_nb}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">mac_address</label>
                          <input
                            type="text"
                            name="mac_address"
                            value={formData.mac_address}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">immo_number</label>
                          <input
                            type="text"
                            name="immo_number"
                            value={formData.immo_number}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">bci</label>
                          <input
                            type="text"
                            name="bci"
                            value={formData.bci}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">full_name</label>
                      <input
                        type="text"
                        name="full_name"
                        value={formData.full_name}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">service</label>
                      <input
                        type="text"
                        name="service"
                        value={formData.service}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">os</label>
                      <input
                        type="text"
                        name="os"
                        value={formData.os}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">acquisition_date</label>
                      <input
                        type="date"
                        name="acquisition_date"
                        value={formData.acquisition_date}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">assignment_date</label>
                      <input
                        type="date"
                        name="assignment_date"
                        value={formData.assignment_date}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">end_of_support_date</label>
                      <input
                        type="date"
                        name="end_of_support_date"
                        value={formData.end_of_support_date}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">monitor_model</label>
                      <input
                        type="text"
                        name="monitor_model"
                        value={formData.monitor_model}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">monitor_sn</label>
                      <input
                        type="text"
                        name="monitor_sn"
                        value={formData.monitor_sn}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">monitor_immo</label>
                      <input
                        type="text"
                        name="monitor_immo"
                        value={formData.monitor_immo}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">monitor_bci</label>
                      <input
                        type="text"
                        name="monitor_bci"
                        value={formData.monitor_bci}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> For Workstation/Notebook you can select an asset or enter device information. For Printers, select a printer asset and set its Area.
              </p>
            </div>

            {/* Actions */}
          <DialogFooter>
            <button
              type="button"
              onClick={handleClose}
              className="border border-border bg-card text-foreground px-4 py-2 rounded-lg hover:bg-muted/30 transition-all font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-[#1B4F91] to-[#2563EB] text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create assignment
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
