import React, { useState } from 'react';
import type { Asset, Supplier, TicketStatus } from '../../types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

interface AddMaintenanceTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (ticket: any) => void;
  assets: Asset[];
  suppliers: Supplier[];
}

export function AddMaintenanceTicketModal({ isOpen, onClose, onAdd, assets, suppliers }: AddMaintenanceTicketModalProps) {
  const [formData, setFormData] = useState({
    assetId: '',
    description: '',
    status: 'Open' as TicketStatus,
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Critical',
    provider: '',
    cost: '0',
    isWarranty: false,
    reportedBy: '',
    estimatedRepairDate: '',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ 
        ...prev, 
        [name]: checked,
        // If warranty is checked, set cost to 0
        ...(name === 'isWarranty' && checked ? { cost: '0' } : {})
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.assetId) {
      newErrors.assetId = 'Asset is required';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Problem description is required';
    }
    if (!formData.provider) {
      newErrors.provider = 'Provider is required';
    }
    if (!formData.reportedBy.trim()) {
      newErrors.reportedBy = 'Reported by is required';
    }
    if (!formData.isWarranty && (!formData.cost || parseFloat(formData.cost) < 0)) {
      newErrors.cost = 'A valid cost is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const selectedAsset = assets.find(a => a.id === formData.assetId);

    const newTicket = {
      id: `TKT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      assetId: formData.assetId,
      assetTag: selectedAsset?.assetTag || '',
      description: formData.description,
      status: formData.status,
      priority: formData.priority,
      provider: formData.provider,
      cost: formData.isWarranty ? 0 : parseFloat(formData.cost),
      openDate: new Date().toISOString(),
      closeDate: formData.status === 'Closed' || formData.status === 'Done' ? new Date().toISOString() : undefined,
      reportedBy: formData.reportedBy,
      estimatedRepairDate: formData.estimatedRepairDate || undefined,
      isWarranty: formData.isWarranty,
      notes: formData.notes || undefined
    };

    onAdd(newTicket);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      assetId: '',
      description: '',
      status: 'Open',
      priority: 'Medium',
      provider: '',
      cost: '0',
      isWarranty: false,
      reportedBy: '',
      estimatedRepairDate: '',
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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>New maintenance ticket</DialogTitle>
            <DialogDescription>Log a maintenance issue for an asset.</DialogDescription>
          </DialogHeader>

            {/* Asset Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Affected asset <span className="text-red-500">*</span>
              </label>
              <select
                name="assetId"
                value={formData.assetId}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none ${
                  errors.assetId ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select an asset...</option>
                {assets.map(asset => (
                  <option key={asset.id} value={asset.id}>
                    {asset.assetTag} - {asset.model} (SN: {asset.serialNumber})
                  </option>
                ))}
              </select>
              {errors.assetId && (
                <p className="mt-1 text-sm text-red-600">{errors.assetId}</p>
              )}
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none"
                >
                  <option value="Open">Open</option>
                  <option value="InProgress">In progress</option>
                  <option value="Done">Done</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              {/* Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Provider <span className="text-red-500">*</span>
                </label>
                <select
                  name="provider"
                  value={formData.provider}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none ${
                    errors.provider ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select...</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.name}>{supplier.name}</option>
                  ))}
                  <option value="Internal team">Internal team</option>
                </select>
                {errors.provider && (
                  <p className="mt-1 text-sm text-red-600">{errors.provider}</p>
                )}
              </div>

              {/* Reported By */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reported by <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="reportedBy"
                  value={formData.reportedBy}
                  onChange={handleChange}
                  placeholder="Person name"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none ${
                    errors.reportedBy ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.reportedBy && (
                  <p className="mt-1 text-sm text-red-600">{errors.reportedBy}</p>
                )}
              </div>

              {/* Estimated Repair Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated repair date
                </label>
                <input
                  type="date"
                  name="estimatedRepairDate"
                  value={formData.estimatedRepairDate}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none"
                />
              </div>

              {/* Warranty Checkbox */}
              <div className="flex items-center">
                <div className="mt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="isWarranty"
                      checked={formData.isWarranty}
                      onChange={handleChange}
                      className="w-4 h-4 text-[#1B4F91] border-gray-300 rounded focus:ring-[#1B4F91]"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Warranty repair (free)
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Cost (if not warranty) */}
            {!formData.isWarranty && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated cost (MAD) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="cost"
                  value={formData.cost}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="ex: 150.00"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none ${
                    errors.cost ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.cost && (
                  <p className="mt-1 text-sm text-red-600">{errors.cost}</p>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Problem description <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                placeholder="Describe the issue in detail..."
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none resize-none ${
                  errors.description ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Internal notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Additional notes (optional)..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none resize-none"
              />
            </div>

            {/* Info Alert */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> When a ticket is open or in progress, the asset status will be automatically set to "In repair".
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
              className="bg-gradient-to-r from-[#1B4F91] to-[#2563EB] text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              Create ticket
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
