import React, { useMemo, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import type { Site } from '../../types';

type FormState = {
  name: string;
  plant: string;
  key: string;
  manufacturer: string;
  purchaseDate: string;
  expiryDate: string;
  supplier: string;
};

interface AddLicenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: Site[];
  onAdd: (payload: {
    name: string;
    plant: string;
    key: string;
    manufacturer: string;
    purchaseDate: string;
    expiryDate: string;
    supplier: string;
  }) => void;
}

function toIsoDate(input: string): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  // ISO: YYYY-MM-DD
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  // FR: DD/MM/YYYY
  const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (fr) {
    const d = Number(fr[1]);
    const m = Number(fr[2]);
    const y = Number(fr[3]);
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return `${String(y)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  return null;
}

export function AddLicenceModal({ isOpen, onClose, onAdd, sites }: AddLicenceModalProps) {
  const todayFr = useMemo(() => new Date().toLocaleDateString('fr-FR'), []);

  const [form, setForm] = useState<FormState>({
    name: '',
    plant: '',
    key: '',
    manufacturer: '',
    purchaseDate: todayFr,
    expiryDate: '',
    supplier: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.plant.trim()) next.plant = 'Plant is required';
    if (!form.key.trim()) next.key = 'Key is required';
    if (!form.manufacturer.trim()) next.manufacturer = 'Manufacturer is required';
    if (!form.supplier.trim()) next.supplier = 'Supplier is required';

    const purchaseIso = toIsoDate(form.purchaseDate);
    if (!purchaseIso) next.purchaseDate = 'Invalid date (jj/mm/aaaa)';

    const expiryIso = toIsoDate(form.expiryDate);
    if (!expiryIso) next.expiryDate = 'Invalid date (jj/mm/aaaa)';

    if (purchaseIso && expiryIso && expiryIso < purchaseIso) {
      next.expiryDate = 'Expiry must be after purchase';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const purchaseIso = toIsoDate(form.purchaseDate) ?? '';
    const expiryIso = toIsoDate(form.expiryDate) ?? '';

    onAdd({
      name: form.name.trim(),
      plant: form.plant.trim(),
      key: form.key.trim(),
      manufacturer: form.manufacturer.trim(),
      purchaseDate: purchaseIso,
      expiryDate: expiryIso,
      supplier: form.supplier.trim(),
    });

    handleClose();
  };

  const handleClose = () => {
    setErrors({});
    setForm({
      name: '',
      plant: '',
      key: '',
      manufacturer: '',
      purchaseDate: todayFr,
      expiryDate: '',
      supplier: '',
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a licence</DialogTitle>
          <DialogDescription>Enter the licence details.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none"
                placeholder="Ex: Office 365"
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Plant</label>
              <select
                name="plant"
                value={form.plant}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none"
              >
                <option value="">Select a site</option>
                {(Array.isArray(sites) ? sites : [])
                  .slice()
                  .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
                  .map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
              </select>
              {errors.plant && <p className="mt-1 text-xs text-red-600">{errors.plant}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Key</label>
              <input
                name="key"
                value={form.key}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none"
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
              />
              {errors.key && <p className="mt-1 text-xs text-red-600">{errors.key}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Manufacturer</label>
              <input
                name="manufacturer"
                value={form.manufacturer}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none"
                placeholder="Ex: Microsoft"
              />
              {errors.manufacturer && <p className="mt-1 text-xs text-red-600">{errors.manufacturer}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Purchase date</label>
              <input
                name="purchaseDate"
                value={form.purchaseDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none"
                placeholder="dd/mm/yyyy"
              />
              {errors.purchaseDate && <p className="mt-1 text-xs text-red-600">{errors.purchaseDate}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Expiry date</label>
              <input
                name="expiryDate"
                value={form.expiryDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none"
                placeholder="dd/mm/yyyy"
              />
              {errors.expiryDate && <p className="mt-1 text-xs text-red-600">{errors.expiryDate}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-2">Supplier</label>
              <input
                name="supplier"
                value={form.supplier}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none"
                placeholder="Ex: Vendor X"
              />
              {errors.supplier && <p className="mt-1 text-xs text-red-600">{errors.supplier}</p>}
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-medium hover:shadow-lg hover:scale-[1.02] transition-all"
            >
              Add
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
