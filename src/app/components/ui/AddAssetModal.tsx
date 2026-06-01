import React, { useState } from 'react';
import type { AssetStatus, Category, Site, Supplier } from '../../types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatIsoToFr(iso: string) {
  if (!iso) return '';
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(iso);
  if (!m) return '';
  const [y, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${y}`;
}

function toIsoDateString(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function parseDateInputToIso(input: string) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return toIsoDateString(d);
  }

  const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (fr) {
    const day = Number(fr[1]);
    const month = Number(fr[2]);
    const year = Number(fr[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return toIsoDateString(d);
  }

  return null;
}

function addYearsIso(iso: string, years: number) {
  const parsed = parseDateInputToIso(iso);
  if (!parsed) return null;
  const [y, m, d] = parsed.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setFullYear(dt.getFullYear() + years);
  return toIsoDateString(dt);
}

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (asset: any) => void;
  categories: Category[];
  sites: Site[];
  suppliers: Supplier[];
}

const SCANNER_TYPES = ['Cradle', 'Pistolet', 'Barcode Scanner'] as const;
const CISCO_TYPES = ['Switch', 'Router', 'Wireless Controller', 'Access Point'] as const;
const NOTEBOOK_WORKSTATION_BRANDS = ['HP', 'Dell'] as const;
const PRINTER_BRANDS = ['HP', 'ZEBRA'] as const;

function getAllowedBrandsForCategory(category: string) {
  if (isNotebookCategory(category) || isWorkstationCategory(category)) return NOTEBOOK_WORKSTATION_BRANDS;
  if (category === 'Printer') return PRINTER_BRANDS;
  return null;
}

function isScannerCategory(category: string) {
  return category === 'Scanner' || category === 'Scanners';
}

function isWorkstationCategory(category: string) {
  return category === 'Workstation';
}

function isNotebookCategory(category: string) {
  return category === 'Notebook';
}

function categoryUsesBrand(category: string) {
  return getAllowedBrandsForCategory(category) !== null;
}

function categoryNeedsType(category: string) {
  return isScannerCategory(category) || category === 'Cisco';
}

export function AddAssetModal({ isOpen, onClose, onAdd, categories, sites, suppliers }: AddAssetModalProps) {
  const todayFr = new Date().toLocaleDateString('fr-FR');

  const [formData, setFormData] = useState({
    assetTag: '',
    serialNumber: '',
    model: '',
    category: '',
    type: '',
    deviceProfile: {} as any,
    site: '',
    supplier: '',
    status: 'Available' as AssetStatus,
    value: '',
    acquisitionDate: todayFr,
    warrantyExpiration: '',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'category') {
      // Reset type whenever category changes (prevents mismatched options).
      setFormData(prev => {
        const nextCategory = value;
        const next: any = { ...prev, category: nextCategory, type: '', deviceProfile: {} };
        const allowedBrands = getAllowedBrandsForCategory(nextCategory);
        if (allowedBrands) {
          const supplierKey = String(prev.supplier ?? '').trim().toLowerCase();
          const allowed = allowedBrands.map((b) => b.toLowerCase());
          if (!allowed.includes(supplierKey)) next.supplier = '';
        }
        return next;
      });
      if (errors.category || errors.type) {
        setErrors(prev => ({ ...prev, category: '', type: '' }));
      }
      return;
    }

    if (name.startsWith('deviceProfile.')) {
      const key = name.slice('deviceProfile.'.length);
      setFormData(prev => ({
        ...prev,
        deviceProfile: { ...(prev as any).deviceProfile, [key]: value },
      }));
      if (errors[name]) {
        setErrors(prev => ({ ...prev, [name]: '' }));
      }
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.assetTag.trim()) {
      newErrors.assetTag = 'Asset tag is required';
    }
    if (!formData.serialNumber.trim()) {
      newErrors.serialNumber = 'Serial number is required';
    }
    if (!formData.model.trim()) {
      newErrors.model = 'Model is required';
    }
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }
    if (categoryNeedsType(formData.category) && !formData.type) {
      newErrors.type = 'Type is required';
    }
    if (!formData.site) {
      newErrors.site = 'Site is required';
    }
    if (!formData.supplier) {
      newErrors.supplier = categoryUsesBrand(formData.category) ? 'Brand is required' : 'Supplier is required';
    }
    if (!formData.value || parseFloat(formData.value) <= 0) {
      newErrors.value = 'A valid value is required';
    }

    const acqIso = parseDateInputToIso(formData.acquisitionDate);
    if (formData.acquisitionDate && !acqIso) {
      newErrors.acquisitionDate = 'Invalid date (jj/mm/aaaa)';
    }

    const warIso = parseDateInputToIso(formData.warrantyExpiration);
    if (formData.warrantyExpiration && !warIso) {
      newErrors.warrantyExpiration = 'Invalid date (jj/mm/aaaa)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const acquisitionDateIso =
      parseDateInputToIso(formData.acquisitionDate) ?? new Date().toISOString().split('T')[0];
    const warrantyEndDateIso =
      parseDateInputToIso(formData.warrantyExpiration) ?? addYearsIso(acquisitionDateIso, 1) ?? acquisitionDateIso;

    const newAsset = {
      id: `AST-${Date.now()}`,
      assetTag: formData.assetTag,
      serialNumber: formData.serialNumber,
      model: formData.model,
      category: formData.category,
      type: categoryNeedsType(formData.category) ? formData.type : undefined,
      deviceProfile:
        isWorkstationCategory(formData.category)
          ? { kind: 'Workstation', ...(formData as any).deviceProfile }
          : isNotebookCategory(formData.category)
            ? { kind: 'Notebook', ...(formData as any).deviceProfile }
            : undefined,
      site: formData.site,
      supplier: formData.supplier,
      status: formData.status,
      value: parseFloat(formData.value),
      acquisitionDate: acquisitionDateIso,
      warrantyEndDate: warrantyEndDateIso,
      notes: formData.notes || undefined
    };

    onAdd(newAsset);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      assetTag: '',
      serialNumber: '',
      model: '',
      category: '',
      type: '',
      deviceProfile: {},
      site: '',
      supplier: '',
      status: 'Available',
      value: '',
      acquisitionDate: new Date().toLocaleDateString('fr-FR'),
      warrantyExpiration: '',
      notes: ''
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
      <DialogContent className="sm:max-w-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Add a new asset</DialogTitle>
            <DialogDescription>Create an IT asset in inventory.</DialogDescription>
          </DialogHeader>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Asset Tag */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Asset Tag <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  name="assetTag"
                  value={formData.assetTag}
                  onChange={handleChange}
                  placeholder="ex: LEONI-LAP-001"
                  className={`w-full px-3 py-2 border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none ${
                    errors.assetTag ? 'border-destructive' : 'border-border'
                  }`}
                />
                {errors.assetTag && (
                  <p className="mt-1 text-sm text-destructive">{errors.assetTag}</p>
                )}
              </div>

              {/* Serial Number */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Serial number <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  name="serialNumber"
                  value={formData.serialNumber}
                  onChange={handleChange}
                  placeholder="ex: SN123456789"
                  className={`w-full px-3 py-2 border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none ${
                    errors.serialNumber ? 'border-destructive' : 'border-border'
                  }`}
                />
                {errors.serialNumber && (
                  <p className="mt-1 text-sm text-destructive">{errors.serialNumber}</p>
                )}
              </div>

              {/* Supplier / Brand */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {categoryUsesBrand(formData.category) ? 'Brand' : 'Supplier'} <span className="text-destructive">*</span>
                </label>
                <select
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent ${
                    errors.supplier ? 'border-destructive' : 'border-border'
                  }`}
                >
                  <option value="">Select...</option>
                  {categoryUsesBrand(formData.category)
                    ? (getAllowedBrandsForCategory(formData.category) ?? []).map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))
                    : suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.name}>
                          {supplier.name}
                        </option>
                      ))}
                </select>
                {errors.supplier && <p className="mt-1 text-sm text-destructive">{errors.supplier}</p>}
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Category <span className="text-destructive">*</span>
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none ${
                    errors.category ? 'border-destructive' : 'border-border'
                  }`}
                >
                  <option value="">Select...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                {errors.category && (
                  <p className="mt-1 text-sm text-destructive">{errors.category}</p>
                )}
              </div>

              {/* Type (Scanner / Cisco) */}
              {categoryNeedsType(formData.category) && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Type <span className="text-destructive">*</span>
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none ${
                      errors.type ? 'border-destructive' : 'border-border'
                    }`}
                  >
                    <option value="">Select...</option>
                    {(isScannerCategory(formData.category) ? SCANNER_TYPES : CISCO_TYPES).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {errors.type && <p className="mt-1 text-sm text-destructive">{errors.type}</p>}
                </div>
              )}

              {/* Device profile fields (Workstation / Notebook) */}
              {(isWorkstationCategory(formData.category) || isNotebookCategory(formData.category)) && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">
                    {isWorkstationCategory(formData.category) ? 'Workstation' : 'Notebook'} profile
                  </h4>

                  {isWorkstationCategory(formData.category) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
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
                      ].map((key) => (
                        <div key={key}>
                          <label className="block text-sm font-medium text-foreground mb-2">{key}</label>
                          <input
                            type={key.endsWith('_date') ? 'date' : 'text'}
                            name={`deviceProfile.${key}`}
                            value={String(((formData as any).deviceProfile?.[key] ?? '') as any)}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent border-border"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {isNotebookCategory(formData.category) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
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
                      ].map((key) => (
                        <div key={key}>
                          <label className="block text-sm font-medium text-foreground mb-2">{key}</label>
                          <input
                            type={key.endsWith('_date') ? 'date' : 'text'}
                            name={`deviceProfile.${key}`}
                            value={String(((formData as any).deviceProfile?.[key] ?? '') as any)}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border bg-card text-foreground rounded-lg outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent border-border"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Site */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Site <span className="text-destructive">*</span>
                </label>
                <select
                  name="site"
                  value={formData.site}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none ${
                    errors.site ? 'border-destructive' : 'border-border'
                  }`}
                >
                  <option value="">Select...</option>
                  {sites.map(site => (
                    <option key={site.id} value={site.name}>{site.name}</option>
                  ))}
                </select>
                {errors.site && (
                  <p className="mt-1 text-sm text-destructive">{errors.site}</p>
                )}
              </div>

              {/* Supplier */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Supplier <span className="text-destructive">*</span>
                </label>
                <select
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none ${
                    errors.supplier ? 'border-destructive' : 'border-border'
                  }`}
                >
                  <option value="">Select...</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.name}>{supplier.name}</option>
                  ))}
                </select>
                {errors.supplier && (
                  <p className="mt-1 text-sm text-destructive">{errors.supplier}</p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Status <span className="text-destructive">*</span>
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none"
                >
                  <option value="Available">Available</option>
                  <option value="Assigned">Assigned</option>
                  <option value="InRepair">In repair</option>
                  <option value="Retired">Retired</option>
                </select>
              </div>

              {/* Value */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Value (MAD) <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  name="value"
                  value={formData.value}
                  onChange={handleChange}
                  placeholder="ex: 1200"
                  min="0"
                  step="0.01"
                  className={`w-full px-3 py-2 border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none ${
                    errors.value ? 'border-destructive' : 'border-border'
                  }`}
                />
                {errors.value && (
                  <p className="mt-1 text-sm text-destructive">{errors.value}</p>
                )}
              </div>

              {/* Acquisition Date */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Acquisition date</label>
                <input
                  type="text"
                  name="acquisitionDate"
                  value={formData.acquisitionDate}
                  onChange={handleChange}
                  placeholder="23/02/2026"
                  className="w-full px-3 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none"
                />
                {errors.acquisitionDate && (
                  <p className="mt-1 text-sm text-destructive">{errors.acquisitionDate}</p>
                )}
              </div>

              {/* Warranty Expiration */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Warranty expiration</label>
                <input
                  type="text"
                  name="warrantyExpiration"
                  value={formData.warrantyExpiration}
                  onChange={handleChange}
                  placeholder="jj/mm/aaaa"
                  className="w-full px-3 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none"
                />
                {errors.warrantyExpiration && (
                  <p className="mt-1 text-sm text-destructive">{errors.warrantyExpiration}</p>
                )}
              </div>
            </div>

            {/* Notes - Full Width */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Additional information..."
                className="w-full px-3 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none resize-none"
              />
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
              className="bg-gradient-to-r from-[#1B4F91] to-[#2563EB] text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              Add asset
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
