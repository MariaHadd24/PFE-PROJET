import React, { useMemo, useState } from 'react';
import type { AssetStatus, Category, Site } from '../../types';
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

const SCANNER_TYPES = ['Cradle', 'Pistolet', 'Barcode Scanner'] as const;
const CISCO_TYPES = ['Switch', 'Router', 'Wireless Controller', 'Access Point'] as const;
const NOTEBOOK_WORKSTATION_BRANDS = ['HP', 'Dell'] as const;
const PRINTER_BRANDS = ['HP', 'ZEBRA'] as const;

function getAllowedBrandsForCategory(category: string) {
  if (category === 'Notebook' || category === 'Workstation') return NOTEBOOK_WORKSTATION_BRANDS;
  if (category === 'Printer') return PRINTER_BRANDS;
  return null;
}

function categoryUsesBrand(category: string) {
  return getAllowedBrandsForCategory(category) !== null;
}

function isScannerCategory(category: string) {
  return category === 'Scanner' || category === 'Scanners';
}

function categoryNeedsType(category: string) {
  return isScannerCategory(category) || category === 'Cisco';
}

type StockAssetDraft = {
  assetId: string;
  type: string;
  assetName: string;
  category: string;
  serialNumber: string;
  barcode: string;
  qrCode: string;
  macAddress: string;
  location: string;
  storeLocation: string;
  cabinet: string;
  rack: string;
  level: string;
  acquisitionDate: string;
  warrantyExpiry: string;
  status: AssetStatus;
  pilote: string;
  description: string;
  bci: string;
  bce: string;
  vnc: string;
  immoNumber: string;
  pilote1: string;
  stockIn: string;
  stockOut: string;
  dateIn: string;
  dateOut: string;
  comment: string;
};

interface AddStockAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (asset: any) => void;
  categories: Category[];
  sites: Site[];
}

export function AddStockAssetModal({ isOpen, onClose, onAdd, categories, sites }: AddStockAssetModalProps) {
  const todayFr = useMemo(() => new Date().toLocaleDateString('fr-FR'), []);

  const filteredCategories = useMemo(() => {
    const hiddenExact = new Set(['hp', 'zebra', 'cradle', 'barcode scanner']);
    return (categories || []).filter((cat) => {
      const name = String(cat?.name ?? '').trim();
      if (!name) return false;
      const key = name.toLowerCase();
      if (hiddenExact.has(key)) return false;
      if (key.includes('terminal ip')) return false;
      return true;
    });
  }, [categories]);

  const [formData, setFormData] = useState<StockAssetDraft>({
    assetId: '',
    type: '',
    assetName: '',
    category: '',
    serialNumber: '',
    barcode: '',
    qrCode: '',
    macAddress: '',
    location: '',
    storeLocation: '',
    cabinet: '',
    rack: '',
    level: '',
    acquisitionDate: todayFr,
    warrantyExpiry: '',
    status: 'Available',
    pilote: '',
    description: '',
    bci: '',
    bce: '',
    vnc: '',
    immoNumber: '',
    pilote1: '',
    stockIn: '',
    stockOut: '',
    dateIn: '',
    dateOut: '',
    comment: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;

    if (name === 'category') {
      setFormData((prev) => ({ ...prev, category: value, type: '' } as StockAssetDraft));
      if (errors.category || errors.type) {
        setErrors((prev) => ({ ...prev, category: '', type: '' }));
      }
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value } as StockAssetDraft));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};

    // Keep required fields aligned with the table essentials
    if (!formData.assetId.trim()) next.assetId = 'Asset ID is required';
    if (!formData.assetName.trim()) next.assetName = 'Asset Name is required';
    if (!formData.category) next.category = 'Category is required';
    if (categoryNeedsType(formData.category) && !formData.type.trim()) next.type = 'Type is required';
    const allowedBrands = getAllowedBrandsForCategory(formData.category);
    if (allowedBrands) {
      const brandKey = formData.type.trim().toLowerCase();
      if (!brandKey) {
        next.type = 'Brand is required';
      } else {
        const allowed = allowedBrands.map((b) => b.toLowerCase());
        if (!allowed.includes(brandKey)) {
          next.type = `Brand must be ${allowedBrands.join(' / ')}`;
        }
      }
    }
    if (!formData.serialNumber.trim()) next.serialNumber = 'Serial Number is required';
    if (!formData.location) next.location = 'Location is required';

    const acqIso = parseDateInputToIso(formData.acquisitionDate);
    if (!acqIso) next.acquisitionDate = 'Invalid date (jj/mm/aaaa)';

    if (formData.warrantyExpiry && !parseDateInputToIso(formData.warrantyExpiry)) {
      next.warrantyExpiry = 'Invalid date (jj/mm/aaaa)';
    }

    if (formData.dateIn && !parseDateInputToIso(formData.dateIn)) {
      next.dateIn = 'Invalid date (jj/mm/aaaa)';
    }

    if (formData.dateOut && !parseDateInputToIso(formData.dateOut)) {
      next.dateOut = 'Invalid date (jj/mm/aaaa)';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const resetAndClose = () => {
    setFormData({
      assetId: '',
      type: '',
      assetName: '',
      category: '',
      serialNumber: '',
      barcode: '',
      qrCode: '',
      macAddress: '',
      location: '',
      storeLocation: '',
      cabinet: '',
      rack: '',
      level: '',
      acquisitionDate: new Date().toLocaleDateString('fr-FR'),
      warrantyExpiry: '',
      status: 'Available',
      pilote: '',
      description: '',
      bci: '',
      bce: '',
      vnc: '',
      immoNumber: '',
      pilote1: '',
      stockIn: '',
      stockOut: '',
      dateIn: '',
      dateOut: '',
      comment: '',
    });
    setErrors({});
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const acquisitionDateIso = parseDateInputToIso(formData.acquisitionDate) ?? new Date().toISOString().split('T')[0];
    const warrantyEndDateIso =
      parseDateInputToIso(formData.warrantyExpiry) ?? addYearsIso(acquisitionDateIso, 1) ?? acquisitionDateIso;

    const dateInIso = parseDateInputToIso(formData.dateIn);
    const dateOutIso = parseDateInputToIso(formData.dateOut);

    const vncNumber = Number(String(formData.vnc ?? '').replace(',', '.'));
    const value = Number.isFinite(vncNumber) ? vncNumber : 0;

    const asset = {
      id: `AST-${Date.now()}`,
      assetTag: formData.assetId.trim(),
      serialNumber: formData.serialNumber.trim(),
      barcode: formData.barcode.trim() || undefined,
      qrCode: formData.qrCode.trim() || undefined,
      macAddress: formData.macAddress.trim() || undefined,
      model: formData.assetName.trim(),
      category: formData.category,
      supplier: '-',
      site: formData.location,
      status: formData.status,
      acquisitionDate: acquisitionDateIso,
      warrantyEndDate: warrantyEndDateIso,
      value,

      // Storage location (enterprise)
      storeLocation: formData.storeLocation.trim() || undefined,
      cabinet: formData.cabinet.trim() || undefined,
      rack: formData.rack.trim() || undefined,
      level: formData.level.trim() || undefined,

      // Stock Inventory extended fields
      type: formData.type.trim() || undefined,
      pilote: formData.pilote.trim(),
      description: formData.description.trim(),
      bci: formData.bci.trim(),
      bce: formData.bce.trim(),
      vnc: formData.vnc.trim(),
      immoNumber: formData.immoNumber.trim(),
      pilote1: formData.pilote1.trim(),
      stockIn: formData.stockIn.trim(),
      stockOut: formData.stockOut.trim(),
      dateIn: dateInIso ?? '',
      dateOut: dateOutIso ?? '',
      comment: formData.comment.trim(),
    };

    onAdd(asset);
    resetAndClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) resetAndClose();
      }}
    >
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Add New IT Asset</DialogTitle>
            <DialogDescription>Create a new IT asset entry in Assets IT.</DialogDescription>
          </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Asset ID</label>
                <input
                  type="text"
                  name="assetId"
                  value={formData.assetId}
                  onChange={handleChange}
                  placeholder="e.g. MA6-0001"
                  className={`w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent ${
                    errors.assetId ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.assetId && <p className="mt-1 text-sm text-red-600">{errors.assetId}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Barcode</label>
                <input
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleChange}
                  placeholder="e.g. 5901234123457"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">QR Code</label>
                <input
                  type="text"
                  name="qrCode"
                  value={formData.qrCode}
                  onChange={handleChange}
                  placeholder="e.g. LEO:ASSET:MA6-0001"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Storage Location (Magasin / Armoire / Rack / Étage)</label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    name="storeLocation"
                    value={formData.storeLocation}
                    onChange={handleChange}
                    placeholder="Magasin"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                  />
                  <input
                    type="text"
                    name="cabinet"
                    value={formData.cabinet}
                    onChange={handleChange}
                    placeholder="Armoire"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                  />
                  <input
                    type="text"
                    name="rack"
                    value={formData.rack}
                    onChange={handleChange}
                    placeholder="Rack"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                  />
                  <input
                    type="text"
                    name="level"
                    value={formData.level}
                    onChange={handleChange}
                    placeholder="Étage"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Asset Name</label>
                <input
                  type="text"
                  name="assetName"
                  value={formData.assetName}
                  onChange={handleChange}
                  placeholder="e.g. MacBook Pro M3 Max"
                  className={`w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent ${
                    errors.assetName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.assetName && <p className="mt-1 text-sm text-red-600">{errors.assetName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent ${
                    errors.category ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select...</option>
                  {filteredCategories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {categoryUsesBrand(formData.category) ? 'Brand' : 'Type'}
                </label>
                {categoryUsesBrand(formData.category) ? (
                  <>
                    <select
                      name="type"
                      value={formData.type}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent ${
                        errors.type ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select...</option>
                      {(getAllowedBrandsForCategory(formData.category) ?? []).map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    {errors.type && <p className="mt-1 text-sm text-red-600">{errors.type}</p>}
                  </>
                ) : categoryNeedsType(formData.category) ? (
                  <>
                    <select
                      name="type"
                      value={formData.type}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent ${
                        errors.type ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select...</option>
                      {(isScannerCategory(formData.category) ? SCANNER_TYPES : CISCO_TYPES).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    {errors.type && <p className="mt-1 text-sm text-red-600">{errors.type}</p>}
                  </>
                ) : (
                  <input
                    type="text"
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    placeholder={formData.category === 'APs' ? 'e.g. Access Point' : 'e.g. Monitor'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Serial Number</label>
                <input
                  type="text"
                  name="serialNumber"
                  value={formData.serialNumber}
                  onChange={handleChange}
                  placeholder="e.g. SN-8829-AFZ"
                  className={`w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent ${
                    errors.serialNumber ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.serialNumber && <p className="mt-1 text-sm text-red-600">{errors.serialNumber}</p>}
              </div>

              {formData.category === 'APs' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">MAC</label>
                  <input
                    type="text"
                    name="macAddress"
                    value={formData.macAddress}
                    onChange={handleChange}
                    placeholder="e.g. F4:DB:E6:CA:15:1E"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Plant / Site</label>
                <select
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent ${
                    errors.location ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select...</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {errors.location && <p className="mt-1 text-sm text-red-600">{errors.location}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Acquisition Date</label>
                <input
                  type="text"
                  name="acquisitionDate"
                  value={formData.acquisitionDate}
                  onChange={handleChange}
                  placeholder="23/02/2026"
                  className={`w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent ${
                    errors.acquisitionDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.acquisitionDate && <p className="mt-1 text-sm text-red-600">{errors.acquisitionDate}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Warranty Expiry</label>
                <input
                  type="text"
                  name="warrantyExpiry"
                  value={formData.warrantyExpiry}
                  onChange={handleChange}
                  placeholder="jj/mm/aaaa"
                  className={`w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent ${
                    errors.warrantyExpiry ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.warrantyExpiry && <p className="mt-1 text-sm text-red-600">{errors.warrantyExpiry}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                >
                  <option value="Available">Available</option>
                  <option value="Assigned">Assigned</option>
                  <option value="InRepair">In Repair</option>
                  <option value="Retired">Retired</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pilote (Assigned To)</label>
                <input
                  type="text"
                  name="pilote"
                  value={formData.pilote}
                  onChange={handleChange}
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">BCI</label>
                <input
                  type="text"
                  name="bci"
                  value={formData.bci}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">BCE</label>
                <input
                  type="text"
                  name="bce"
                  value={formData.bce}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">VNC</label>
                <input
                  type="text"
                  name="vnc"
                  value={formData.vnc}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Immo Number</label>
                <input
                  type="text"
                  name="immoNumber"
                  value={formData.immoNumber}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pilote 1 (Secondary)</label>
                <input
                  type="text"
                  name="pilote1"
                  value={formData.pilote1}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stock IN</label>
                <input
                  type="text"
                  name="stockIn"
                  value={formData.stockIn}
                  onChange={handleChange}
                  placeholder="e.g. ✓"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stock Out</label>
                <input
                  type="text"
                  name="stockOut"
                  value={formData.stockOut}
                  onChange={handleChange}
                  placeholder="e.g. ✓"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date In</label>
                <input
                  type="text"
                  name="dateIn"
                  value={formData.dateIn}
                  onChange={handleChange}
                  placeholder="jj/mm/aaaa"
                  className={`w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent ${
                    errors.dateIn ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.dateIn && <p className="mt-1 text-sm text-red-600">{errors.dateIn}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Out</label>
                <input
                  type="text"
                  name="dateOut"
                  value={formData.dateOut}
                  onChange={handleChange}
                  placeholder="jj/mm/aaaa"
                  className={`w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent ${
                    errors.dateOut ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.dateOut && <p className="mt-1 text-sm text-red-600">{errors.dateOut}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Comment</label>
                <input
                  type="text"
                  name="comment"
                  value={formData.comment}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent"
                />
              </div>
            </div>

          <DialogFooter>
            <button
              type="button"
              onClick={resetAndClose}
              className="border border-border bg-card text-foreground px-4 py-2 rounded-lg hover:bg-muted/30 transition-all font-medium"
            >
              Discard
            </button>
            <button
              type="submit"
              className="bg-gradient-to-r from-[#1B4F91] to-[#2563EB] text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              Register Asset
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
