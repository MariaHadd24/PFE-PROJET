import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { POLine, POStatus, PurchaseOrder, PurchaseRequest, Supplier } from '../../types';
import { formatMAD } from '../../lib/money';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

interface AddPOModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (po: any) => void;
  purchaseRequests: PurchaseRequest[];
  suppliers: Supplier[];
}

interface POItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export function AddPOModal({ isOpen, onClose, onAdd, purchaseRequests, suppliers }: AddPOModalProps) {
  const [formData, setFormData] = useState({
    prId: '',
    supplier: '',
    status: 'Draft' as POStatus,
    expectedDelivery: '',
    paymentTerms: '',
    shippingAddress: '',
    notes: ''
  });

  const [items, setItems] = useState<POItem[]>([
    {
      id: '1',
      description: '',
      quantity: 1,
      unitPrice: 0
    }
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get only approved PRs
  const approvedPRs = purchaseRequests.filter(pr => pr.status === 'Approved');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleItemChange = (id: string, field: keyof POItem, value: any) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const addItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        description: '',
        quantity: 1,
        unitPrice: 0
      }
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.prId) {
      newErrors.prId = 'Linked PR is required';
    }
    if (!formData.supplier) {
      newErrors.supplier = 'Supplier is required';
    }
    if (!formData.expectedDelivery) {
      newErrors.expectedDelivery = 'Expected delivery date is required';
    }
    if (!formData.shippingAddress.trim()) {
      newErrors.shippingAddress = 'Shipping address is required';
    }

    // Validate items
    const hasInvalidItems = items.some(item => 
      !item.description.trim() || item.quantity <= 0 || item.unitPrice <= 0
    );

    if (hasInvalidItems) {
      newErrors.items = 'All items must be completed with valid values';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const lines: POLine[] = items.map((item) => ({
      id: item.id,
      product: item.description,
      quantity: item.quantity,
      price: item.unitPrice,
    }));

    const newPO: PurchaseOrder = {
      id: `PO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
      prId: formData.prId,
      supplier: formData.supplier,
      status: formData.status,
      total: calculateTotal(),
      createdDate: new Date().toISOString(),
      lines,
    };

    onAdd(newPO);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      prId: '',
      supplier: '',
      status: 'Draft',
      expectedDelivery: '',
      paymentTerms: '',
      shippingAddress: '',
      notes: ''
    });
    setItems([
      {
        id: '1',
        description: '',
        quantity: 1,
        unitPrice: 0
      }
    ]);
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
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>New Purchase Order (PO)</DialogTitle>
            <DialogDescription>Create a PO linked to an approved PR.</DialogDescription>
          </DialogHeader>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* PR Linked */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Linked PR <span className="text-red-500">*</span>
                </label>
                <select
                  name="prId"
                  value={formData.prId}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none ${
                    errors.prId ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select...</option>
                  {approvedPRs.map(pr => (
                    <option key={pr.id} value={pr.id}>
                      {pr.id} - {pr.requester} ({formatMAD(pr.budget, { decimals: 2 })})
                    </option>
                  ))}
                </select>
                {errors.prId && (
                  <p className="mt-1 text-sm text-red-600">{errors.prId}</p>
                )}
                {approvedPRs.length === 0 && (
                  <p className="mt-1 text-sm text-orange-600">No approved PR available</p>
                )}
              </div>

              {/* Supplier */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <select
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none ${
                    errors.supplier ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select...</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.name}>{supplier.name}</option>
                  ))}
                </select>
                {errors.supplier && (
                  <p className="mt-1 text-sm text-red-600">{errors.supplier}</p>
                )}
              </div>

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
                  <option value="Draft">Draft</option>
                  <option value="Approved">Approved</option>
                  <option value="Ordered">Ordered</option>
                </select>
              </div>

              {/* Expected Delivery */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected delivery <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="expectedDelivery"
                  value={formData.expectedDelivery}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none ${
                    errors.expectedDelivery ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.expectedDelivery && (
                  <p className="mt-1 text-sm text-red-600">{errors.expectedDelivery}</p>
                )}
              </div>

              {/* Payment Terms */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment terms
                </label>
                <select
                  name="paymentTerms"
                  value={formData.paymentTerms}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none"
                >
                  <option value="">Select...</option>
                  <option value="Net 15">Net 15 days</option>
                  <option value="Net 30">Net 30 days</option>
                  <option value="Net 45">Net 45 days</option>
                  <option value="Net 60">Net 60 days</option>
                  <option value="Immediate">Immediate payment</option>
                  <option value="50% Advance">50% advance</option>
                </select>
              </div>
            </div>

            {/* Shipping Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shipping address <span className="text-red-500">*</span>
              </label>
              <textarea
                name="shippingAddress"
                value={formData.shippingAddress}
                onChange={handleChange}
                rows={2}
                placeholder="Full shipping address..."
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none resize-none ${
                  errors.shippingAddress ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.shippingAddress && (
                <p className="mt-1 text-sm text-red-600">{errors.shippingAddress}</p>
              )}
            </div>

            {/* Items Section */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Ordered items</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add item
                </button>
              </div>

              {errors.items && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{errors.items}</p>
                </div>
              )}

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={item.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-semibold text-gray-900">Item #{index + 1}</h4>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Description */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description
                        </label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                          placeholder="ex: Dell Laptop XPS 15 - i7, 16GB RAM"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none text-sm"
                        />
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                          min="1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none text-sm"
                        />
                      </div>

                      {/* Unit Price */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Unit price (MAD)
                        </label>
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none text-sm"
                        />
                      </div>

                      {/* Subtotal */}
                      <div className="md:col-span-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Subtotal
                        </label>
                        <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-900">
                          {formatMAD(item.quantity * item.unitPrice, { decimals: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Order total</span>
                  <span className="text-2xl font-bold text-[#1B4F91]">
                    {formatMAD(calculateTotal(), { decimals: 2 })}
                  </span>
                </div>
              </div>
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
                placeholder="Additional notes for this order..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none resize-none"
              />
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
              className="bg-gradient-to-r from-[#1B4F91] to-[#2563EB] text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              Create purchase order
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
