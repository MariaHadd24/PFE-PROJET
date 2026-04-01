import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

interface AddRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (role: any) => void;
}

export function AddRoleModal({ isOpen, onClose, onAdd }: AddRoleModalProps) {
  const [formData, setFormData] = useState({
    role: '',
    desc: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.role.trim()) {
      newErrors.role = 'Role is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const newRole = {
      id: `ROLE-${Date.now()}`,
      role: formData.role.trim(),
      desc: formData.desc.trim(),
    };

    onAdd(newRole);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      role: '',
      desc: ''
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
                <Shield className="h-5 w-5" />
                New role
              </span>
            </DialogTitle>
            <DialogDescription>Create a role for access management.</DialogDescription>
          </DialogHeader>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="role"
                value={formData.role}
                onChange={handleChange}
                placeholder="ex: Super Admin, Technician..."
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none ${
                  errors.role ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.role && <p className="mt-1 text-sm text-red-600">{errors.role}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
              <textarea
                name="desc"
                value={formData.desc}
                onChange={handleChange}
                rows={3}
                placeholder="Describe responsibilities and permissions..."
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
              Create role
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
