import React, { useEffect, useMemo, useState } from 'react';
import { Building2, MapPin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

interface AddSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (site: any) => void;
  initialSite?: any;
  onUpdate?: (site: any) => void;
}

export function AddSiteModal({ isOpen, onClose, onAdd, initialSite, onUpdate }: AddSiteModalProps) {
  const isEdit = useMemo(() => !!initialSite, [initialSite]);
  const [formData, setFormData] = useState({
    name: '',
    codeIt: '',
    location: '',
    zone: '',
    city: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    if (!initialSite) {
      setFormData({
        name: '',
        codeIt: '',
        location: '',
        zone: '',
        city: '',
      });
      setErrors({});
      return;
    }

    setFormData({
      name: String(initialSite?.name ?? ''),
      codeIt: String((initialSite as any)?.codeIt ?? ''),
      location: String(initialSite?.location ?? ''),
      zone: String((initialSite as any)?.zone ?? ''),
      city: String((initialSite as any)?.city ?? ''),
    });
    setErrors({});
  }, [isOpen, initialSite]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const sitePayload = {
      id: String((initialSite as any)?.id ?? `SITE-${Date.now()}`),
      name: formData.name.trim(),
      codeIt: formData.codeIt.trim() || undefined,
      location: formData.location.trim(),
      zone: formData.zone.trim() || undefined,
      city: formData.city.trim() || undefined,
    };

    if (isEdit) {
      (onUpdate ?? onAdd)(sitePayload);
    } else {
      onAdd(sitePayload);
    }
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      name: '',
      codeIt: '',
      location: '',
      zone: '',
      city: '',
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {isEdit ? 'Edit site' : 'New site'}
              </span>
            </DialogTitle>
            <DialogDescription>Manage sites/locations for assets.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Site name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Paris HQ"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Code site IT</label>
              <input
                type="text"
                name="codeIt"
                value={formData.codeIt}
                onChange={handleChange}
                placeholder="ex: SEB, BOK, MA6, MA7, MAG"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ville <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="ex: Aïn Sebaâ, Herbili, Bouznika..."
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none ${
                    errors.location ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.location && <p className="mt-1 text-sm text-red-600">{errors.location}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Zone industrielle</label>
              <input
                type="text"
                name="zone"
                value={formData.zone}
                onChange={handleChange}
                placeholder="ex: Zone industrielle Bouskoura"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="ex: Casablanca"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none"
              />
            </div>
          </div>

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
              className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              {isEdit ? 'Save changes' : 'Create site'}
            </button>
          </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}
