import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Category, Department, PRLine, PRStatus, PurchaseRequest, User } from '../../types';
import { formatMAD } from '../../lib/money';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

interface AddPRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (pr: any) => void;
  categories: Category[];
  departments: Department[];
  users: User[];
}

interface PRItem {
  id: string;
  category: string;
  description: string;
  quantity: number;
  estimatedPrice: number;
}

export function AddPRModal({ isOpen, onClose, onAdd, categories, departments, users }: AddPRModalProps) {
  const [formData, setFormData] = useState({
    requester: '',
    department: '',
    bce: '',
    bci: '',
    status: 'Draft' as PRStatus,
    justification: ''
  });

  const [items, setItems] = useState<PRItem[]>([
    {
      id: '1',
      category: '',
      description: '',
      quantity: 1,
      estimatedPrice: 0
    }
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleItemChange = (id: string, field: keyof PRItem, value: any) => {
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
        category: '',
        description: '',
        quantity: 1,
        estimatedPrice: 0
      }
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.estimatedPrice), 0);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.requester) {
      newErrors.requester = 'Requester is required';
    }
    if (!formData.department) {
      newErrors.department = 'Department is required';
    }
    if (!formData.justification.trim()) {
      newErrors.justification = 'Justification is required';
    }

    // Validate items
    const hasInvalidItems = items.some(item => 
      !item.category || !item.description.trim() || item.quantity <= 0 || item.estimatedPrice <= 0
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

    const lines: PRLine[] = items.map((item) => ({
      id: item.id,
      product: `${item.category} - ${item.description}`.trim(),
      quantity: item.quantity,
      estimatedPrice: item.estimatedPrice,
    }));

    const newPR: PurchaseRequest = {
      id: `PR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
      requester: formData.requester,
      department: formData.department,
      bce: formData.bce.trim() ? formData.bce.trim() : undefined,
      bci: formData.bci.trim() ? formData.bci.trim() : undefined,
      status: formData.status,
      budget: calculateTotal(),
      createdDate: new Date().toISOString(),
      justification: formData.justification,
      lines,
    };

    onAdd(newPR);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      requester: '',
      department: '',
      bce: '',
      bci: '',
      status: 'Draft',
      justification: ''
    });
    setItems([
      {
        id: '1',
        category: '',
        description: '',
        quantity: 1,
        estimatedPrice: 0
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
            <DialogTitle>New Purchase Request (PR)</DialogTitle>
            <DialogDescription>Create a purchase request with one or more line items.</DialogDescription>
          </DialogHeader>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Requester */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Requester <span className="text-destructive">*</span>
                </label>
                <select
                  name="requester"
                  value={formData.requester}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none ${
                    errors.requester ? 'border-destructive' : 'border-border'
                  }`}
                >
                  <option value="">Select...</option>
                  {users.map(user => (
                    <option key={user.id} value={user.name}>{user.name}</option>
                  ))}
                </select>
                {errors.requester && (
                  <p className="mt-1 text-sm text-destructive">{errors.requester}</p>
                )}
              </div>

              {/* BCE */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">BCE</label>
                <input
                  type="text"
                  name="bce"
                  value={formData.bce}
                  onChange={handleChange}
                  placeholder="e.g. BCE-2026-001"
                  className="w-full px-3 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none"
                />
              </div>

              {/* BCI */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">BCI</label>
                <input
                  type="text"
                  name="bci"
                  value={formData.bci}
                  onChange={handleChange}
                  placeholder="e.g. BCI-2026-001"
                  className="w-full px-3 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Department <span className="text-destructive">*</span>
                </label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none ${
                    errors.department ? 'border-destructive' : 'border-border'
                  }`}
                >
                  <option value="">Select...</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
                {errors.department && (
                  <p className="mt-1 text-sm text-destructive">{errors.department}</p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none"
                >
                  <option value="Draft">Draft</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
            </div>

            {/* Items Section */}
            <div className="border-t border-border pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground">Requested items</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-2 px-4 py-2 bg-muted/40 text-foreground rounded-lg hover:bg-muted/60 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add item
                </button>
              </div>

              {errors.items && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{errors.items}</p>
                </div>
              )}

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={item.id} className="p-4 bg-muted/30 rounded-lg border border-border">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-semibold text-foreground">Item #{index + 1}</h4>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Category */}
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Category</label>
                        <select
                          value={item.category}
                          onChange={(e) => handleItemChange(item.id, 'category', e.target.value)}
                          className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none text-sm"
                        >
                          <option value="">Select...</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Description */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-foreground mb-2">Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                          placeholder="ex: Dell Laptop XPS 15"
                          className="w-full px-3 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none text-sm"
                        />
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Quantity</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                          min="1"
                          className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none text-sm"
                        />
                      </div>

                      {/* Estimated Price */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-foreground mb-2">Estimated unit price (MAD)</label>
                        <input
                          type="number"
                          value={item.estimatedPrice}
                          onChange={(e) => handleItemChange(item.id, 'estimatedPrice', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none text-sm"
                        />
                      </div>

                      {/* Subtotal */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-foreground mb-2">Subtotal</label>
                        <div className="px-3 py-2 bg-card border border-border rounded-lg text-sm font-semibold text-foreground">
                          {formatMAD(item.quantity * item.estimatedPrice, { decimals: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="mt-4 p-4 bg-muted/40 rounded-lg border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-foreground">Estimated total budget</span>
                  <span className="text-2xl font-bold text-[#1B4F91]">
                    {formatMAD(calculateTotal(), { decimals: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Justification */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Justification <span className="text-destructive">*</span>
              </label>
              <textarea
                name="justification"
                value={formData.justification}
                onChange={handleChange}
                rows={4}
                placeholder="Explain the reason for this purchase request..."
                className={`w-full px-3 py-2 border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none resize-none ${
                  errors.justification ? 'border-destructive' : 'border-border'
                }`}
              />
              {errors.justification && (
                <p className="mt-1 text-sm text-destructive">{errors.justification}</p>
              )}
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
              Create purchase request
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
