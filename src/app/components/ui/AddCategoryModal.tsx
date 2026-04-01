import React, { useEffect, useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (category: any) => void;
  initialCategory?: any;
  onUpdate?: (category: any) => void;
}

export function AddCategoryModal({ isOpen, onClose, onAdd, initialCategory, onUpdate }: AddCategoryModalProps) {
  const isEdit = useMemo(() => !!initialCategory, [initialCategory]);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    if (!initialCategory) {
      setFormData({ name: '', description: '' });
      setErrors({});
      return;
    }
    setFormData({
      name: String(initialCategory?.name ?? ''),
      description: String((initialCategory as any)?.description ?? ''),
    });
    setErrors({});
  }, [isOpen, initialCategory]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const categoryPayload = {
      id: String((initialCategory as any)?.id ?? `CAT-${Date.now()}`),
      name: formData.name.trim(),
      description: formData.description.trim(),
    };

    if (isEdit) {
      (onUpdate ?? onAdd)(categoryPayload);
    } else {
      onAdd(categoryPayload);
    }
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: ''
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <Package className="h-5 w-5" />
                {isEdit ? 'Edit category' : 'New category'}
              </span>
            </DialogTitle>
            <DialogDescription>Define categories for assets and inventory.</DialogDescription>
          </DialogHeader>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="ex: Smartphone, Tablette, Accessoires..."
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (optional)
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Describe this category..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none resize-none"
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
              className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              {isEdit ? 'Save changes' : 'Create category'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
