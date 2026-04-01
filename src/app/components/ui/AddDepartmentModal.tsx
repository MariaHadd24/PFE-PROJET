import React, { useEffect, useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

interface AddDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (department: any) => void;
  initialDepartment?: any;
  onUpdate?: (department: any) => void;
}

export function AddDepartmentModal({ isOpen, onClose, onAdd, initialDepartment, onUpdate }: AddDepartmentModalProps) {
  const isEdit = useMemo(() => !!initialDepartment, [initialDepartment]);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    head: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    if (!initialDepartment) {
      setFormData({ name: '', code: '', head: '' });
      setErrors({});
      return;
    }
    setFormData({
      name: String(initialDepartment?.name ?? ''),
      code: String((initialDepartment as any)?.code ?? ''),
      head: String((initialDepartment as any)?.head ?? (initialDepartment as any)?.manager ?? ''),
    });
    setErrors({});
  }, [isOpen, initialDepartment]);

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

    const departmentPayload = {
      id: String((initialDepartment as any)?.id ?? `DEPT-${Date.now()}`),
      name: formData.name.trim(),
      code: formData.code.trim(),
      head: formData.head.trim(),
      members: typeof (initialDepartment as any)?.members === 'number' ? (initialDepartment as any).members : 0,
    };

    if (isEdit) {
      (onUpdate ?? onAdd)(departmentPayload);
    } else {
      onAdd(departmentPayload);
    }
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      name: '',
      code: '',
      head: ''
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
                <Building2 className="h-5 w-5" />
                {isEdit ? 'Edit department' : 'New department'}
              </span>
            </DialogTitle>
            <DialogDescription>Manage organizational departments.</DialogDescription>
          </DialogHeader>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Human Resources, IT, Finance..."
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Code
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder="ex: IT, HR, LOG..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department head
              </label>
              <input
                type="text"
                name="head"
                value={formData.head}
                onChange={handleChange}
                placeholder="e.g. John Doe"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none"
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
              {isEdit ? 'Save changes' : 'Create department'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
